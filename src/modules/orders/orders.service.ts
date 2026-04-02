import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { Order, OrderDocument } from './schemas/order.schema';
import { OrderStatus, PaymentStatus, PaymentProvider, UserType } from '@common/constants';
import { PaginationDto, PaginatedResult } from '@common/dto';
import { CommissionsService } from '../commissions/commissions.service';
import { ShippingService } from '../shipping/shipping.service';

@Injectable()
export class OrdersService {
    private readonly logger = new Logger(OrdersService.name);

    constructor(
        @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
        @InjectModel('User') private userModel: Model<any>,
        private commissionsService: CommissionsService,
        private shippingService: ShippingService,
    ) { }

    async create(dto: any, customerId?: string) {
        let finalCustomerId = customerId;

        // Guest Checkout Handling
        if (!finalCustomerId) {
            const guestEmail = dto.orderingCustomer?.email;
            if (!guestEmail) throw new BadRequestException('Email is required for guest checkout');

            let user = await this.userModel.findOne({ email: guestEmail.toLowerCase() });
            if (!user) {
                // Create a placeholder user for the guest
                const tempPassword = await bcrypt.hash(Math.random().toString(36), 12);
                user = await this.userModel.create({
                    email: guestEmail.toLowerCase(),
                    fullName: `${dto.orderingCustomer?.firstName || ''} ${dto.orderingCustomer?.surname || ''}`.trim() || 'Guest User',
                    phone: dto.orderingCustomer?.whatsapp || '',
                    userType: UserType.CUSTOMER,
                    password: tempPassword,
                    isEmailVerified: false,
                    isActive: true,
                });
                this.logger.log(`Created new guest user account for email: ${guestEmail}`);
            }
            finalCustomerId = user._id.toString();
        }

        const orderNumber = `WK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        // Calculate total weight
        const totalWeight = (dto.items || []).reduce((sum: number, item: any) => sum + (item.weight || 1) * (item.quantity || 1), 0);

        let shippingFee = 0;
        let shippingDetails = null;

        if (dto.deliveryMethod !== 'pickup') {
            const country = dto.recipientDetails?.country || 'Nigeria';
            const isHomeDelivery = dto.isHomeDelivery || false;

            const result = await this.shippingService.calculateDeliveryFee(
                dto.deliveryLocation?.lat || 0,
                dto.deliveryLocation?.lng || 0,
                dto.deliveryMethod,
                country,
                totalWeight,
                isHomeDelivery
            );

            if (result.error) {
                // For international shipping, if weight is not enough, this might happen.
                // However, the checkout should have validated this.
                this.logger.warn(`Shipping error for order ${orderNumber}: ${result.error}`);
            }

            shippingFee = result.fee || 0;
            shippingDetails = {
                baseRatePerKg: result.baseFee,
                surcharge: result.surcharge,
                deliveryTime: result.deliveryTime,
                isInternational: result.isInternational || false,
                country: result.country || country
            };
        }

        // Handle point redemption
        let finalAmount = dto.totalAmount + shippingFee;
        if (dto.redeemPoints && dto.pointsToRedeem > 0 && finalCustomerId) {
            const user = await this.userModel.findById(finalCustomerId);
            if (user && user.points >= dto.pointsToRedeem) {
                const discount = dto.pointsToRedeem;
                finalAmount = Math.max(0, finalAmount - discount);
                user.points -= dto.pointsToRedeem;
                await user.save();
            }
        }

        const order = await this.orderModel.create({
            ...dto,
            shippingFee,
            totalWeight,
            shippingDetails,
            totalAmount: finalAmount,
            orderNumber,
            customerId: new Types.ObjectId(finalCustomerId),
            status: OrderStatus.PENDING,
            paymentStatus: PaymentStatus.PENDING,
            staffCode: dto.staffCode || undefined,
            wsspCoordinatorId: undefined, // Setup by auto-assignment or manual claim later
            invoiceGeneratedAt: new Date()
        });
        
        // Auto-assign WSSP Coordinator if a merchantId exists and a user is a coordinator for this merchant
        if (order.merchantId) {
            const coordinator = await this.userModel.findOne({ isCoordinator: true, merchantId: order.merchantId });
            if (coordinator) {
                order.wsspCoordinatorId = coordinator._id;
                await order.save();
                this.logger.log(`Auto-assigned order ${order.orderNumber} to coordinator ${coordinator._id}`);
            }
        }
        
        return { message: 'Order created', data: order };
    }

    async findAll(paginationDto: PaginationDto, filters?: any) {
        const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', search } = paginationDto;
        const skip = ((page as any) - 1) * (limit as any);
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
                .skip(skip).limit(limit as any).lean(),
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

        // Delivery-specific status validation
        if (order.deliveryMethod === 'pickup' && [OrderStatus.SHIPPED].includes(status)) {
            throw new Error(`Status ${status} is not valid for pickup orders`);
        }

        order.status = status;

        if (status === OrderStatus.CONFIRMED && !order.confirmedAt) {
            order.confirmedAt = new Date();
        }

        if (status === OrderStatus.PROCESSING && !order.processingAt) {
            order.processingAt = new Date();
        }

        if (status === OrderStatus.READY_FOR_PICKUP && !order.readyForPickupAt) {
            order.readyForPickupAt = new Date();
        }

        if (status === OrderStatus.WAYBILLED && !order.waybilledAt) {
            order.waybilledAt = new Date();
        }
        
        if (status === OrderStatus.COMPLETED) {
            order.completedAt = new Date();

            // Award Loyalty Points: 1 point per 100 base units (e.g. NGN)
            const pointsEarned = Math.floor(order.totalAmount / 100);
            if (pointsEarned > 0) {
                await this.userModel.findByIdAndUpdate(order.customerId, {
                    $inc: { points: pointsEarned }
                });
                this.logger.log(`User ${order.customerId} earned ${pointsEarned} loyalty points for Order ${order._id}`);
            }

            if (order.paymentStatus === PaymentStatus.PAID) {
                // Partner/Merchant Referrals
                if (order.merchantId || order.partnerId) {
                    await this.commissionsService.calculateCommission(
                        order._id.toString(),
                        order.totalAmount,
                        order.merchantId?.toString(),
                        order.partnerId?.toString(),
                    );
                }
                
                // Trigger Staff Commission Logic
                if (order.staffCode) {
                    await this.commissionsService.calculateStaffCommission(
                        order._id.toString(),
                        order.totalAmount,
                        order.staffCode
                    );
                }
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
        const order = await this.orderModel.findById(id);
        if (!order) throw new NotFoundException('Order not found');

        order.paymentStatus = paymentStatus;
        if (paymentReference) order.paymentReference = paymentReference;
        if (paymentProvider) order.paymentProvider = paymentProvider as PaymentProvider;

        // Automatically confirm order on successful payment
        if (paymentStatus === PaymentStatus.PAID) {
            order.status = OrderStatus.CONFIRMED;
            if (!order.confirmedAt) order.confirmedAt = new Date();
            this.logger.log(`Order ${order.orderNumber} confirmed via successful payment`);
        }

        await order.save();

        // If payment is confirmed and order is completed, trigger commission
        if (paymentStatus === PaymentStatus.PAID && order.status === OrderStatus.COMPLETED) {
            if (order.merchantId || order.partnerId) {
                await this.commissionsService.calculateCommission(
                    order._id.toString(), order.totalAmount,
                    order.merchantId?.toString(), order.partnerId?.toString(),
                );
            }
            if (order.staffCode) {
                await this.commissionsService.calculateStaffCommission(
                    order._id.toString(), order.totalAmount, order.staffCode
                );
            }
        }

        // WSSP Commission Execution on Payment Confirmed
        if (paymentStatus === PaymentStatus.PAID && order.merchantId && order.wsspCoordinatorId) {
            await this.commissionsService.calculateWsspCommission(
                order._id.toString(),
                order.totalAmount,
                order.wsspCoordinatorId.toString(),
                order.invoiceGeneratedAt || (order as any).createdAt
            );
        }

        return { message: 'Payment status updated', data: order };
    }

    async bulkUpdateStatus(ids: string[], status: OrderStatus) {
        const results = await Promise.all(ids.map(id => this.updateStatus(id, status)));
        return { message: `${ids.length} orders updated successfully`, data: results };
    }

    async completeOrder(id: string) {
        const order = await this.orderModel.findByIdAndUpdate(id, { status: 'completed', completedAt: new Date() }, { new: true });

        // Trigger AI Recommendation & Lead Scoring Update
        if (order) {
            // Logic to update user leadScore and recommendedProducts via AI
        }

        return order;
    }

    async attachReferral(orderId: string, merchantId: string, referralCode: string) {
        return this.orderModel.findByIdAndUpdate(orderId, {
            merchantId: new Types.ObjectId(merchantId),
            referralCode,
        }, { new: true });
    }

    async claimInvoice(coordinatorId: string, orderNumber: string) {
        const order = await this.orderModel.findOne({ orderNumber });
        if (!order) throw new NotFoundException('Order/Invoice not found');

        const coordinator = await this.userModel.findById(coordinatorId);
        if (!coordinator || !coordinator.isCoordinator) {
            throw new BadRequestException('User is not a registered coordinator');
        }

        if (order.wsspCoordinatorId) {
            if (order.wsspCoordinatorId.toString() === coordinatorId) {
                return { message: 'You have already claimed this invoice', data: order };
            }
            throw new BadRequestException('This invoice has been claimed by another coordinator');
        }

        if (order.paymentStatus === PaymentStatus.PAID) {
            throw new BadRequestException('Cannot claim an invoice that has already been paid');
        }

        order.wsspCoordinatorId = new Types.ObjectId(coordinatorId);
        await order.save();

        this.logger.log(`Coordinator ${coordinatorId} claimed invoice ${orderNumber}`);
        return { message: 'Invoice claimed successfully', data: order };
    }

    async getMyOrders(userId: string, paginationDto: PaginationDto) {
        // Check if user is a merchant, partner, or specifically a coordinator
        const [user, merchant, partner] = await Promise.all([
            this.userModel.findById(userId).lean() as any,
            this.userModel.db.model('Merchant').findOne({ userId: new Types.ObjectId(userId) }).lean() as any,
            this.userModel.db.model('Partner').findOne({ userId: new Types.ObjectId(userId) }).lean() as any,
        ]);

        if (user?.isCoordinator) {
            // Priority view for coordinators: show their claimed invoices
            return this.findAll(paginationDto, { wsspCoordinatorId: new Types.ObjectId(userId) });
        }

        if (merchant) {
            return this.findAll(paginationDto, { merchantId: merchant._id });
        } else if (partner) {
            return this.findAll(paginationDto, { partnerId: partner._id });
        }

        return this.findAll(paginationDto, { customerId: userId });
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

    async getStaffLeaderboard() {
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        return this.orderModel.aggregate([
            {
                $match: {
                    staffCode: { $exists: true, $ne: null },
                    paymentStatus: PaymentStatus.PAID,
                    createdAt: { $gte: startOfMonth }
                }
            },
            {
                $group: {
                    _id: '$staffCode',
                    totalSalesAmount: { $sum: '$totalAmount' },
                    totalOrders: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: 'staffCode',
                    as: 'staffDetails'
                }
            },
            {
                $unwind: {
                    path: '$staffDetails',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    _id: 1,
                    totalSalesAmount: 1,
                    totalOrders: 1,
                    staffName: '$staffDetails.fullName',
                    avatar: '$staffDetails.avatar'
                }
            },
            { $sort: { totalSalesAmount: -1 } },
            { $limit: 10 }
        ]);
    }

    async submitPaymentProof(id: string, proofUrl: string) {
        const order = await this.orderModel.findById(id);
        if (!order) throw new NotFoundException('Order not found');
        
        order.paymentProof = proofUrl;
        order.paymentProofStatus = 'pending';
        await order.save();
        return { message: 'Payment proof submitted successfully', data: order };
    }

    async verifyPaymentProof(id: string, status: 'verified' | 'rejected') {
        const order = await this.orderModel.findById(id);
        if (!order) throw new NotFoundException('Order not found');
        
        order.paymentProofStatus = status;
        if (status === 'verified') {
            order.paymentStatus = PaymentStatus.PAID;
            // Also trigger commission logic if applicable
            if (order.status === OrderStatus.COMPLETED && (order.merchantId || order.partnerId)) {
                await this.commissionsService.calculateCommission(
                    order._id.toString(), order.totalAmount,
                    order.merchantId?.toString(), order.partnerId?.toString(),
                );
            }
        } else {
            order.paymentStatus = PaymentStatus.FAILED;
        }
        
        await order.save();
        return { message: `Payment proof ${status}`, data: order };
    }
}
