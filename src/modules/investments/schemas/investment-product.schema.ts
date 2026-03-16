import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type InvestmentProductDocument = InvestmentProduct & Document;

@Schema({ timestamps: true })
export class InvestmentProduct {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  roiPercentage: number; // e.g., 15 for 15%

  @Prop({ required: true })
  durationInMonths: number;

  @Prop({ required: true, default: 0 })
  pricePerSlot: number;

  @Prop({ required: true, default: 0 })
  totalSlots: number;

  @Prop({ default: 0 })
  slotsPurchased: number;

  @Prop({ default: 'active', enum: ['active', 'closed', 'completed'] })
  status: string;

  @Prop({ default: 'medium', enum: ['low', 'medium', 'high'] })
  riskLevel: string;

  @Prop()
  category: string; // e.g., Real Estate, Agriculture, Snacks

  @Prop()
  image?: string;

  @Prop()
  startDate?: Date;

  @Prop()
  maturityDate?: Date;
}

export const InvestmentProductSchema = SchemaFactory.createForClass(InvestmentProduct);
