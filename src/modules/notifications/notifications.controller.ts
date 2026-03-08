import {
    Controller,
    Get,
    Patch,
    Delete,
    Param,
    Body,
    Query,
    UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../common/decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaginationDto } from '../../common/dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) { }

    @Get()
    async findAll(
        @CurrentUser('_id') userId: string,
        @Query() paginationDto: PaginationDto,
    ) {
        return this.notificationsService.findAll(userId, paginationDto);
    }

    @Get('unread-count')
    async getUnreadCount(@CurrentUser('_id') userId: string) {
        return this.notificationsService.getUnreadCount(userId);
    }

    @Patch(':id/read')
    async markAsRead(
        @Param('id') id: string,
        @CurrentUser('_id') userId: string,
    ) {
        return this.notificationsService.markAsRead(id, userId);
    }

    @Patch('read-all')
    async markAllAsRead(@CurrentUser('_id') userId: string) {
        return this.notificationsService.markAllAsRead(userId);
    }

    @Delete(':id')
    async delete(
        @Param('id') id: string,
        @CurrentUser('_id') userId: string,
    ) {
        return this.notificationsService.delete(id, userId);
    }
}
