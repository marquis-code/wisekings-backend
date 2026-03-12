import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type InvestmentProposalDocument = InvestmentProposal & Document;

@Schema({ timestamps: true, collection: 'investment_proposals' })
export class InvestmentProposal {
    @Prop({ required: true, trim: true })
    title: string;

    @Prop({ required: true })
    description: string;

    @Prop({ type: String, enum: ['gold', 'diamond'], required: true })
    category: string;

    @Prop({ required: true, min: 0 })
    targetAmount: number;

    @Prop({ default: 0 })
    raisedAmount: number;

    @Prop({ required: true, min: 0 })
    minInvestment: number;

    @Prop({ type: Number }) // For Gold: e.g., 5 for 5%
    interestRate: number;

    @Prop({ type: Number }) // For Gold: e.g., 60 days
    durationDays: number;

    @Prop({ type: Number }) // For Diamond: % of company offered
    equityOffered: number;

    @Prop({ type: String, enum: ['open', 'closed', 'draft'], default: 'draft' })
    status: string;

    @Prop([String])
    tags: string[];
}

export const InvestmentProposalSchema = SchemaFactory.createForClass(InvestmentProposal);
