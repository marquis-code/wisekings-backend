import { Controller, Get, Post, Put, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { Public, Roles, CurrentUser } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { PaginationDto } from '../../common/dto';

@Controller('partners')
export class PartnersController {
    constructor(private readonly partnersService: PartnersService) { }

    @Public()
    @Post('register')
    async register(@Body() dto: any) { return this.partnersService.register(dto); }

    @Get()
    @Roles('superadmin', 'admin', 'finance', 'support', 'viewer')
    @UseGuards(RolesGuard)
    async findAll(@Query() paginationDto: PaginationDto, @Query('status') status?: string) {
        return this.partnersService.findAll(paginationDto, { status });
    }

    @Get('me/dashboard')
    async getDashboard(@CurrentUser('_id') userId: string) {
        return this.partnersService.getDashboard(userId);
    }

    @Get(':id')
    async findById(@Param('id') id: string) { return this.partnersService.findById(id); }

    @Put(':id')
    @Roles('superadmin', 'admin')
    @UseGuards(RolesGuard)
    async update(@Param('id') id: string, @Body() dto: any) { return this.partnersService.update(id, dto); }

    @Patch(':id/approve')
    @Roles('superadmin', 'admin')
    @UseGuards(RolesGuard)
    async approve(@Param('id') id: string) { return this.partnersService.approve(id); }

    @Patch(':id/suspend')
    @Roles('superadmin', 'admin')
    @UseGuards(RolesGuard)
    async suspend(@Param('id') id: string, @Body('reason') reason: string) {
        return this.partnersService.suspend(id, reason);
    }
}
