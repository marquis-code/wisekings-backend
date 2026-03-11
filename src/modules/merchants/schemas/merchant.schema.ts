import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { MerchantCategory, MerchantRank, MerchantStatus } from '@common/constants';

export type MerchantDocument = Merchant & Document;

@Schema({ timestamps: true, collection: 'merchants' })
export class Merchant {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    userId: Types.ObjectId;

    @Prop({ required: true, unique: true, trim: true })
    merchantCode: string;

    @Prop({ required: true, trim: true })
    fullName: string;

    @Prop({ trim: true, default: '' })
    phone: string;

    @Prop({ required: true, unique: true, lowercase: true, trim: true })
    email: string;

    @Prop({ type: Object })
    bankAccountDetails: {
        bankName: string;
        accountNumber: string; // encrypted
        accountName: string;
    };

    @Prop({ type: String, enum: MerchantCategory, default: MerchantCategory.STANDARD })
    category: MerchantCategory;

    @Prop({ type: Number, default: 3 })
    commissionRate: number;

    @Prop({ type: String, enum: MerchantStatus, default: MerchantStatus.PENDING })
    status: MerchantStatus;

    @Prop()
    referralLink: string;

    @Prop({ default: 0 })
    totalSalesValue: number;

    @Prop({ default: 0 })
    totalOrdersReferred: number;

    @Prop({ default: 0 })
    monthlySalesValue: number;

    @Prop({ type: String, enum: MerchantRank, default: MerchantRank.STARTER })
    rank: MerchantRank;

    @Prop()
    rankBadge: string;

    @Prop({ default: false })
    agreedToTerms: boolean;

    @Prop()
    termsAgreedAt: Date;

    @Prop()
    suspendedAt: Date;

    @Prop()
    suspendedReason: string;

    @Prop()
    lastRankUpdateAt: Date;

    @Prop()
    lastCategoryUpgradeAt: Date;
    @Prop({
        type: {
            status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
            idType: { type: String },
            idNumber: { type: String },
            idDocumentUrl: { type: String },
            rejectionReason: { type: String },
            submittedAt: { type: Date },
            verifiedAt: { type: Date },
        },
        default: { status: 'pending' },
    })
    kyc: {
        status: string;
        idType?: string;
        idNumber?: string;
        idDocumentUrl?: string;
        rejectionReason?: string;
        submittedAt?: Date;
        verifiedAt?: Date;
    };
}

export const MerchantSchema = SchemaFactory.createForClass(Merchant);

MerchantSchema.index({ userId: 1 });
MerchantSchema.index({ status: 1 });
MerchantSchema.index({ category: 1 });
MerchantSchema.index({ rank: 1 });
MerchantSchema.index({ totalSalesValue: -1 });
