import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { MessageType } from '@common/constants';

// Conversation Schema
export type ConversationDocument = Conversation & Document;

@Schema({ timestamps: true, collection: 'conversations' })
export class Conversation {
    @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], required: true })
    participants: Types.ObjectId[];

    @Prop({ type: String, enum: ['direct', 'group', 'support'], default: 'direct' })
    type: string;

    @Prop()
    groupName: string;

    @Prop()
    lastMessage: string;

    @Prop()
    lastMessageAt: Date;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    lastMessageBy: Types.ObjectId;

    @Prop({ default: true })
    isActive: boolean;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ lastMessageAt: -1 });

// Message Schema
export type MessageDocument = Message & Document;

@Schema({ timestamps: true, collection: 'messages' })
export class Message {
    @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
    conversationId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    senderId: Types.ObjectId;

    @Prop({ required: true })
    content: string;

    @Prop({ type: String, enum: MessageType, default: MessageType.TEXT })
    type: MessageType;

    @Prop({ type: [String], default: [] })
    attachments: string[];

    @Prop({ default: false })
    isRead: boolean;

    @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
    readBy: Types.ObjectId[];

    @Prop({ type: Types.ObjectId, ref: 'Message' })
    replyTo: Types.ObjectId;

    @Prop({ default: false })
    isDeleted: boolean;

    @Prop()
    deletedAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);

MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1 });
