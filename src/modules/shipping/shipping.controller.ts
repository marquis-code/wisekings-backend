import { Controller, Get, Post, Body, Query, UseGuards, Header } from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';

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

    @Public()
    @Get('calculate')
    @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
    calculateFee(
        @Query('lat') lat: number,
        @Query('lng') lng: number,
        @Query('method') method: 'pickup' | 'waybill' | 'lagos_dispatch' = 'lagos_dispatch',
        @Query('country') country: string = 'Nigeria',
        @Query('weight') weight: number = 0,
        @Query('isHomeDelivery') isHomeDelivery: string = 'false'
    ) {
        console.log('Calculating shipping fee for:', { lat, lng, method, country, weight, isHomeDelivery });
        return this.shippingService.calculateDeliveryFee(
            Number(lat), 
            Number(lng), 
            method, 
            country, 
            Number(weight), 
            isHomeDelivery === 'true'
        );
    }

    @Public()
    @Get('calculate-public')
    @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
    calculateFeePublic(
        @Query('lat') lat: number,
        @Query('lng') lng: number,
        @Query('method') method: 'pickup' | 'waybill' | 'lagos_dispatch' = 'lagos_dispatch',
        @Query('country') country: string = 'Nigeria',
        @Query('weight') weight: number = 0,
        @Query('isHomeDelivery') isHomeDelivery: string = 'false'
    ) {
        return this.shippingService.calculateDeliveryFee(
            Number(lat), 
            Number(lng), 
            method, 
            country, 
            Number(weight), 
            isHomeDelivery === 'true'
        );
    }
}
