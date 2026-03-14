import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InvestmentDocument = Investment & Document;

@Schema({ timestamps: true, collection: 'investments' })
export class Investment {
    @Prop({ type: Types.ObjectId, ref: 'Partner', required: true })
    partnerId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'InvestmentProposal', required: true })
    proposalId: Types.ObjectId;

    @Prop({ required: true })
    invoiceNo: string;

    @Prop({ required: true })
    customer: string;

    @Prop({ required: true, min: 0 })
    invoiceValue: number;

    @Prop({ required: true })
    dateIssued: Date;

    @Prop()
    disbursementDate: Date;

    @Prop()
    dueDate: Date;

    @Prop({ type: String, enum: ['pending', 'paid'], default: 'pending' })
    paymentStatus: string;

    @Prop({ default: 0 })
    amountRepaid: number;

    @Prop({ default: 0 })
    investorReturn: number;

    @Prop({ default: 0 })
    realizedReturn: number;

    @Prop({ type: Number })
    interestRateApplied: number;

    @Prop()
    paymentProof: string;

    @Prop({ default: 'stripe' })
    paymentMethod: string;
}

export const InvestmentSchema = SchemaFactory.createForClass(Investment);
