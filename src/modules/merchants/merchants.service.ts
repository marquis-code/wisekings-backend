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
import { Wallet, WalletDocument } from '../wallets/schemas/wallet.schema';
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

@Injectable()
export class MerchantsService {
    private readonly logger = new Logger(MerchantsService.name);

    constructor(
        @InjectModel(Merchant.name) private merchantModel: Model<MerchantDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        @InjectModel('Wallet') private walletModel: Model<WalletDocument>,
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

    async getDashboard(userId: string) {
        const merchant = await this.findByUserId(userId);
        const wallet = await this.walletModel
            .findOne({ ownerId: merchant._id, ownerType: 'merchant' })
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
