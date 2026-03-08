import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { WithdrawalStatus } from '@common/constants';

export type WalletDocument = Wallet & Document;

@Schema({ timestamps: true, collection: 'wallets' })
export class Wallet {
    @Prop({ type: Types.ObjectId, required: true })
    ownerId: Types.ObjectId;

    @Prop({ required: true, enum: ['merchant', 'partner'] })
    ownerType: string;

    @Prop({ default: 0, min: 0 })
    availableBalance: number;

    @Prop({ default: 0, min: 0 })
    pendingBalance: number;

    @Prop({ default: 0 })
    totalEarned: number;

    @Prop({ default: 0 })
    totalWithdrawn: number;

    @Prop({ default: 0 })
    totalBonuses: number;
}

export const WalletSchema = SchemaFactory.createForClass(Wallet);

WalletSchema.index({ ownerId: 1, ownerType: 1 }, { unique: true });

// Withdrawal Schema
export type WithdrawalDocument = Withdrawal & Document;

@Schema({ timestamps: true, collection: 'withdrawals' })
export class Withdrawal {
    @Prop({ type: Types.ObjectId, ref: 'Wallet', required: true })
    walletId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, required: true })
    requestedBy: Types.ObjectId;

    @Prop({ required: true, min: 10000 })
    amount: number;

    @Prop({ type: Object, required: true })
    bankDetails: {
        bankName: string;
        accountNumber: string;
        accountName: string;
    };

    @Prop({ type: String, enum: WithdrawalStatus, default: WithdrawalStatus.PENDING })
    status: WithdrawalStatus;

    @Prop()
    requestedAt: Date;

    @Prop()
    processedAt: Date;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    processedBy: Types.ObjectId;

    @Prop()
    rejectionReason: string;

    @Prop()
    transactionReference: string;
}

export const WithdrawalSchema = SchemaFactory.createForClass(Withdrawal);

WithdrawalSchema.index({ walletId: 1 });
WithdrawalSchema.index({ requestedBy: 1 });
WithdrawalSchema.index({ status: 1 });
WithdrawalSchema.index({ createdAt: -1 });
