import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BannerDocument = Banner & Document;

@Schema({ timestamps: true, collection: 'banners' })
export class Banner {
    @Prop({ required: true, trim: true })
    title: string;

    @Prop()
    description: string;

    @Prop({ required: true })
    image: string;

    @Prop()
    link: string;

    @Prop({ enum: ['home', 'category', 'offers', 'global'], default: 'home' })
    position: string;

    @Prop({ default: true })
    isActive: boolean;

    @Prop({ default: 0 })
    sortOrder: number;

    @Prop()
    startDate: Date;

    @Prop()
    endDate: Date;
}

export const BannerSchema = SchemaFactory.createForClass(Banner);
BannerSchema.index({ isActive: 1, position: 1 });
