import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { Roles, CurrentUser } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { PaginationDto } from '../../common/dto';
import { OrderStatus, PaymentStatus } from '../../common/constants';

@Controller('orders')
export class OrdersController {
    constructor(private readonly ordersService: OrdersService) { }

    @Post()
    async create(@Body() dto: any, @CurrentUser('_id') userId: string) {
        return this.ordersService.create(dto, userId);
    }

    @Get()
    @Roles('superadmin', 'admin', 'finance', 'support')
    @UseGuards(RolesGuard)
    async findAll(@Query() paginationDto: PaginationDto, @Query('status') status?: string, @Query('paymentStatus') paymentStatus?: string, @Query('merchantId') merchantId?: string) {
        return this.ordersService.findAll(paginationDto, { status, paymentStatus, merchantId });
    }

    @Get('me')
    async getMyOrders(@CurrentUser('_id') userId: string, @Query() paginationDto: PaginationDto) {
        return this.ordersService.getMyOrders(userId, paginationDto);
    }

    @Get('stats')
    @Roles('superadmin', 'admin', 'finance')
    @UseGuards(RolesGuard)
    async getStats() { return this.ordersService.getStats(); }

    @Get(':id')
    async findById(@Param('id') id: string) { return this.ordersService.findById(id); }

    @Patch('bulk/status')
    @Roles('superadmin', 'admin', 'support')
    @UseGuards(RolesGuard)
    async bulkUpdateStatus(@Body() body: { ids: string[]; status: OrderStatus }) {
        return this.ordersService.bulkUpdateStatus(body.ids, body.status);
    }
}
