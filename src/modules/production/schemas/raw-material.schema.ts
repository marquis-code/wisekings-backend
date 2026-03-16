import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RawMaterialDocument = RawMaterial & Document;

@Schema({ timestamps: true })
export class RawMaterial {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  unit: string; // kg, liters, pcs

  @Prop({ required: true, default: 0 })
  costPerUnit: number;

  @Prop({ default: 0 })
  currentStock: number;

  @Prop()
  description?: string;
}

export const RawMaterialSchema = SchemaFactory.createForClass(RawMaterial);
