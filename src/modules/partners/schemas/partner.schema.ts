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

    @Prop({ trim: true })
    companyName: string;

    @Prop({ required: true, trim: true })
    contactPerson: string;

    @Prop({ trim: true })
    phone: string;

    @Prop({ required: true, unique: true, lowercase: true, trim: true })
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

    @Prop({
        type: {
            documents: [{
                documentType: { type: String, required: true },
                documentLabel: { type: String, required: true },
                idNumber: { type: String, default: '' },
                documentUrl: { type: String, default: '' },
                status: { type: String, enum: ['not_submitted', 'pending', 'approved', 'rejected'], default: 'not_submitted' },
                isRequired: { type: Boolean, default: true },
                requiresIdNumber: { type: Boolean, default: true },
                requiresFileUpload: { type: Boolean, default: true },
                rejectionReason: { type: String },
                submittedAt: { type: Date },
                verifiedAt: { type: Date },
            }],
            status: { type: String, enum: ['not_submitted', 'pending', 'approved', 'rejected'], default: 'not_submitted' },
        },
        default: { documents: [], status: 'not_submitted' },
    })
    kyc: {
        documents: {
            documentType: string;
            documentLabel: string;
            idNumber: string;
            documentUrl: string;
            status: 'not_submitted' | 'pending' | 'approved' | 'rejected';
            isRequired: boolean;
            requiresIdNumber: boolean;
            requiresFileUpload: boolean;
            rejectionReason?: string;
            submittedAt?: Date;
            verifiedAt?: Date;
        }[];
        status: 'not_submitted' | 'pending' | 'approved' | 'rejected';
    };

    @Prop({ type: String, enum: ['standard', 'gold', 'diamond'], default: 'standard' })
    tier: string;

    @Prop({ default: 0 })
    totalInvested: number;

    @Prop({ default: 0 })
    equityPercentage: number;

    @Prop()
    suspendedAt: Date;

    @Prop()
    suspendedReason: string;
}

export const PartnerSchema = SchemaFactory.createForClass(Partner);

PartnerSchema.index({ userId: 1 });
PartnerSchema.index({ status: 1 });
