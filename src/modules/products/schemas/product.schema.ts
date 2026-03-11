import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProductDocument = Product & Document;

@Schema({ timestamps: true, collection: 'products' })
export class Product {
    @Prop({ type: Map, of: String, required: true })
    name: Map<string, string>;

    @Prop({ type: Map, of: String, required: true })
    description: Map<string, string>;

    @Prop({ required: true, min: 0 })
    price: number;

    @Prop()
    compareAtPrice: number;

    @Prop({ type: [String], default: [] })
    images: string[];

    @Prop({ type: Types.ObjectId, ref: 'Category' })
    category: Types.ObjectId;

    @Prop({ default: 0, min: 0 })
    stock: number;

    @Prop({ default: true })
    isActive: boolean;

    @Prop({ trim: true })
    sku: string;

    @Prop({ default: 0, min: 0 })
    weight: number;

    @Prop({ type: Object })
    dimensions: {
        length: number;
        width: number;
        height: number;
    };

    @Prop({ type: [String], default: [] })
    tags: string[];

    @Prop({ required: true, unique: true, lowercase: true, trim: true })
    slug: string;

    @Prop({ default: 0 })
    totalSold: number;

    @Prop({ default: 0 })
    avgRating: number;

    @Prop({ default: 0 })
    reviewCount: number;

    // AI Scaling Fields
    @Prop({ default: 0 })
    demandForecast: number;

    @Prop()
    nextReplenishmentDate: Date;

    @Prop({ default: 0 })
    recommendedOrderQuantity: number;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.index({ category: 1 });
ProductSchema.index({ isActive: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ name: 'text', description: 'text', tags: 'text' });
