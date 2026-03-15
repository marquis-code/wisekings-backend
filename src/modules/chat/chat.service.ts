import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation, ConversationDocument, Message, MessageDocument } from './schemas/chat.schema';
import { MessageType } from '@common/constants';
import { AiService } from '../ai/ai.service';
import { ChatConfigService } from './chat-config.service';
import { ChatConfig } from './schemas/chat-config.schema';

@Injectable()
export class ChatService {
    constructor(
        @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
        @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
        private aiService: AiService,
        private configService: ChatConfigService,
    ) { }

    async findUserConversations(user: any, paginationDto: any) {
        const { limit = 10, skip = 0 } = paginationDto;
        const userId = user._id || user.sub;
        
        const query: any = {
            $or: [
                { participants: new Types.ObjectId(userId) }
            ]
        };

        // If user is admin/support, also show all support conversations
        if (user.userType === 'admin' || user.role === 'admin' || user.role === 'support') {
            query.$or.push({ type: 'support' });
        }

        const conversations = await this.conversationModel.find(query)
            .sort({ lastMessageAt: -1 })
            .limit(limit as any)
            .skip(skip)
            .populate('participants', 'fullName email avatar userType')
            .exec();

        const total = await this.conversationModel.countDocuments(query);

        return { data: conversations, total, limit, skip };
    }

    async createConversation(participants: string[], type: string = 'direct') {
        // If direct, check if exists
        if (type === 'direct' && participants.length === 2) {
            const existing = await this.conversationModel.findOne({
                participants: { $all: participants.map(p => new Types.ObjectId(p)) },
                type: 'direct'
            }).populate('participants', 'fullName email avatar userType');
            
            if (existing) {
                return { data: existing };
            }
        }

        const newConv = await this.conversationModel.create({
            participants: participants.map(p => new Types.ObjectId(p)),
            type,
        });

        const populated = await newConv.populate('participants', 'fullName email avatar userType');

        return { data: populated };
    }

    async getConversationMessages(conversationId: string, paginationDto: any) {
        const { limit = 50, skip = 0 } = paginationDto;
        const messages = await this.messageModel.find({
            conversationId: new Types.ObjectId(conversationId),
        })
            .sort({ createdAt: 1 }) // Or -1 if you want most recent first
            .limit(limit as any)
            .skip(skip)
            .populate('senderId', 'fullName email avatar userType')
            .exec();

        const total = await this.messageModel.countDocuments({
            conversationId: new Types.ObjectId(conversationId),
        });

        return { data: messages, total, limit, skip };
    }

    async saveMessage(conversationId: string, senderId: string, content: string, type: MessageType = MessageType.TEXT, attachments: string[] = [], replyTo?: string) {
        const message = await this.messageModel.create({
            conversationId: new Types.ObjectId(conversationId),
            senderId: new Types.ObjectId(senderId),
            content,
            type,
            attachments,
            replyTo: replyTo ? new Types.ObjectId(replyTo) : undefined,
        });

        // Update conversation
        const conversation = await this.conversationModel.findByIdAndUpdate(conversationId, {
            lastMessage: content,
            lastMessageAt: new Date(),
            lastMessageBy: new Types.ObjectId(senderId),
        }, { new: true })
            .populate('participants', 'fullName email avatar userType')
            .exec();

        const populatedMessage = await message.populate([
            { path: 'senderId', select: 'fullName email avatar userType' },
            { 
                path: 'replyTo', 
                populate: { path: 'senderId', select: 'fullName email' } 
            }
        ]);

        // Process AI/Auto-response triggers if message is from a non-admin in a support chat
        // DISABLED: Leading to infinite loops. User requested removal.
        // this.handleAutoResponse(conversation, senderId, content);

        return {
            message: populatedMessage,
            conversation
        };
    }

    private async handleAutoResponse(conversation: any, senderId: string, content: string) {
        if (!conversation || conversation.type !== 'support') return;

        // Find system admin for the response
        const systemAdmin = await this.messageModel.db.model('User').findOne({ userType: 'admin' }).exec();
        if (!systemAdmin) return;

        // CRITICAL: Prevent infinite loop by not responding to the system admin itself
        if (senderId.toString() === systemAdmin._id.toString()) return;

        // Prevent responding to common error messages to avoid AI retry loops
        const errorMessages = [
            "I'm having trouble processing your request",
            "I'm currently unable to assist",
            "AI Assistant is not configured"
        ];
        if (errorMessages.some(msg => content.includes(msg))) return;

        // Check if sender is an admin (we only auto-respond to customers/partners/merchants)
        const participants = conversation.participants as any[];
        const sender = participants.find(p => p._id.toString() === senderId);
        if (sender?.userType === 'admin') return;

        const config = await this.configService.getConfig();
        const isWorkingHours = await this.configService.isWithinBusinessHours();

        // 1. Business Hours Check
        if (!isWorkingHours && config.offlineMessage) {
            setTimeout(async () => {
                await this.saveMessage(conversation._id.toString(), systemAdmin._id.toString(), config.offlineMessage, MessageType.TEXT);
            }, 2000);
            return;
        }

        // 2. Exact/Keyword Triggers
        const trigger = config.autoResponses.find(ar => ar.isActive && content.toLowerCase().includes(ar.trigger.toLowerCase()));
        if (trigger) {
            setTimeout(async () => {
                await this.saveMessage(conversation._id.toString(), systemAdmin._id.toString(), trigger.response, MessageType.TEXT);
            }, 1000);
            return;
        }

        // 3. AI Response
        if (config.aiEnabled) {
            const history = await this.messageModel.find({ conversationId: conversation._id })
                .sort({ createdAt: -1 })
                .limit(10)
                .populate('senderId', 'userType')
                .exec();

            const aiResponse = await this.aiService.generateSupportResponse(history.reverse(), content, config.aiSystemPrompt);
            if (aiResponse) {
                setTimeout(async () => {
                    await this.saveMessage(conversation._id.toString(), systemAdmin._id.toString(), aiResponse, MessageType.TEXT);
                }, 3000);
            }
        }
    }

    async markAsRead(conversationId: string, userId: string) {
        return this.messageModel.updateMany(
            { conversationId: new Types.ObjectId(conversationId), senderId: { $ne: new Types.ObjectId(userId) }, isRead: false },
            { $set: { isRead: true }, $addToSet: { readBy: new Types.ObjectId(userId) } }
        );
    }

    async createSupportConversation(userId: string, referrerCode?: string) {
        // Find an admin user that is NOT the current user
        const admin = await this.messageModel.db.model('User').findOne({
            userType: 'admin',
            isActive: true,
            _id: { $ne: new Types.ObjectId(userId) }
        }).lean() as any;

        const participants = [userId];
        if (admin) {
            participants.push(admin._id.toString());
        }

        // Always use type: 'support' for support chats
        let type = 'support';

        if (referrerCode) {
            const merchant = await this.messageModel.db.model('Merchant').findOne({
                merchantCode: referrerCode
            }).populate('userId').lean() as any;

            if (merchant && merchant.userId) {
                const merchantUserId = merchant.userId._id.toString();
                if (!participants.includes(merchantUserId)) {
                    participants.push(merchantUserId);
                }
            }
        }

        return this.createConversation(participants, type);
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
