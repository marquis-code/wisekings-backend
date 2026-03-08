import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReferralDocument = Referral & Document;

@Schema({ timestamps: true, collection: 'referrals' })
export class Referral {
    @Prop({ required: true })
    referralCode: string;

    @Prop({ type: Types.ObjectId, ref: 'Merchant' })
    merchantId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Partner' })
    partnerId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    customerId: Types.ObjectId;

    @Prop()
    sessionId: string;

    @Prop()
    ipAddress: string;

    @Prop()
    landingPage: string;

    @Prop({ type: Types.ObjectId, ref: 'Order' })
    convertedOrderId: Types.ObjectId;

    @Prop({ type: String, enum: ['clicked', 'converted'], default: 'clicked' })
    status: string;

    @Prop()
    cookieExpiry: Date;

    @Prop()
    userAgent: string;
}

export const ReferralSchema = SchemaFactory.createForClass(Referral);

ReferralSchema.index({ referralCode: 1 });
ReferralSchema.index({ merchantId: 1 });
ReferralSchema.index({ partnerId: 1 });
ReferralSchema.index({ customerId: 1 });
ReferralSchema.index({ ipAddress: 1 });
ReferralSchema.index({ status: 1 });
ReferralSchema.index({ createdAt: -1 });
