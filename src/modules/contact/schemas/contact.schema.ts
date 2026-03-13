import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum ContactStatus {
    PENDING = 'pending',
    PROCESSED = 'processed',
    ARCHIVED = 'archived'
}

export type ContactDocument = Contact & Document;

@Schema({ timestamps: true, collection: 'contacts' })
export class Contact {
    @Prop({ required: true })
    name: string;

    @Prop({ required: true })
    email: string;

    @Prop({ required: true })
    subject: string;

    @Prop({ required: true })
    message: string;

    @Prop({ enum: ContactStatus, default: ContactStatus.PENDING })
    status: ContactStatus;

    @Prop()
    adminNotes: string;
}

export const ContactSchema = SchemaFactory.createForClass(Contact);
