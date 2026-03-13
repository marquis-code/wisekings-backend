import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ChatConfigDocument = ChatConfig & Document;

@Schema({ timestamps: true, collection: 'chat_configs' })
export class ChatConfig {
    @Prop({ default: true })
    aiEnabled: boolean;

    @Prop({ default: 'You are the WiseKings Support AI. Help users with their questions about snacks, orders, partnerships, and merchant tools. Be polite, concise, and professional.' })
    aiSystemPrompt: string;

    @Prop({
        type: [{
            trigger: String,
            response: String,
            isActive: { type: Boolean, default: true }
        }],
        default: []
    })
    autoResponses: { trigger: string; response: string; isActive: boolean }[];

    @Prop({
        type: {
            monday: { open: String, close: String, isClosed: Boolean },
            tuesday: { open: String, close: String, isClosed: Boolean },
            wednesday: { open: String, close: String, isClosed: Boolean },
            thursday: { open: String, close: String, isClosed: Boolean },
            friday: { open: String, close: String, isClosed: Boolean },
            saturday: { open: String, close: String, isClosed: Boolean },
            sunday: { open: String, close: String, isClosed: Boolean },
        },
        default: {
            monday: { open: '08:00', close: '18:00', isClosed: false },
            tuesday: { open: '08:00', close: '18:00', isClosed: false },
            wednesday: { open: '08:00', close: '18:00', isClosed: false },
            thursday: { open: '08:00', close: '18:00', isClosed: false },
            friday: { open: '08:00', close: '18:00', isClosed: false },
            saturday: { open: '10:00', close: '16:00', isClosed: false },
            sunday: { open: '00:00', close: '00:00', isClosed: true },
        }
    })
    businessHours: any;

    @Prop({ default: 'Thank you for reaching out. We are currently offline. Our business hours are Mon-Fri 8am-6pm. We will get back to you as soon as possible.' })
    offlineMessage: string;

    @Prop({ default: 5 }) // Minutes
    delayedResponseThreshold: number;

    @Prop({ default: 'Our team is currently handling a high volume of inquiries. Please hold on, a support agent will be with you shortly.' })
    delayedResponseMessage: string;

    @Prop({ type: String, default: 'global' })
    scope: string; // 'global' or potentially unique per category/merchant
}

export const ChatConfigSchema = SchemaFactory.createForClass(ChatConfig);
