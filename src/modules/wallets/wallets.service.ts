import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Wallet, WalletDocument, Withdrawal, WithdrawalDocument } from './schemas/wallet.schema';
import { WithdrawalStatus, MIN_WITHDRAWAL_AMOUNT } from '@common/constants';
import { PaginationDto, PaginatedResult } from '@common/dto';
import { EncryptionUtil } from '@common/utils';

@Injectable()
export class WalletsService {
    private readonly logger = new Logger(WalletsService.name);

    constructor(
        @InjectModel('Wallet') private walletModel: Model<WalletDocument>,
        @InjectModel('Withdrawal') private withdrawalModel: Model<WithdrawalDocument>,
    ) { }

    async getWallet(ownerId: string, ownerType: string) {
        const wallet = await this.walletModel.findOne({ ownerId: new Types.ObjectId(ownerId), ownerType }).lean();
        if (!wallet) throw new NotFoundException('Wallet not found');
        return wallet;
    }

    async getMyWallet(userId: string) {
        // Find merchant or partner profile for the user
        const [merchant, partner] = await Promise.all([
            this.walletModel.db.model('Merchant').findOne({ userId: new Types.ObjectId(userId) }).lean() as any,
            this.walletModel.db.model('Partner').findOne({ userId: new Types.ObjectId(userId) }).lean() as any,
        ]);

        const ownerId = merchant?._id || partner?._id;
        const ownerType = merchant ? 'merchant' : (partner ? 'partner' : null);

        if (!ownerId) {
            // If profile not found, it might need auto-creation (happens in their respective services)
            // But for now, we throw a clearer 404. 
            // Better: Let's check if we can at least find the user and their type.
            const user = await this.walletModel.db.model('User').findById(userId).lean() as any;
            if (user?.userType === 'partner' || user?.userType === 'merchant') {
                throw new NotFoundException(`Please visit your dashboard first to initialize your ${user.userType} profile.`);
            }
            throw new NotFoundException('Merchant or Partner profile not found');
        }

        const wallet = await this.walletModel.findOne({ ownerId, ownerType }).lean();
        if (!wallet) throw new NotFoundException('Wallet not found');
        return wallet;
    }

    async requestWithdrawal(userId: string, amount: number, bankDetails: any) {
        if (amount < MIN_WITHDRAWAL_AMOUNT) {
            throw new BadRequestException(`Minimum withdrawal amount is ₦${MIN_WITHDRAWAL_AMOUNT.toLocaleString()}`);
        }

        // Find user's wallet via their merchant/partner profile
        const wallet = await this.walletModel.findOne({
            $or: [
                { ownerId: new Types.ObjectId(userId), ownerType: 'merchant' },
                { ownerId: new Types.ObjectId(userId), ownerType: 'partner' },
            ],
        });

        if (!wallet) throw new NotFoundException('Wallet not found');
        if (wallet.availableBalance < amount) {
            throw new BadRequestException('Insufficient balance');
        }

        // Check for pending withdrawals
        const pendingWithdrawal = await this.withdrawalModel.findOne({
            walletId: wallet._id,
            status: WithdrawalStatus.PENDING,
        });
        if (pendingWithdrawal) {
            throw new BadRequestException('You already have a pending withdrawal request');
        }

        // Move amount to pending
        wallet.availableBalance -= amount;
        wallet.pendingBalance += amount;
        await wallet.save();

        const withdrawal = await this.withdrawalModel.create({
            walletId: wallet._id,
            requestedBy: new Types.ObjectId(userId),
            amount,
            bankDetails: {
                bankName: bankDetails.bankName,
                accountNumber: EncryptionUtil.encrypt(bankDetails.accountNumber),
                accountName: bankDetails.accountName,
            },
            status: WithdrawalStatus.PENDING,
            requestedAt: new Date(),
        });

        this.logger.log(`Withdrawal request ₦${amount} by user ${userId}`);
        return { message: 'Withdrawal request submitted', data: withdrawal };
    }

    async approveWithdrawal(withdrawalId: string, adminId: string) {
        const withdrawal = await this.withdrawalModel.findById(withdrawalId);
        if (!withdrawal) throw new NotFoundException('Withdrawal not found');
        if (withdrawal.status !== WithdrawalStatus.PENDING) {
            throw new BadRequestException('Withdrawal is not pending');
        }

        withdrawal.status = WithdrawalStatus.APPROVED;
        withdrawal.processedAt = new Date();
        withdrawal.processedBy = new Types.ObjectId(adminId);
        await withdrawal.save();

        // Move from pending to withdrawn
        await this.walletModel.findByIdAndUpdate(withdrawal.walletId, {
            $inc: { pendingBalance: -withdrawal.amount, totalWithdrawn: withdrawal.amount },
        });

        return { message: 'Withdrawal approved' };
    }

    async markAsPaid(withdrawalId: string, reference: string) {
        const withdrawal = await this.withdrawalModel.findByIdAndUpdate(
            withdrawalId,
            { status: WithdrawalStatus.PAID, transactionReference: reference },
            { new: true },
        );
        if (!withdrawal) throw new NotFoundException('Withdrawal not found');
        return { message: 'Withdrawal marked as paid', data: withdrawal };
    }

    async rejectWithdrawal(withdrawalId: string, adminId: string, reason: string) {
        const withdrawal = await this.withdrawalModel.findById(withdrawalId);
        if (!withdrawal) throw new NotFoundException('Withdrawal not found');
        if (withdrawal.status !== WithdrawalStatus.PENDING) {
            throw new BadRequestException('Withdrawal is not pending');
        }

        withdrawal.status = WithdrawalStatus.REJECTED;
        withdrawal.processedAt = new Date();
        withdrawal.processedBy = new Types.ObjectId(adminId);
        withdrawal.rejectionReason = reason;
        await withdrawal.save();

        // Return amount to available balance
        await this.walletModel.findByIdAndUpdate(withdrawal.walletId, {
            $inc: { pendingBalance: -withdrawal.amount, availableBalance: withdrawal.amount },
        });

        return { message: 'Withdrawal rejected, funds returned' };
    }

    async getWithdrawals(paginationDto: PaginationDto, filters?: any) {
        const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = paginationDto;
        const skip = (Number(page) - 1) * Number(limit);
        const filter: any = {};
        if (filters?.status) filter.status = filters.status;
        if (filters?.requestedBy) filter.requestedBy = new Types.ObjectId(filters.requestedBy);

        const [data, total] = await Promise.all([
            this.withdrawalModel.find(filter)
                .populate('requestedBy', 'email fullName')
                .populate('processedBy', 'email fullName')
                .sort({ [sortBy as string]: sortOrder === 'asc' ? 1 : -1 })
                .skip(skip)
                .limit(limit as any)
                .lean(),
            this.withdrawalModel.countDocuments(filter),
        ]);

        // Decrypt bank details
        for (const item of data) {
            if (item.bankDetails?.accountNumber) {
                item.bankDetails.accountNumber = EncryptionUtil.decrypt(item.bankDetails.accountNumber);
            }
        }

        return new PaginatedResult(data as any[], total, page, limit);
    }

    async getMyWithdrawals(userId: string, paginationDto: PaginationDto) {
        return this.getWithdrawals(paginationDto, { requestedBy: userId });
    }
}
