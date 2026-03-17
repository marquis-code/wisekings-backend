import { Controller, Get, Post, Patch, Put, Param, Body, Query, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { Roles, CurrentUser } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { PaginationDto } from '../../common/dto';
import { OrderStatus, PaymentStatus } from '@common/constants';

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

    @Patch(':id/status')
    @Put(':id/status') // Fallback for environments where PATCH is restricted
    @Roles('superadmin', 'admin', 'support')
    @UseGuards(RolesGuard)
    async updateStatus(@Param('id') id: string, @Body() body: any) {
        // Handle both { "status": "..." } and raw status if sent incorrectly
        const status = (body && typeof body === 'object') ? body.status : body;
        return this.ordersService.updateStatus(id, status as OrderStatus);
    }

    @Post(':id/submit-proof')
    async submitPaymentProof(@Param('id') id: string, @Body('proofUrl') proofUrl: string) {
        return this.ordersService.submitPaymentProof(id, proofUrl);
    }

    @Patch(':id/verify-proof')
    @Roles('superadmin', 'admin', 'finance')
    @UseGuards(RolesGuard)
    async verifyPaymentProof(@Param('id') id: string, @Body('status') status: 'verified' | 'rejected') {
        return this.ordersService.verifyPaymentProof(id, status);
    }
}
