import {
    Controller,
    Get,
    Post,
    Param,
    Body,
    Query,
    UseGuards,
    Patch,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { CurrentUser } from '../../common/decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaginationDto } from '../../common/dto';
import { Types } from 'mongoose';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
    constructor(private readonly chatService: ChatService) { }

    @Get('conversations')
    async getConversations(
        @CurrentUser('_id') userId: string,
        @Query() paginationDto: PaginationDto,
    ) {
        return this.chatService.findUserConversations(userId, paginationDto);
    }

    @Post('conversations')
    async createConversation(
        @CurrentUser('_id') userId: string,
        @Body() body: { participants: string[]; type?: 'direct' | 'group' | 'support' },
    ) {
        if (body.type === 'support') {
            // Find an admin to chat with
            return this.chatService.createSupportConversation(userId);
        }
        const participants = [...new Set([...body.participants, userId])];
        return this.chatService.createConversation(participants, body.type);
    }

    @Post('community')
    async joinCommunity(@CurrentUser() user: any) {
        const group = await this.chatService.getOrCreateCommunityGroup(user.userType);
        // Add user to group if not already there
        if (!group.participants.includes(new Types.ObjectId(user._id) as any)) {
            group.participants.push(new Types.ObjectId(user._id) as any);
            await group.save();
        }
        return { data: group };
    }

    @Get('conversations/:id/messages')
    async getMessages(
        @Param('id') id: string,
        @Query() paginationDto: PaginationDto,
    ) {
        return this.chatService.getConversationMessages(id, paginationDto);
    }

    @Patch('conversations/:id/read')
    async markAsRead(
        @Param('id') id: string,
        @CurrentUser('_id') userId: string,
    ) {
        return this.chatService.markAsRead(id, userId);
    }
}
