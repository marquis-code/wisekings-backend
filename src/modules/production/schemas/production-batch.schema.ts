import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProductionBatchDocument = ProductionBatch & Document;

@Schema()
class ConsumedMaterial {
  @Prop({ type: Types.ObjectId, ref: 'RawMaterial', required: true })
  materialId: Types.ObjectId;

  @Prop({ required: true })
  weight: number; // Consumption weight

  @Prop({ required: true })
  cost: number; // Cost at time of production
}

@Schema({ timestamps: true })
export class ProductionBatch {
  @Prop({ required: true })
  batchNumber: string;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ type: [ConsumedMaterial], default: [] })
  materials: ConsumedMaterial[];

  @Prop({ required: true, default: 0 })
  quantityProduced: number; // Number of SKUs

  @Prop({ required: true, default: 0 })
  sellingPricePerUnit: number;

  @Prop({ default: 0 })
  totalProductionCost: number;

  @Prop({ default: 0 })
  revenue: number;

  @Prop({ default: 0 })
  profit: number;

  @Prop({ default: 0 })
  marginPercentage: number;

  @Prop({ default: 'completed', enum: ['pending', 'completed', 'cancelled'] })
  status: string;

  @Prop()
  notes?: string;
}

export const ProductionBatchSchema = SchemaFactory.createForClass(ProductionBatch);
