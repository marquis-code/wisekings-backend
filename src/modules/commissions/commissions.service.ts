import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Commission, CommissionDocument } from './schemas/commission.schema';
import { CommissionStatus, COMMISSION_RATES, MerchantCategory, UserType } from '@common/constants';
import { PaginationDto, PaginatedResult } from '@common/dto';

@Injectable()
export class CommissionsService {
    private readonly logger = new Logger(CommissionsService.name);

    constructor(
        @InjectModel(Commission.name) private commissionModel: Model<CommissionDocument>,
        @InjectModel('Merchant') private merchantModel: Model<any>,
        @InjectModel('Partner') private partnerModel: Model<any>,
        @InjectModel('Wallet') private walletModel: Model<any>,
    ) { }

    async calculateCommission(orderId: string, orderValue: number, merchantId?: string, partnerId?: string) {
        if (!merchantId && !partnerId) return null;

        let commissionRate: number;
        let ownerId: Types.ObjectId;
        let ownerType: string;

        if (merchantId) {
            const merchant = await this.merchantModel.findById(merchantId).lean();
            if (!merchant) return null;
            commissionRate = (merchant as any).commissionRate;
            ownerId = new Types.ObjectId(merchantId);
            ownerType = 'merchant';
        } else {
            const partner = await this.partnerModel.findById(partnerId).lean();
            if (!partner) return null;
            commissionRate = (partner as any).commissionRate;
            ownerId = new Types.ObjectId(partnerId);
            ownerType = 'partner';
        }

        const commissionAmount = (orderValue * commissionRate) / 100;

        const commission = await this.commissionModel.create({
            orderId: new Types.ObjectId(orderId),
            merchantId: merchantId ? new Types.ObjectId(merchantId) : undefined,
            partnerId: partnerId ? new Types.ObjectId(partnerId) : undefined,
            orderValue,
            commissionRate,
            commissionAmount,
            status: CommissionStatus.APPROVED,
            calculatedAt: new Date(),
            approvedAt: new Date(),
        });

        // Update wallet balance
        await this.walletModel.findOneAndUpdate(
            { ownerId, ownerType },
            {
                $inc: {
                    availableBalance: commissionAmount,
                    totalEarned: commissionAmount,
                },
            },
        );

        // Update merchant/partner stats
        const updateModel = merchantId ? this.merchantModel : this.partnerModel;
        await updateModel.findByIdAndUpdate(ownerId, {
            $inc: {
                totalSalesValue: orderValue,
                totalOrdersReferred: 1,
                monthlySalesValue: orderValue,
            },
        });

        this.logger.log(`Commission ₦${commissionAmount} calculated for order ${orderId}`);
        return commission;
    }

    async calculateStaffCommission(orderId: string, orderValue: number, staffCode: string) {
        if (!staffCode) return null;

        const User = this.commissionModel.db.model('User');
        const SystemSettings = this.commissionModel.db.model('SystemSettings');

        const staff = await User.findOne({ staffCode, isStaff: true, isActive: true }).lean() as any;
        if (!staff) return null;

        const settings = await SystemSettings.findOne().lean() as any;
        const rate = settings?.staffCommissionRate || 3; // Default 3%

        const commissionAmount = (orderValue * rate) / 100;

        const commission = await this.commissionModel.create({
            orderId: new Types.ObjectId(orderId),
            userId: staff._id,
            staffCode,
            orderValue,
            commissionRate: rate,
            commissionAmount,
            status: CommissionStatus.APPROVED,
            calculatedAt: new Date(),
            approvedAt: new Date(),
        });

        // Update staff wallet
        await this.walletModel.findOneAndUpdate(
            { ownerId: staff._id, ownerType: 'user' },
            {
                $inc: {
                    availableBalance: commissionAmount,
                    totalEarned: commissionAmount,
                },
            },
            { upsert: true, new: true }
        );

        this.logger.log(`Staff Commission ₦${commissionAmount} calculated for order ${orderId} (Staff: ${staffCode})`);
        return commission;
    }

    async calculateWsspCommission(orderId: string, orderValue: number, coordinatorId: string, invoiceGeneratedAt: Date) {
        if (!coordinatorId || !invoiceGeneratedAt) return null;

        const User = this.commissionModel.db.model('User');
        const coordinator = await User.findById(coordinatorId).lean() as any;
        if (!coordinator || !coordinator.isCoordinator) return null;

        // Calculate days delta
        const paymentDate = new Date();
        const invoiceDate = new Date(invoiceGeneratedAt);
        const daysDiff = Math.ceil(Math.abs(paymentDate.getTime() - invoiceDate.getTime()) / (1000 * 3600 * 24));

        let rate = 0;
        if (daysDiff <= 7) rate = 1.00;
        else if (daysDiff <= 14) rate = 0.75;
        else if (daysDiff <= 21) rate = 0.50;
        else rate = 0.25;

        const commissionAmount = (orderValue * rate) / 100;

        const commission = await this.commissionModel.create({
            orderId: new Types.ObjectId(orderId),
            userId: coordinator._id,
            orderValue,
            commissionRate: rate,
            commissionAmount,
            status: CommissionStatus.APPROVED,
            calculatedAt: new Date(),
            approvedAt: new Date(),
            notes: `WSSP Tier: Paid in ${daysDiff} days`
        });

        // Update coordinator wallet
        await this.walletModel.findOneAndUpdate(
            { ownerId: coordinator._id, ownerType: 'user' },
            {
                $inc: {
                    availableBalance: commissionAmount,
                    totalEarned: commissionAmount,
                },
            },
            { upsert: true, new: true }
        );

        this.logger.log(`WSSP Commission ₦${commissionAmount} (Rate: ${rate}%) calculated for order ${orderId} (Coordinator: ${coordinatorId})`);
        return commission;
    }

    async reverseCommission(orderId: string, reason: string) {
        const commission = await this.commissionModel.findOne({
            orderId: new Types.ObjectId(orderId),
            status: { $in: [CommissionStatus.APPROVED, CommissionStatus.PENDING] },
        });

        if (!commission) return null;

        commission.status = CommissionStatus.REVERSED;
        commission.reversedAt = new Date();
        commission.reversalReason = reason;
        await commission.save();

        // Deduct from wallet
        const ownerId = commission.merchantId || commission.partnerId;
        const ownerType = commission.merchantId ? 'merchant' : 'partner';
        await this.walletModel.findOneAndUpdate(
            { ownerId, ownerType },
            { $inc: { availableBalance: -commission.commissionAmount, totalEarned: -commission.commissionAmount } },
        );

        this.logger.log(`Commission reversed for order ${orderId}: ${reason}`);
        return commission;
    }

    async findAll(paginationDto: PaginationDto, filters?: any) {
        const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = paginationDto;
        const skip = (Number(page) - 1) * Number(limit);
        const filter: any = {};
        if (filters?.merchantId) filter.merchantId = new Types.ObjectId(filters.merchantId);
        if (filters?.partnerId) filter.partnerId = new Types.ObjectId(filters.partnerId);
        if (filters?.status) filter.status = filters.status;

        const [data, total] = await Promise.all([
            this.commissionModel.find(filter)
                .populate('orderId', 'orderNumber totalAmount')
                .populate('merchantId', 'merchantCode fullName')
                .populate('partnerId', 'partnerCode companyName')
                .sort({ [sortBy as string]: sortOrder === 'asc' ? 1 : -1 })
                .skip(skip).limit(limit).lean(),
            this.commissionModel.countDocuments(filter),
        ]);
        return new PaginatedResult(data as any[], total, page, limit);
    }

    async findByUser(userId: string, paginationDto: PaginationDto) {
        const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = paginationDto;
        const skip = (Number(page) - 1) * Number(limit);

        // Find merchant or partner by userId
        const [user, merchant, partner] = await Promise.all([
            this.commissionModel.db.model('User').findById(userId).lean() as any,
            this.merchantModel.findOne({ userId: new Types.ObjectId(userId) }).lean(),
            this.partnerModel.findOne({ userId: new Types.ObjectId(userId) }).lean(),
        ]);

        const filter: any = {};
        if (user?.isStaff || user?.isCoordinator) {
            filter.userId = new Types.ObjectId(userId);
        } else if (merchant) {
            filter.merchantId = (merchant as any)._id;
        } else if (partner) {
            filter.partnerId = (partner as any)._id;
        } else {
            // No matching profile — return empty
            return new PaginatedResult([], 0, page, limit);
        }

        const [data, total] = await Promise.all([
            this.commissionModel.find(filter)
                .populate('orderId', 'orderNumber totalAmount')
                .sort({ [sortBy as string]: sortOrder === 'asc' ? 1 : -1 })
                .skip(skip).limit(limit).lean(),
            this.commissionModel.countDocuments(filter),
        ]);
        return new PaginatedResult(data as any[], total, page, limit);
    }

    async getSummary(ownerId?: string, ownerType?: string) {
        const filter: any = {};
        if (ownerId && ownerType === 'merchant') filter.merchantId = new Types.ObjectId(ownerId);
        if (ownerId && ownerType === 'partner') filter.partnerId = new Types.ObjectId(ownerId);

        const [totalEarned, totalPending, totalPaid, totalReversed] = await Promise.all([
            this.commissionModel.aggregate([{ $match: { ...filter, status: CommissionStatus.APPROVED } }, { $group: { _id: null, total: { $sum: '$commissionAmount' } } }]),
            this.commissionModel.aggregate([{ $match: { ...filter, status: CommissionStatus.PENDING } }, { $group: { _id: null, total: { $sum: '$commissionAmount' } } }]),
            this.commissionModel.aggregate([{ $match: { ...filter, status: CommissionStatus.PAID } }, { $group: { _id: null, total: { $sum: '$commissionAmount' } } }]),
            this.commissionModel.aggregate([{ $match: { ...filter, status: CommissionStatus.REVERSED } }, { $group: { _id: null, total: { $sum: '$commissionAmount' } } }]),
        ]);

        return {
            totalEarned: totalEarned[0]?.total || 0,
            totalPending: totalPending[0]?.total || 0,
            totalPaid: totalPaid[0]?.total || 0,
            totalReversed: totalReversed[0]?.total || 0,
        };
    }

    async adjustCommission(id: string, newAmount: number, reason: string) {
        const commission = await this.commissionModel.findById(id);
        if (!commission) throw new NotFoundException('Commission not found');

        const diff = newAmount - commission.commissionAmount;
        commission.commissionAmount = newAmount;
        await commission.save();

        const ownerId = commission.merchantId || commission.partnerId;
        const ownerType = commission.merchantId ? 'merchant' : 'partner';
        await this.walletModel.findOneAndUpdate(
            { ownerId, ownerType },
            { $inc: { availableBalance: diff, totalEarned: diff } },
        );

        return { message: 'Commission adjusted', data: commission };
    }
}
