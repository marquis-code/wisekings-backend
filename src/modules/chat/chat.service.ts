import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation, ConversationDocument, Message, MessageDocument } from './schemas/chat.schema';
import { MessageType } from '@common/constants';

@Injectable()
export class ChatService {
    constructor(
        @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
        @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    ) { }

    async findUserConversations(userId: string, paginationDto: any) {
        const { limit = 10, skip = 0 } = paginationDto;
        const conversations = await this.conversationModel.find({
            participants: new Types.ObjectId(userId),
        })
            .sort({ lastMessageAt: -1 })
            .limit(limit)
            .skip(skip)
            .populate('participants', 'fullName email avatar')
            .exec();

        const total = await this.conversationModel.countDocuments({
            participants: new Types.ObjectId(userId),
        });

        return { data: conversations, total, limit, skip };
    }

    async createConversation(participants: string[], type: string = 'direct') {
        // If direct, check if exists
        if (type === 'direct' && participants.length === 2) {
            const existing = await this.conversationModel.findOne({
                participants: { $all: participants.map(p => new Types.ObjectId(p)) },
                type: 'direct'
            });
            if (existing) return { data: existing };
        }

        const newConv = await this.conversationModel.create({
            participants: participants.map(p => new Types.ObjectId(p)),
            type,
        });

        return { data: newConv };
    }

    async getConversationMessages(conversationId: string, paginationDto: any) {
        const { limit = 50, skip = 0 } = paginationDto;
        const messages = await this.messageModel.find({
            conversationId: new Types.ObjectId(conversationId),
        })
            .sort({ createdAt: 1 }) // Or -1 if you want most recent first
            .limit(limit)
            .skip(skip)
            .populate('senderId', 'fullName email avatar')
            .exec();

        const total = await this.messageModel.countDocuments({
            conversationId: new Types.ObjectId(conversationId),
        });

        return { data: messages, total, limit, skip };
    }

    async saveMessage(conversationId: string, senderId: string, content: string, type: MessageType = MessageType.TEXT, attachments: string[] = []) {
        const message = await this.messageModel.create({
            conversationId: new Types.ObjectId(conversationId),
            senderId: new Types.ObjectId(senderId),
            content,
            type,
            attachments,
        });

        // Update conversation last message and fetch it to get participants
        const conversation = await this.conversationModel.findByIdAndUpdate(conversationId, {
            lastMessage: content,
            lastMessageAt: new Date(),
            lastMessageBy: new Types.ObjectId(senderId),
        }, { new: true }).exec();

        const populatedMessage = await message.populate('senderId', 'fullName email avatar');

        return {
            message: populatedMessage,
            conversation
        };
    }

    async markAsRead(conversationId: string, userId: string) {
        return this.messageModel.updateMany(
            { conversationId: new Types.ObjectId(conversationId), senderId: { $ne: new Types.ObjectId(userId) }, isRead: false },
            { $set: { isRead: true }, $addToSet: { readBy: new Types.ObjectId(userId) } }
        );
    }

    async createSupportConversation(userId: string) {
        // Find an admin user
        const admin = await this.messageModel.db.model('User').findOne({
            userType: 'admin',
            isActive: true
        }).lean() as any;

        const adminId = admin?._id || '65f1a2b3c4d5e6f7a8b9c0d1'; // Fallback to a known ID if no admin found (avoiding crash)

        return this.createConversation([userId, adminId.toString()], 'direct');
    }

    async getOrCreateCommunityGroup(userType: string) {
        const groupName = userType === 'partner' ? 'Partner Community' : 'Merchant Community';
        let group = await this.conversationModel.findOne({
            type: 'group',
            groupName
        }).exec();

        if (!group) {
            group = await this.conversationModel.create({
                type: 'group',
                groupName,
                participants: []
            });
        }
        return group;
    }
}
