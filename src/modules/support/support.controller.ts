import { Controller, Get, Post, Body, Patch, Param, UseGuards, Query } from '@nestjs/common';
import { Types } from 'mongoose';
import { SupportService } from './support.service';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { TicketStatus } from './schemas/ticket.schema';

@Controller('support')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupportController {
    constructor(private readonly supportService: SupportService) { }

    @Post('tickets')
    create(@CurrentUser('id') userId: string, @Body() body: any) {
        return this.supportService.createTicket(userId, body);
    }

    @Get('tickets')
    @Roles('admin', 'staff')
    findAll(@Query() query: any) {
        return this.supportService.findAll(query);
    }

    @Get('tickets/me')
    findMyTickets(@CurrentUser('id') userId: string) {
        return this.supportService.findAll({ customerId: new Types.ObjectId(userId) });
    }

    @Get('tickets/:id')
    findOne(@Param('id') id: string) {
        return this.supportService.findOne(id);
    }

    @Patch('tickets/:id/status')
    @Roles('admin', 'staff')
    updateStatus(@Param('id') id: string, @Body('status') status: TicketStatus) {
        return this.supportService.updateStatus(id, status);
    }

    @Post('tickets/:id/comments')
    addComment(@Param('id') id: string, @CurrentUser('id') userId: string, @Body('message') message: string) {
        return this.supportService.addComment(id, userId, message);
    }
}
