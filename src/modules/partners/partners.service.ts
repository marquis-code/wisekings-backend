import {
    Injectable,
    ConflictException,
    NotFoundException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Partner, PartnerDocument } from './schemas/partner.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { UserType, PartnerStatus } from '@common/constants';
import { PaginationDto, PaginatedResult } from '@common/dto';
import { EncryptionUtil } from '@common/utils';

@Injectable()
export class PartnersService {
    private readonly logger = new Logger(PartnersService.name);

    constructor(
        @InjectModel(Partner.name) private partnerModel: Model<PartnerDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        @InjectModel('Wallet') private walletModel: Model<any>,
    ) { }

    async register(dto: any) {
        const existing = await this.partnerModel.findOne({ email: dto.email.toLowerCase() });
        if (existing) throw new ConflictException('Partner email already registered');

        const hashedPassword = await bcrypt.hash(dto.password, 12);
        const user = await this.userModel.create({
            email: dto.email.toLowerCase(),
            password: hashedPassword,
            fullName: dto.contactPerson,
            phone: dto.phone,
            userType: UserType.PARTNER,
            role: 'user',
        });

        const partnerCode = await this.generatePartnerCode(dto.companyName);
        const bankDetails = dto.bankAccountDetails
            ? {
                bankName: dto.bankAccountDetails.bankName,
                accountNumber: EncryptionUtil.encrypt(dto.bankAccountDetails.accountNumber),
                accountName: dto.bankAccountDetails.accountName,
            }
            : undefined;

        const partner = await this.partnerModel.create({
            userId: user._id,
            partnerCode,
            companyName: dto.companyName,
            contactPerson: dto.contactPerson,
            phone: dto.phone,
            email: dto.email.toLowerCase(),
            bankAccountDetails: bankDetails,
            category: dto.category || 'standard',
            commissionRate: dto.commissionRate || 3,
            status: PartnerStatus.PENDING,
            referralLink: `https://wisekings.ng/?ref=${partnerCode}`,
            companyAddress: dto.companyAddress,
            registrationNumber: dto.registrationNumber,
            agreedToTerms: dto.agreedToTerms || false,
        });

        await this.walletModel.create({ ownerId: partner._id, ownerType: 'partner' });

        return {
            message: 'Partner registration successful, awaiting approval',
            data: { partnerId: partner._id, partnerCode, referralLink: partner.referralLink },
        };
    }

    async findAll(paginationDto: PaginationDto, filters?: any) {
        const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', search } = paginationDto;
        const skip = (page - 1) * limit;
        const filter: any = {};
        if (search) {
            filter.$or = [
                { companyName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { partnerCode: { $regex: search, $options: 'i' } },
            ];
        }
        if (filters?.status) filter.status = filters.status;

        const [data, total] = await Promise.all([
            this.partnerModel.find(filter)
                .populate('userId', 'email fullName')
                .sort({ [sortBy as string]: sortOrder === 'asc' ? 1 : -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            this.partnerModel.countDocuments(filter),
        ]);
        return new PaginatedResult(data as any[], total, page, limit);
    }

    async findById(id: string) {
        const partner = await this.partnerModel.findById(id).populate('userId', 'email fullName avatar').lean();
        if (!partner) throw new NotFoundException('Partner not found');
        if (partner.bankAccountDetails?.accountNumber) {
            partner.bankAccountDetails.accountNumber = EncryptionUtil.decrypt(partner.bankAccountDetails.accountNumber);
        }
        return partner;
    }

    async findByUserId(userId: string) {
        const partner = await this.partnerModel.findOne({ userId: new Types.ObjectId(userId) }).lean();
        if (!partner) throw new NotFoundException('Partner profile not found');
        return partner;
    }

    async getDashboard(userId: string) {
        const partner = await this.findByUserId(userId);
        const wallet = await this.walletModel.findOne({ ownerId: partner._id, ownerType: 'partner' }).lean();
        return {
            data: {
                partner: { partnerCode: partner.partnerCode, category: partner.category, commissionRate: partner.commissionRate, status: partner.status, referralLink: partner.referralLink },
                stats: { totalOrdersReferred: partner.totalOrdersReferred, totalSalesValue: partner.totalSalesValue },
                wallet: wallet ? { availableBalance: (wallet as any).availableBalance, pendingBalance: (wallet as any).pendingBalance, totalEarned: (wallet as any).totalEarned, totalWithdrawn: (wallet as any).totalWithdrawn } : null,
            },
        };
    }

    async update(id: string, dto: any) {
        const partner = await this.partnerModel.findByIdAndUpdate(id, dto, { new: true }).lean();
        if (!partner) throw new NotFoundException('Partner not found');
        return { message: 'Partner updated successfully', data: partner };
    }

    async approve(id: string) {
        const partner = await this.partnerModel.findByIdAndUpdate(id, { status: PartnerStatus.ACTIVE }, { new: true });
        if (!partner) throw new NotFoundException('Partner not found');
        await this.userModel.findByIdAndUpdate(partner.userId, { isActive: true });
        return { message: 'Partner approved' };
    }

    async suspend(id: string, reason: string) {
        const partner = await this.partnerModel.findByIdAndUpdate(id, { status: PartnerStatus.SUSPENDED, suspendedAt: new Date(), suspendedReason: reason }, { new: true });
        if (!partner) throw new NotFoundException('Partner not found');
        await this.userModel.findByIdAndUpdate(partner.userId, { isActive: false });
        return { message: 'Partner suspended' };
    }

    private async generatePartnerCode(name: string): Promise<string> {
        const prefix = name.substring(0, 3).toUpperCase();
        let code = '';
        let exists = true;
        while (exists) {
            const random = Math.floor(1000 + Math.random() * 9000);
            code = `WKP-${prefix}-${random}`;
            exists = !!(await this.partnerModel.findOne({ partnerCode: code }));
        }
        return code;
    }
}
