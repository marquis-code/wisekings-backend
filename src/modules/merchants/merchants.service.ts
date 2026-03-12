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
import { Merchant, MerchantDocument } from './schemas/merchant.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { WalletDocument } from '../wallets/schemas/wallet.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { RegisterMerchantDto, UpdateMerchantDto } from './dto/merchant.dto';
import {
    UserType,
    MerchantCategory,
    MerchantStatus,
    MerchantRank,
    COMMISSION_RATES,
    CATEGORY_UPGRADE_THRESHOLDS,
    RANK_THRESHOLDS,
} from '../../common/constants';
import { PaginationDto, PaginatedResult } from '../../common/dto';
import { EncryptionUtil } from '../../common/utils';

import { MailService } from '../mail/mail.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import * as QRCode from 'qrcode';

@Injectable()
export class MerchantsService {
    private readonly logger = new Logger(MerchantsService.name);

    constructor(
        @InjectModel(Merchant.name) private merchantModel: Model<MerchantDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        @InjectModel('Wallet') private walletModel: Model<WalletDocument>,
        @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
        private readonly mailService: MailService,
        private readonly systemSettingsService: SystemSettingsService,
    ) { }

    async register(dto: RegisterMerchantDto) {
        const email = dto.email.toLowerCase().trim();
        // Check for existing merchant by email
        const existingMerchant = await this.merchantModel.findOne({
            email,
        });
        if (existingMerchant) {
            throw new ConflictException('A merchant with this email already exists');
        }

        if (!dto.agreedToTerms) {
            throw new BadRequestException('You must agree to the terms and conditions');
        }

        // Create user account
        const existingUser = await this.userModel.findOne({
            email,
        });
        let userId: Types.ObjectId;

        if (existingUser) {
            // Update existing user to merchant type
            await this.userModel.findByIdAndUpdate(existingUser._id, {
                userType: UserType.MERCHANT,
            });
            userId = existingUser._id as Types.ObjectId;
        } else {
            const hashedPassword = await bcrypt.hash(dto.password, 12);
            const user = await this.userModel.create({
                email,
                password: hashedPassword,
                fullName: dto.fullName,
                phone: dto.phone,
                userType: UserType.MERCHANT,
                role: 'user',
            });
            userId = user._id as Types.ObjectId;
        }

        // Generate unique merchant code
        const merchantCode = await this.generateMerchantCode(dto.fullName);

        // Encrypt bank account number
        const bankDetails = {
            bankName: dto.bankAccountDetails.bankName,
            accountNumber: EncryptionUtil.encrypt(dto.bankAccountDetails.accountNumber),
            accountName: dto.bankAccountDetails.accountName,
        };

        const commissionRate = COMMISSION_RATES[dto.category];

        // Create merchant
        const merchant = await this.merchantModel.create({
            userId,
            merchantCode,
            fullName: dto.fullName,
            phone: dto.phone,
            email,
            bankAccountDetails: bankDetails,
            category: dto.category,
            commissionRate,
            status: MerchantStatus.ACTIVE,
            referralLink: `https://wisekings.ng/?ref=${merchantCode}`,
            agreedToTerms: true,
            termsAgreedAt: new Date(),
        });

        // Create wallet for merchant
        await this.walletModel.create({
            ownerId: merchant._id,
            ownerType: 'merchant',
        });

        return {
            message: 'Merchant registration successful',
            data: {
                merchantId: merchant._id,
                merchantCode: merchant.merchantCode,
                referralLink: merchant.referralLink,
                category: merchant.category,
                commissionRate: merchant.commissionRate,
            },
        };
    }

    async findAll(paginationDto: PaginationDto, filters?: any) {
        const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', search } = paginationDto;
        const skip = (page - 1) * limit;

        const filter: any = {};
        if (search) {
            filter.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { merchantCode: { $regex: search, $options: 'i' } },
            ];
        }
        if (filters?.status) {
            if (filters.status === 'pending') {
                filter.$or = filter.$or || [];
                filter.$or.push({ status: 'pending' }, { 'kyc.status': 'pending' });
            } else {
                filter.status = filters.status;
            }
        }
        if (filters?.kycStatus) {
            if (filters.kycStatus === 'submitted') {
                filter['kyc.status'] = { $ne: 'not_submitted' };
            } else {
                filter['kyc.status'] = filters.kycStatus;
            }
        }
        if (filters?.category) filter.category = filters.category;
        if (filters?.rank) filter.rank = filters.rank;

        const [data, total] = await Promise.all([
            this.merchantModel
                .find(filter)
                .populate('userId', 'email fullName avatar')
                .sort({ [sortBy as string]: sortOrder === 'asc' ? 1 : -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            this.merchantModel.countDocuments(filter),
        ]);

        return new PaginatedResult(data as any[], total, page, limit);
    }

    async findById(id: string) {
        const merchant = await this.merchantModel
            .findById(id)
            .populate('userId', 'email fullName avatar lastLogin')
            .lean();

        if (!merchant) {
            throw new NotFoundException('Merchant not found');
        }

        // Decrypt bank account number for display
        if (merchant.bankAccountDetails?.accountNumber) {
            merchant.bankAccountDetails.accountNumber = EncryptionUtil.decrypt(
                merchant.bankAccountDetails.accountNumber,
            );
        }

        return merchant;
    }

    async findByCode(code: string) {
        const merchant = await this.merchantModel
            .findOne({ merchantCode: code, status: MerchantStatus.ACTIVE })
            .lean();

        if (!merchant) {
            throw new NotFoundException('Merchant not found or inactive');
        }
        return merchant;
    }

    async findByUserId(userId: string): Promise<MerchantDocument> {
        const merchant = await this.merchantModel
            .findOne({ userId: new Types.ObjectId(userId) });

        if (!merchant) {
            throw new NotFoundException('Merchant profile not found');
        }
        return merchant;
    }

    async findOrCreateByUserId(userId: string): Promise<MerchantDocument> {
        let merchant = await this.merchantModel
            .findOne({ userId: new Types.ObjectId(userId) });

        if (!merchant) {
            // Auto-create merchant profile for users who registered via /auth/register
            const user = await this.userModel.findById(userId);
            if (!user) {
                throw new NotFoundException('User not found');
            }

            const merchantCode = `WKM-${user.fullName?.substring(0, 3).toUpperCase() || 'WK'}-${Math.floor(1000 + Math.random() * 9000)}`;
            
            merchant = await this.merchantModel.create({
                userId: user._id,
                merchantCode,
                businessName: user.fullName || 'My Business',
                email: user.email,
                phone: user.phone || '',
                status: MerchantStatus.ACTIVE,
                category: MerchantCategory.STANDARD,
                rank: MerchantRank.STARTER,
                commissionRate: COMMISSION_RATES[MerchantCategory.STANDARD],
                referralLink: `https://wisekings.ng/?ref=${merchantCode}`,
            });

            // Create wallet for merchant
            await this.walletModel.create({ ownerId: merchant._id, ownerType: 'merchant' }).catch(() => {});
        }

        return merchant;
    }

    async updateByUserId(userId: string, dto: UpdateMerchantDto) {
        const merchant = await this.merchantModel.findOne({ userId: new Types.ObjectId(userId) });
        if (!merchant) {
            throw new NotFoundException('Merchant profile not found');
        }

        const updateData: any = { ...dto };
        if (dto.category) {
            updateData.commissionRate = COMMISSION_RATES[dto.category];
        }
        if (dto.bankAccountDetails?.accountNumber) {
            updateData.bankAccountDetails = {
                ...dto.bankAccountDetails,
                accountNumber: EncryptionUtil.encrypt(dto.bankAccountDetails.accountNumber),
            };
        }

        const updated = await this.merchantModel
            .findByIdAndUpdate(merchant._id, updateData, { new: true })
            .lean();

        return { message: 'Profile updated successfully', data: updated };
    }

    async getReferrals(userId: string, paginationDto: PaginationDto) {
        const merchant = await this.merchantModel
            .findOne({ userId: new Types.ObjectId(userId) })
            .lean();

        if (!merchant) {
            return new PaginatedResult([], 0, paginationDto.page || 1, paginationDto.limit || 10);
        }

        const { page = 1, limit = 10 } = paginationDto;
        const skip = (page - 1) * limit;

        const filter = { merchantId: (merchant as any)._id };
        const [data, total] = await Promise.all([
            this.orderModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            this.orderModel.countDocuments(filter),
        ]);
        return new PaginatedResult(data as any[], total, page, limit);
    }

    async getDashboard(userId: string) {
        const merchant = await this.findOrCreateByUserId(userId);
        const wallet = await this.walletModel
            .findOne({ ownerId: (merchant as any)._id, ownerType: 'merchant' })
            .lean();

        return {
            data: {
                merchant: {
                    merchantCode: merchant.merchantCode,
                    category: merchant.category,
                    commissionRate: merchant.commissionRate,
                    rank: merchant.rank,
                    status: merchant.status,
                    referralLink: merchant.referralLink,
                },
                stats: {
                    totalOrdersReferred: merchant.totalOrdersReferred,
                    totalSalesValue: merchant.totalSalesValue,
                    monthlySalesValue: merchant.monthlySalesValue,
                },
                wallet: wallet
                    ? {
                        availableBalance: wallet.availableBalance,
                        pendingBalance: wallet.pendingBalance,
                        totalEarned: wallet.totalEarned,
                        totalWithdrawn: wallet.totalWithdrawn,
                    }
                    : null,
            },
        };
    }

    async update(id: string, dto: UpdateMerchantDto) {
        const updateData: any = { ...dto };

        if (dto.category) {
            updateData.commissionRate = COMMISSION_RATES[dto.category];
        }

        if (dto.bankAccountDetails?.accountNumber) {
            updateData.bankAccountDetails = {
                ...dto.bankAccountDetails,
                accountNumber: EncryptionUtil.encrypt(dto.bankAccountDetails.accountNumber),
            };
        }

        const merchant = await this.merchantModel
            .findByIdAndUpdate(id, updateData, { new: true })
            .lean();

        if (!merchant) {
            throw new NotFoundException('Merchant not found');
        }

        return { message: 'Merchant updated successfully', data: merchant };
    }

    async suspend(id: string, reason: string) {
        const merchant = await this.merchantModel.findByIdAndUpdate(
            id,
            {
                status: MerchantStatus.SUSPENDED,
                suspendedAt: new Date(),
                suspendedReason: reason,
            },
            { new: true },
        );

        if (!merchant) {
            throw new NotFoundException('Merchant not found');
        }

        // Deactivate user account
        await this.userModel.findByIdAndUpdate(merchant.userId, { isActive: false });

        return { message: 'Merchant suspended successfully' };
    }

    async activate(id: string) {
        const merchant = await this.merchantModel.findByIdAndUpdate(
            id,
            {
                status: MerchantStatus.ACTIVE,
                suspendedAt: null,
                suspendedReason: null,
            },
            { new: true },
        );

        if (!merchant) {
            throw new NotFoundException('Merchant not found');
        }

        await this.userModel.findByIdAndUpdate(merchant.userId, { isActive: true });

        return { message: 'Merchant activated successfully' };
    }

    async checkCategoryUpgrade(merchantId: string) {
        const merchant = await this.merchantModel.findById(merchantId);
        if (!merchant) return;

        let upgraded = false;
        const sales = merchant.totalSalesValue;

        if (
            merchant.category === MerchantCategory.STANDARD &&
            sales >= CATEGORY_UPGRADE_THRESHOLDS[MerchantCategory.GOLD]
        ) {
            merchant.category = MerchantCategory.GOLD;
            merchant.commissionRate = COMMISSION_RATES[MerchantCategory.GOLD];
            upgraded = true;
        } else if (
            merchant.category === MerchantCategory.GOLD &&
            sales >= CATEGORY_UPGRADE_THRESHOLDS[MerchantCategory.PREMIUM]
        ) {
            merchant.category = MerchantCategory.PREMIUM;
            merchant.commissionRate = COMMISSION_RATES[MerchantCategory.PREMIUM];
            upgraded = true;
        }

        if (upgraded) {
            merchant.lastCategoryUpgradeAt = new Date();
            await merchant.save();
            this.logger.log(
                `Merchant ${merchant.merchantCode} upgraded to ${merchant.category}`,
            );
        }

        return upgraded;
    }

    async updateRank(merchantId: string) {
        const merchant = await this.merchantModel.findById(merchantId);
        if (!merchant) return;

        const monthlySales = merchant.monthlySalesValue;
        let newRank = MerchantRank.STARTER;

        for (const [rank, threshold] of Object.entries(RANK_THRESHOLDS)) {
            if (monthlySales >= threshold.min && monthlySales <= threshold.max) {
                newRank = rank as MerchantRank;
                break;
            }
        }

        if (newRank !== merchant.rank) {
            merchant.rank = newRank;
            merchant.lastRankUpdateAt = new Date();
            await merchant.save();
            this.logger.log(
                `Merchant ${merchant.merchantCode} rank updated to ${newRank}`,
            );
        }
    }

    async getStats() {
        const [total, active, suspended, pending] = await Promise.all([
            this.merchantModel.countDocuments(),
            this.merchantModel.countDocuments({ status: MerchantStatus.ACTIVE }),
            this.merchantModel.countDocuments({ status: MerchantStatus.SUSPENDED }),
            this.merchantModel.countDocuments({ status: MerchantStatus.PENDING }),
        ]);

        const categoryStats = await this.merchantModel.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } },
        ]);

        const rankStats = await this.merchantModel.aggregate([
            { $group: { _id: '$rank', count: { $sum: 1 } } },
        ]);

        return { total, active, suspended, pending, categoryStats, rankStats };
    }

    // --- Multi-Document KYC ---

    async initializeKycDocuments(merchant: MerchantDocument): Promise<MerchantDocument> {
        if (!merchant.kyc || !merchant.kyc.documents || merchant.kyc.documents.length === 0) {
            const user = await this.userModel.findById(merchant.userId).lean();
            const userCountry = user?.country || '';

            const settings = await this.systemSettingsService.getSettings();
            const docTypes = settings.kycDocumentTypes || [];
            
            // Filter by target and country
            const filteredDocs = docTypes.filter(dt => {
                const targetMatch = dt.target === 'merchant' || dt.target === 'both';
                const countryMatch = dt.countries.length === 0 || dt.countries.includes(userCountry);
                return targetMatch && countryMatch;
            });

            merchant.kyc = {
                documents: filteredDocs.map(dt => ({
                    documentType: dt.value,
                    documentLabel: dt.label,
                    isRequired: dt.isRequired,
                    requiresIdNumber: (dt as any).requiresIdNumber !== undefined ? (dt as any).requiresIdNumber : true,
                    requiresFileUpload: (dt as any).requiresFileUpload !== undefined ? (dt as any).requiresFileUpload : true,
                    idNumber: '',
                    documentUrl: '',
                    status: 'not_submitted' as const,
                })),
                status: 'not_submitted',
            };
            await merchant.save();
        }
        return merchant;
    }

    getOverallKycStatus(merchant: any): string {
        const docs = merchant?.kyc?.documents || [];
        if (docs.length === 0) return 'not_submitted';
        
        // Filter compulsory documents
        const compulsoryDocs = docs.filter((d: any) => d.isRequired === true);
        
        // If all compulsory docs are approved, then overall is approved
        if (compulsoryDocs.every((d: any) => d.status === 'approved')) return 'approved';
        
        // If any document is rejected, show rejected
        if (docs.some((d: any) => d.status === 'rejected')) return 'rejected';
        
        // If any compulsory doc is pending or not submitted
        if (compulsoryDocs.some((d: any) => d.status === 'pending')) return 'pending';
        
        return 'not_submitted';
    }

    async submitKycDocument(userId: string, docData: { documentType: string; idNumber: string; documentUrl: string }) {
        const merchant = await this.merchantModel.findOne({ userId: new Types.ObjectId(userId) }).populate('userId');
        if (!merchant) throw new NotFoundException('Merchant profile not found');

        await this.initializeKycDocuments(merchant);

        const docIndex = merchant.kyc.documents.findIndex(d => d.documentType === docData.documentType);
        if (docIndex === -1) throw new BadRequestException(`Document type '${docData.documentType}' not found in KYC requirements`);

        merchant.kyc.documents[docIndex].idNumber = docData.idNumber;
        merchant.kyc.documents[docIndex].documentUrl = docData.documentUrl;
        merchant.kyc.documents[docIndex].status = 'pending';
        merchant.kyc.documents[docIndex].submittedAt = new Date();
        merchant.kyc.documents[docIndex].rejectionReason = undefined;

        merchant.kyc.status = this.getOverallKycStatus(merchant) as any;
        merchant.markModified('kyc');
        await merchant.save();

        const user = merchant.userId as any;
        if (user && user.email) {
            try {
                await this.mailService.sendKycSubmittedEmail(user.email, user.fullName || 'Merchant');
            } catch (err) {
                this.logger.error(`Failed to send KYC submission email: ${err.message}`);
            }
        }

        return { message: 'Document submitted successfully', data: merchant.kyc };
    }

    async updateKycDocumentStatus(id: string, documentType: string, status: 'approved' | 'rejected', reason?: string) {
        const merchant = await this.merchantModel.findById(id).populate('userId');
        if (!merchant) throw new NotFoundException('Merchant not found');

        const docIndex = merchant.kyc.documents.findIndex(d => d.documentType === documentType);
        if (docIndex === -1) throw new BadRequestException(`Document type '${documentType}' not found`);

        merchant.kyc.documents[docIndex].status = status;
        merchant.kyc.documents[docIndex].verifiedAt = new Date();
        if (reason) merchant.kyc.documents[docIndex].rejectionReason = reason;

        merchant.kyc.status = this.getOverallKycStatus(merchant) as any;
        merchant.markModified('kyc');
        await merchant.save();

        const overallStatus = this.getOverallKycStatus(merchant);
        const user = merchant.userId as any;
        if (overallStatus === 'approved') {
            await this.userModel.findByIdAndUpdate(user._id, { applicationStatus: 'approved' });
        }

        try {
            const docLabel = merchant.kyc.documents[docIndex].documentLabel;
            await this.mailService.sendKycStatusUpdate(user.email, user.fullName, status, reason ? `${docLabel}: ${reason}` : docLabel);
        } catch (err) {
            this.logger.error(`Failed to send KYC email: ${err.message}`);
        }

        return { message: `Document ${status} successfully`, data: merchant.kyc };
    }

    async getReferralQrCode(userId: string): Promise<string> {
        const merchant = await this.merchantModel.findOne({ userId: new Types.ObjectId(userId) }).lean();
        if (!merchant) throw new NotFoundException('Merchant profile not found');

        const link = merchant.referralLink || `https://wisekings.ng/?ref=${merchant.merchantCode}`;
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
            this.logger.error(`Failed to generate QR code: ${err.message}`);
            throw new BadRequestException('Could not generate QR code');
        }
    }

    private async generateMerchantCode(fullName: string): Promise<string> {
        const initials = fullName
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);

        let code = '';
        let exists = true;

        while (exists) {
            const random = Math.floor(1000 + Math.random() * 9000);
            code = `WK-${initials}-${random}`;
            exists = !!(await this.merchantModel.findOne({ merchantCode: code }));
        }

        return code;
    }
}
