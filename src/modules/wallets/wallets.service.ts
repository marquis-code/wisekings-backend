import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Wallet, WalletDocument, Withdrawal, WithdrawalDocument, Transaction, TransactionDocument } from './schemas/wallet.schema';
import { WithdrawalStatus, MIN_WITHDRAWAL_AMOUNT } from '@common/constants';
import { PaginationDto, PaginatedResult } from '@common/dto';
import { EncryptionUtil } from '@common/utils';

@Injectable()
export class WalletsService {
    private readonly logger = new Logger(WalletsService.name);

    constructor(
        @InjectModel('Wallet') private walletModel: Model<WalletDocument>,
        @InjectModel('Withdrawal') private withdrawalModel: Model<WithdrawalDocument>,
        @InjectModel('Transaction') private transactionModel: Model<TransactionDocument>,
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
        // Find user's wallet via their merchant/partner/staff profile
        const wallet = await this.walletModel.findOne({
            $or: [
                { ownerId: new Types.ObjectId(userId), ownerType: 'merchant' },
                { ownerId: new Types.ObjectId(userId), ownerType: 'partner' },
                { ownerId: new Types.ObjectId(userId), ownerType: 'user' }, // Staff
            ],
        });

        if (!wallet) throw new NotFoundException('Wallet not found');

        // Threshold Validation
        if (wallet.ownerType === 'user') {
            if (amount < 5000) {
                throw new BadRequestException(`Minimum withdrawal amount for staff is ₦5,000`);
            }
        } else {
            if (amount < MIN_WITHDRAWAL_AMOUNT) {
                throw new BadRequestException(`Minimum withdrawal amount is ₦${MIN_WITHDRAWAL_AMOUNT.toLocaleString()}`);
            }
        }
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

    async requestFunding(userId: string, amount: number, proofUrl: string, description?: string) {
        const [merchant, partner] = await Promise.all([
            this.walletModel.db.model('Merchant').findOne({ userId: new Types.ObjectId(userId) }).lean() as any,
            this.walletModel.db.model('Partner').findOne({ userId: new Types.ObjectId(userId) }).lean() as any,
        ]);

        const ownerId = merchant?._id || partner?._id;
        if (!ownerId) throw new NotFoundException('Profile not found');

        const wallet = await this.walletModel.findOne({ ownerId });
        if (!wallet) throw new NotFoundException('Wallet not found');

        const transaction = await this.transactionModel.create({
            walletId: wallet._id,
            userId: new Types.ObjectId(userId),
            amount,
            type: 'deposit',
            status: 'pending',
            paymentProof: proofUrl,
            description: description || `Wallet funding request for ₦${amount.toLocaleString()}`,
        });

        return { message: 'Funding request submitted', data: transaction };
    }

    async verifyFunding(transactionId: string, status: 'completed' | 'failed', adminId: string) {
        const transaction = await this.transactionModel.findById(transactionId);
        if (!transaction) throw new NotFoundException('Transaction not found');
        if (transaction.status !== 'pending') throw new BadRequestException('Transaction is not pending');

        transaction.status = status;
        if (status === 'completed') {
            await this.walletModel.findByIdAndUpdate(transaction.walletId, {
                $inc: { availableBalance: transaction.amount, totalEarned: transaction.amount }
            });
        }
        
        transaction.metadata = { ...transaction.metadata, verifiedBy: adminId, verifiedAt: new Date() };
        await transaction.save();

        return { message: `Funding request ${status}`, data: transaction };
    }

    async getTransactionHistory(userId: string, paginationDto: PaginationDto) {
        const { page = 1, limit = 10 } = paginationDto;
        const skip = (Number(page) - 1) * Number(limit);
        
        const [data, total] = await Promise.all([
            this.transactionModel.find({ userId: new Types.ObjectId(userId) })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit as any)
                .lean(),
            this.transactionModel.countDocuments({ userId: new Types.ObjectId(userId) }),
        ]);

        return new PaginatedResult(data as any[], total, page, limit);
    }

    async exportStaffSalaryData() {
        // Aggregate all staff wallets with an available balance
        const staffWallets = await this.walletModel.aggregate([
            { $match: { ownerType: 'user', availableBalance: { $gte: 5000 } } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'ownerId',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: '$user' },
            {
                $project: {
                    staffCode: '$user.staffCode',
                    fullName: '$user.fullName',
                    email: '$user.email',
                    phone: '$user.phone',
                    availableBalance: 1,
                }
            }
        ]);

        let csv = 'Staff Code,Full Name,Email,Phone,Add-on Amount\n';
        for (const staff of staffWallets) {
            csv += `"${staff.staffCode || ''}","${staff.fullName}","${staff.email}","${staff.phone || ''}",${staff.availableBalance}\n`;
        }

        return { csv, count: staffWallets.length, raw: staffWallets };
    }
}
