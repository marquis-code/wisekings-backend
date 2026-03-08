import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PartnerStatus } from '@common/constants';

export type PartnerDocument = Partner & Document;

@Schema({ timestamps: true, collection: 'partners' })
export class Partner {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    userId: Types.ObjectId;

    @Prop({ required: true, unique: true, trim: true })
    partnerCode: string;

    @Prop({ required: true, trim: true })
    companyName: string;

    @Prop({ required: true, trim: true })
    contactPerson: string;

    @Prop({ required: true, trim: true })
    phone: string;

    @Prop({ required: true, lowercase: true, trim: true })
    email: string;

    @Prop({ type: Object })
    bankAccountDetails: {
        bankName: string;
        accountNumber: string;
        accountName: string;
    };

    @Prop({ type: String, default: 'standard' })
    category: string;

    @Prop({ type: Number, default: 3 })
    commissionRate: number;

    @Prop({ type: String, enum: PartnerStatus, default: PartnerStatus.PENDING })
    status: PartnerStatus;

    @Prop()
    referralLink: string;

    @Prop({ default: 0 })
    totalSalesValue: number;

    @Prop({ default: 0 })
    totalOrdersReferred: number;

    @Prop()
    companyAddress: string;

    @Prop()
    registrationNumber: string;

    @Prop({ default: false })
    agreedToTerms: boolean;

    @Prop()
    suspendedAt: Date;

    @Prop()
    suspendedReason: string;
}

export const PartnerSchema = SchemaFactory.createForClass(Partner);

PartnerSchema.index({ userId: 1 });
PartnerSchema.index({ partnerCode: 1 }, { unique: true });
PartnerSchema.index({ email: 1 }, { unique: true });
PartnerSchema.index({ status: 1 });
