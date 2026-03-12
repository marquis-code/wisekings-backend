import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CategoryDocument = Category & Document;

@Schema({ timestamps: true, collection: 'categories' })
export class Category {
    @Prop({ type: Map, of: String, required: true })
    name: Map<string, string>;

    @Prop({ type: Map, of: String })
    description: Map<string, string>;

    @Prop()
    image: string;

    @Prop({ type: Types.ObjectId, ref: 'Category', default: null })
    parentCategory: Types.ObjectId;

    @Prop({ default: true })
    isActive: boolean;

    @Prop({ default: 0 })
    sortOrder: number;

    @Prop({ required: true, unique: true, lowercase: true, trim: true })
    slug: string;
}

export const CategorySchema = SchemaFactory.createForClass(Category);

CategorySchema.index({ parentCategory: 1 });
CategorySchema.index({ isActive: 1 });
