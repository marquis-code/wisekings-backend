import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('shipping')
export class ShippingController {
    constructor(private readonly shippingService: ShippingService) { }

    @Get('config')
    @UseGuards(JwtAuthGuard)
    getConfig() {
        return this.shippingService.getConfig();
    }

    @Post('config')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin', 'superadmin')
    updateConfig(@Body() dto: any) {
        return this.shippingService.updateConfig(dto);
    }

    @Get('calculate')
    calculateFee(
        @Query('lat') lat: number,
        @Query('lng') lng: number
    ) {
        return this.shippingService.calculateDeliveryFee(Number(lat), Number(lng));
    }
}
