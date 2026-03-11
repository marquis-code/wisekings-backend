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
    ) { }

    async register(dto: RegisterMerchantDto) {
        // Check for existing merchant by email
        const existingMerchant = await this.merchantModel.findOne({
            email: dto.email.toLowerCase(),
        });
        if (existingMerchant) {
            throw new ConflictException('A merchant with this email already exists');
        }

        if (!dto.agreedToTerms) {
            throw new BadRequestException('You must agree to the terms and conditions');
        }

        // Create user account
        const existingUser = await this.userModel.findOne({
            email: dto.email.toLowerCase(),
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
                email: dto.email.toLowerCase(),
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
            email: dto.email.toLowerCase(),
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
        if (filters?.status) filter.status = filters.status;
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

    async findByUserId(userId: string) {
        const merchant = await this.merchantModel
            .findOne({ userId: new Types.ObjectId(userId) })
            .lean();

        if (!merchant) {
            throw new NotFoundException('Merchant profile not found');
        }
        return merchant;
    }

    async findOrCreateByUserId(userId: string) {
        let merchant = await this.merchantModel
            .findOne({ userId: new Types.ObjectId(userId) })
            .lean();

        if (!merchant) {
            // Auto-create merchant profile for users who registered via /auth/register
            const user = await this.userModel.findById(userId).lean();
            if (!user) {
                throw new NotFoundException('User not found');
            }

            // Check if a merchant already exists with this email (to avoid duplicate key error)
            merchant = await this.merchantModel.findOne({ email: user.email.toLowerCase() }).lean();

            if (merchant) {
                // If merchant exists but with different userId (or no userId), link it
                await this.merchantModel.findByIdAndUpdate(merchant._id, {
                    userId: new Types.ObjectId(userId)
                });
                merchant = await this.merchantModel.findById(merchant._id).lean();
            } else {
                const merchantCode = await this.generateMerchantCode(user.fullName || 'Merchant');

                const newMerchant = await this.merchantModel.create({
                    userId: new Types.ObjectId(userId),
                    merchantCode,
                    fullName: user.fullName || 'Merchant',
                    phone: (user as any).phone || '',
                    email: user.email.toLowerCase(),
                    category: MerchantCategory.STANDARD,
                    commissionRate: COMMISSION_RATES[MerchantCategory.STANDARD],
                    status: MerchantStatus.ACTIVE,
                    referralLink: `https://wisekings.ng/?ref=${merchantCode}`,
                });
                merchant = newMerchant.toObject() as any;
            }

            // Create wallet for merchant if it doesn't exist
            await this.walletModel.create({
                ownerId: (merchant as any)._id,
                ownerType: 'merchant',
            }).catch(() => { /* wallet may already exist */ });
        }

        return { data: merchant };
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
        const result = await this.findOrCreateByUserId(userId);
        const merchant = result.data!;
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

    async submitKyc(userId: string, kycData: { idType: string; idNumber: string; idDocumentUrl: string }) {
        const merchant = await this.merchantModel.findOne({ userId: new Types.ObjectId(userId) });
        if (!merchant) throw new NotFoundException('Merchant profile not found');

        merchant.kyc = {
            ...kycData,
            status: 'pending',
            submittedAt: new Date(),
        };

        await merchant.save();
        return { message: 'KYC documents submitted successfully', data: merchant.kyc };
    }

    async updateKycStatus(id: string, status: 'approved' | 'rejected', reason?: string) {
        const merchant = await this.merchantModel.findById(id).populate('userId');
        if (!merchant) throw new NotFoundException('Merchant not found');

        merchant.kyc.status = status;
        merchant.kyc.verifiedAt = new Date();
        if (reason) merchant.kyc.rejectionReason = reason;

        await merchant.save();

        const user = merchant.userId as any;
        await this.userModel.findByIdAndUpdate(user._id, { applicationStatus: status });

        // Send email notification
        try {
            await this.mailService.sendKycStatusUpdate(user.email, user.fullName, status, reason);
        } catch (err) {
            this.logger.error(`Failed to send KYC email: ${err.message}`);
        }

        return { message: `KYC ${status} successfully`, data: merchant.kyc };
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
