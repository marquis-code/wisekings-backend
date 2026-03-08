import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation, ConversationDocument, Message, MessageDocument } from './schemas/chat.schema';
import { PaginationDto, PaginatedResult } from '@common/dto';

@Injectable()
export class ChatService {
    private readonly logger = new Logger(ChatService.name);

    constructor(
        @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
        @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    ) { }

    async createConversation(participants: string[], type: 'direct' | 'group' = 'direct') {
        const participantIds = participants.map(id => new Types.ObjectId(id));

        // For direct chat, check if exists
        if (type === 'direct') {
            const existing = await this.conversationModel.findOne({
                type: 'direct',
                participants: { $all: participantIds, $size: 2 },
            });
            if (existing) return existing;
        }

        return this.conversationModel.create({
            participants: participantIds,
            type,
        });
    }

    async findUserConversations(userId: string, paginationDto: PaginationDto) {
        const { page = 1, limit = 10 } = paginationDto;
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            this.conversationModel
                .find({ participants: new Types.ObjectId(userId) })
                .populate('participants', 'fullName email avatar userType')
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            this.conversationModel.countDocuments({ participants: new Types.ObjectId(userId) }),
        ]);

        return new PaginatedResult(data as any[], total, page, limit);
    }

    async saveMessage(conversationId: string, senderId: string, content: string, type: string = 'text', attachments: any[] = []) {
        const conversation = await this.conversationModel.findById(conversationId);
        if (!conversation) throw new NotFoundException('Conversation not found');

        const message = await this.messageModel.create({
            conversationId: new Types.ObjectId(conversationId),
            senderId: new Types.ObjectId(senderId),
            content,
            type,
            attachments,
            readBy: [new Types.ObjectId(senderId)],
        });

        // Update conversation last message
        await this.conversationModel.findByIdAndUpdate(conversationId, {
            lastMessage: {
                content: type === 'text' ? content : `Sent an ${type}`,
                senderId: new Types.ObjectId(senderId),
                timestamp: new Date(),
            },
            updatedAt: new Date(),
        });

        return message;
    }

    async getConversationMessages(conversationId: string, paginationDto: PaginationDto) {
        const { page = 1, limit = 20 } = paginationDto;
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            this.messageModel
                .find({ conversationId: new Types.ObjectId(conversationId) })
                .populate('senderId', 'fullName email avatar')
                .sort({ createdAt: -1 }) // Get latest first for infinite scroll
                .skip(skip)
                .limit(limit)
                .lean(),
            this.messageModel.countDocuments({ conversationId: new Types.ObjectId(conversationId) }),
        ]);

        // Reverse to show in chronological order on UI
        return new PaginatedResult((data as any[]).reverse(), total, page, limit);
    }

    async markAsRead(conversationId: string, userId: string) {
        await this.messageModel.updateMany(
            {
                conversationId: new Types.ObjectId(conversationId),
                readBy: { $ne: new Types.ObjectId(userId) }
            },
            { $addToSet: { readBy: new Types.ObjectId(userId) } }
        );
        return { success: true };
    }
}
