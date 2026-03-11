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

import { MailService } from '../mail/mail.service';
import * as QRCode from 'qrcode';

@Injectable()
export class PartnersService {
    private readonly logger = new Logger(PartnersService.name);

    constructor(
        @InjectModel(Partner.name) private partnerModel: Model<PartnerDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        @InjectModel('Wallet') private walletModel: Model<any>,
        private readonly mailService: MailService,
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

    async findByUserId(userId: string): Promise<Partner> {
        let partner = await this.partnerModel.findOne({ userId: new Types.ObjectId(userId) }).lean();

        if (!partner) {
            // Auto-create partner profile if user is a partner but has no profile
            const user = await this.userModel.findById(userId);
            if (user && user.userType === UserType.PARTNER) {
                this.logger.log(`Auto-creating partner profile for user ${userId}`);
                const partnerCode = await this.generatePartnerCode(user.fullName || 'WK');
                const newPartner = await this.partnerModel.create({
                    userId: user._id,
                    partnerCode,
                    companyName: user.fullName || 'My Company',
                    contactPerson: user.fullName,
                    phone: user.phone || '',
                    email: user.email,
                    status: PartnerStatus.ACTIVE,
                    referralLink: `https://wisekings.ng/?ref=${partnerCode}`,
                });

                await this.walletModel.create({ ownerId: newPartner._id, ownerType: 'partner' });
                partner = newPartner.toObject() as any;
            } else {
                throw new NotFoundException('Partner profile not found');
            }
        }
        return partner as unknown as Partner;
    }

    async getDashboard(userId: string) {
        const partner = await this.findByUserId(userId);
        const wallet = await this.walletModel.findOne({ ownerId: (partner as any)._id, ownerType: 'partner' }).lean();

        // Fetch total referrals count
        const totalReferrals = await this.userModel.countDocuments({
            referredBy: (partner as any).partnerCode
        });

        // Fetch recent referrals
        const recentReferrals = await this.userModel.find({
            referredBy: (partner as any).partnerCode
        }).select('fullName email createdAt').sort({ createdAt: -1 }).limit(5).lean();

        return {
            data: {
                partner: {
                    partnerCode: partner.partnerCode,
                    category: partner.category,
                    commissionRate: partner.commissionRate,
                    status: partner.status,
                    referralLink: partner.referralLink,
                    companyName: partner.companyName
                },
                stats: {
                    totalOrdersReferred: partner.totalOrdersReferred || 0,
                    totalSalesValue: partner.totalSalesValue || 0,
                    totalReferrals
                },
                wallet: wallet ? {
                    availableBalance: (wallet as any).availableBalance,
                    pendingBalance: (wallet as any).pendingBalance,
                    totalEarned: (wallet as any).totalEarned,
                    totalWithdrawn: (wallet as any).totalWithdrawn
                } : null,
                recentReferrals
            },
        };
    }

    async getNetwork(userId: string) {
        const partner = await this.findByUserId(userId);
        // Implementation for network tiers
        return {
            success: true,
            data: {
                tier1: [],
                tier2: [],
                summary: { totalActive: 0, totalInactive: 0 }
            }
        };
    }

    async getReferrals(userId: string) {
        const partner = await this.findByUserId(userId);
        return {
            success: true,
            data: []
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

    async submitKyc(userId: string, kycData: { idType: string; idNumber: string; idDocumentUrl: string }) {
        const partner = await this.partnerModel.findOne({ userId: new Types.ObjectId(userId) });
        if (!partner) throw new NotFoundException('Partner profile not found');

        partner.kyc = {
            ...kycData,
            status: 'pending',
            submittedAt: new Date(),
        };

        await partner.save();
        return { message: 'KYC documents submitted successfully', data: (partner as any).kyc };
    }

    async updateKycStatus(id: string, status: 'approved' | 'rejected', reason?: string) {
        const partner = await this.partnerModel.findById(id).populate('userId');
        if (!partner) throw new NotFoundException('Partner not found');

        partner.kyc.status = status;
        partner.kyc.verifiedAt = new Date();
        if (reason) partner.kyc.rejectionReason = reason;

        await partner.save();

        const user = partner.userId as any;
        await this.userModel.findByIdAndUpdate(user._id, { applicationStatus: status });

        // Send email notification
        try {
            await this.mailService.sendKycStatusUpdate(user.email, user.fullName, status, reason);
        } catch (err) {
            this.logger.error(`Failed to send KYC email for partner: ${err.message}`);
        }

        return { message: `KYC ${status} successfully`, data: (partner as any).kyc };
    }

    async getReferralQrCode(userId: string): Promise<string> {
        const partner = await this.partnerModel.findOne({ userId: new Types.ObjectId(userId) }).lean();
        if (!partner) throw new NotFoundException('Partner profile not found');

        const link = partner.referralLink || `https://wisekings.ng/?ref=${partner.partnerCode}`;
        try {
            const qrCodeDataUrl = await QRCode.toDataURL(link, {
                margin: 2,
                scale: 10,
                color: {
                    dark: '#033958',
                    light: '#ffffff',
                },
            });
            return qrCodeDataUrl;
        } catch (err) {
            this.logger.error(`Failed to generate QR code for partner: ${err.message}`);
            throw new BadRequestException('Could not generate QR code');
        }
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
