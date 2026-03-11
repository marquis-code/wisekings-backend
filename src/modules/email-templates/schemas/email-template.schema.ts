import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EmailTemplateDocument = EmailTemplate & Document;

@Schema({ timestamps: true, collection: 'email_templates' })
export class EmailTemplate {
    @Prop({ required: true, unique: true, trim: true })
    name: string; // e.g., 'PARTNER_APPROVED', 'MARKETING_CAMPAIGN'

    @Prop({ required: true })
    subject: string;

    @Prop({ required: true })
    content: string; // The HTML content with handlebars-like variables {{ name }}

    @Prop({ type: [String], default: [] })
    variables: string[]; // List of expected variables in the template

    @Prop({ default: true })
    isActive: boolean;
}

export const EmailTemplateSchema = SchemaFactory.createForClass(EmailTemplate);
