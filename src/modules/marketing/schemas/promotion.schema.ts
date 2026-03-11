import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PromotionDocument = Promotion & Document;

@Schema({ timestamps: true, collection: 'promotions' })
export class Promotion {
    @Prop({ required: true, trim: true })
    title: string;

    @Prop()
    description: string;

    @Prop()
    image: string;

    @Prop({ enum: ['sale', 'gifting', 'holiday', 'special', 'new_arrival'], default: 'sale' })
    type: string;

    @Prop({ type: [{ type: Types.ObjectId, ref: 'Product' }], default: [] })
    products: Types.ObjectId[];

    @Prop()
    discountPercentage: number;

    @Prop({ default: true })
    isActive: boolean;

    @Prop({ default: 0 })
    sortOrder: number;

    @Prop()
    startDate: Date;

    @Prop()
    endDate: Date;

    @Prop()
    badgeText: string;

    @Prop()
    badgeColor: string;
}

export const PromotionSchema = SchemaFactory.createForClass(Promotion);
PromotionSchema.index({ isActive: 1, type: 1 });
