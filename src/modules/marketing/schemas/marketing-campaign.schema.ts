import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MarketingCampaignDocument = MarketingCampaign & Document;

@Schema({ timestamps: true, collection: 'marketing_campaigns' })
export class MarketingCampaign {
    @Prop({ required: true })
    title: string;

    @Prop({ required: true })
    subject: string;
    
    @Prop()
    previewText: string;
    
    @Prop()
    bannerUrl: string;

    @Prop({ required: true })
    content: string;

    @Prop({ type: String, enum: ['merchants', 'partners', 'customers', 'all', 'custom'], required: true })
    targetAudience: string;

    @Prop({ type: [String], default: [] })
    customEmails: string[];

    @Prop({ type: Types.ObjectId, ref: 'User' })
    createdBy: Types.ObjectId;

    @Prop({ default: 0 })
    recipientsCount: number;

    @Prop({ type: Date, default: Date.now })
    sentAt: Date;

    @Prop({ type: [String], default: [] })
    failedEmails: string[];
}

export const MarketingCampaignSchema = SchemaFactory.createForClass(MarketingCampaign);
