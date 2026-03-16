import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PurchaseOrderDocument = PurchaseOrder & Document;

@Schema()
class POItem {
  @Prop({ required: true })
  description: string;

  @Prop({ required: true, default: 1 })
  quantity: number;

  @Prop({ required: true, default: 0 })
  unitPrice: number;

  @Prop({ default: 0 })
  total: number;
}

@Schema({ timestamps: true })
export class PurchaseOrder {
  @Prop({ required: true })
  poNumber: string;

  @Prop({ required: true })
  vendorName: string;

  @Prop()
  vendorEmail?: string;

  @Prop()
  vendorPhone?: string;

  @Prop({ type: [POItem], default: [] })
  items: POItem[];

  @Prop({ default: 0 })
  totalAmount: number;

  @Prop({ default: 'pending', enum: ['pending', 'approved', 'paid', 'cancelled'] })
  status: string;

  @Prop()
  notes?: string;

  @Prop()
  dueDate?: Date;
}

export const PurchaseOrderSchema = SchemaFactory.createForClass(PurchaseOrder);
