import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Order, OrderDocument } from './schemas/order.schema';
import { OrderStatus, PaymentStatus } from '@common/constants';
import { PaginationDto, PaginatedResult } from '@common/dto';
import { CommissionsService } from '../commissions/commissions.service';

@Injectable()
export class OrdersService {
    private readonly logger = new Logger(OrdersService.name);

    constructor(
        @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
        private commissionsService: CommissionsService,
    ) { }

    async create(dto: any, customerId: string) {
        const orderNumber = `WK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const order = await this.orderModel.create({
            ...dto,
            orderNumber,
            customerId: new Types.ObjectId(customerId),
            status: OrderStatus.PENDING,
            paymentStatus: PaymentStatus.PENDING,
        });
        return { message: 'Order created', data: order };
    }

    async findAll(paginationDto: PaginationDto, filters?: any) {
        const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', search } = paginationDto;
        const skip = (page - 1) * limit;
        const filter: any = {};
        if (search) filter.orderNumber = { $regex: search, $options: 'i' };
        if (filters?.status) filter.status = filters.status;
        if (filters?.paymentStatus) filter.paymentStatus = filters.paymentStatus;
        if (filters?.merchantId) filter.merchantId = new Types.ObjectId(filters.merchantId);
        if (filters?.customerId) filter.customerId = new Types.ObjectId(filters.customerId);

        const [data, total] = await Promise.all([
            this.orderModel.find(filter)
                .populate('customerId', 'email fullName')
                .populate('merchantId', 'merchantCode fullName')
                .sort({ [sortBy as string]: sortOrder === 'asc' ? 1 : -1 })
                .skip(skip).limit(limit).lean(),
            this.orderModel.countDocuments(filter),
        ]);
        return new PaginatedResult(data as any[], total, page, limit);
    }

    async findById(id: string) {
        const order = await this.orderModel.findById(id)
            .populate('customerId', 'email fullName phone')
            .populate('merchantId', 'merchantCode fullName')
            .lean();
        if (!order) throw new NotFoundException('Order not found');
        return order;
    }

    async findByOrderNumber(orderNumber: string) {
        const order = await this.orderModel.findOne({ orderNumber }).lean();
        if (!order) throw new NotFoundException('Order not found');
        return order;
    }

    async updateStatus(id: string, status: OrderStatus) {
        const order = await this.orderModel.findById(id);
        if (!order) throw new NotFoundException('Order not found');

        order.status = status;

        if (status === OrderStatus.COMPLETED) {
            order.completedAt = new Date();
            // Trigger commission calculation if referral
            if (order.paymentStatus === PaymentStatus.PAID && (order.merchantId || order.partnerId)) {
                await this.commissionsService.calculateCommission(
                    order._id.toString(),
                    order.totalAmount,
                    order.merchantId?.toString(),
                    order.partnerId?.toString(),
                );
            }
        }

        if (status === OrderStatus.CANCELLED) {
            order.cancelledAt = new Date();
            // Reverse commission if exists
            await this.commissionsService.reverseCommission(order._id.toString(), 'Order cancelled');
        }

        if (status === OrderStatus.REFUNDED) {
            await this.commissionsService.reverseCommission(order._id.toString(), 'Order refunded');
        }

        await order.save();
        return { message: `Order status updated to ${status}`, data: order };
    }

    async updatePaymentStatus(id: string, paymentStatus: PaymentStatus, paymentReference?: string, paymentProvider?: string) {
        const order = await this.orderModel.findByIdAndUpdate(
            id,
            { paymentStatus, paymentReference, paymentProvider },
            { new: true },
        );
        if (!order) throw new NotFoundException('Order not found');

        // If payment is confirmed and order is completed, trigger commission
        if (paymentStatus === PaymentStatus.PAID && order.status === OrderStatus.COMPLETED) {
            if (order.merchantId || order.partnerId) {
                await this.commissionsService.calculateCommission(
                    order._id.toString(), order.totalAmount,
                    order.merchantId?.toString(), order.partnerId?.toString(),
                );
            }
        }

        return { message: 'Payment status updated', data: order };
    }

    async attachReferral(orderId: string, merchantId: string, referralCode: string) {
        return this.orderModel.findByIdAndUpdate(orderId, {
            merchantId: new Types.ObjectId(merchantId),
            referralCode,
        }, { new: true });
    }

    async getMyOrders(customerId: string, paginationDto: PaginationDto) {
        return this.findAll(paginationDto, { customerId });
    }

    async getStats() {
        const [total, pending, completed, cancelled] = await Promise.all([
            this.orderModel.countDocuments(),
            this.orderModel.countDocuments({ status: OrderStatus.PENDING }),
            this.orderModel.countDocuments({ status: OrderStatus.COMPLETED }),
            this.orderModel.countDocuments({ status: OrderStatus.CANCELLED }),
        ]);
        const revenue = await this.orderModel.aggregate([
            { $match: { paymentStatus: PaymentStatus.PAID } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]);
        return { total, pending, completed, cancelled, totalRevenue: revenue[0]?.total || 0 };
    }
}
