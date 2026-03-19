import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type GiftingDocument = Gifting & Document;

@Schema({ timestamps: true })
export class Gifting {
  @Prop({ type: Object, required: true })
  senderDetails: {
    name: string;
    email: string;
    phone: string;
  };

  @Prop({ type: Object, required: true })
  recipientDetails: {
    name: string;
    phone: string;
    address: string;
    country: string;
    occasion: string;
  };

  @Prop([{
    product: { type: Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true }
  }])
  products: {
    product: Types.ObjectId;
    quantity: number;
    // We can also store names/prices historically if needed, 
    // but ref is usually enough for an active catalogue.
  }[];

  @Prop({ type: String, required: false })
  specialInstructions?: string;

  @Prop({ 
    type: String, 
    enum: ['pending', 'approved', 'rejected', 'paid', 'shipped'],
    default: 'pending' 
  })
  status: string;

  @Prop({ type: Object, default: { productsCost: 0, shippingFee: 0, totalCost: 0 } })
  pricing: {
    productsCost: number;
    shippingFee: number;
    totalCost: number;
  };

  @Prop({ type: String, required: false })
  receiptUrl?: string;
}

export const GiftingSchema = SchemaFactory.createForClass(Gifting);
