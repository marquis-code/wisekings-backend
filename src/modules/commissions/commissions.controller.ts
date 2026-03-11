import { Controller, Get, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { CommissionsService } from './commissions.service';
import { Roles, CurrentUser } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { PaginationDto } from '../../common/dto';

@Controller('commissions')
export class CommissionsController {
    constructor(private readonly commissionsService: CommissionsService) { }

    @Get('me')
    async getMyCommissions(
        @CurrentUser('_id') userId: string,
        @Query() paginationDto: PaginationDto,
    ) {
        return this.commissionsService.findByUser(userId, paginationDto);
    }

    @Get()
    @Roles('superadmin', 'admin', 'finance')
    @UseGuards(RolesGuard)
    async findAll(
        @Query() paginationDto: PaginationDto,
        @Query('merchantId') merchantId?: string,
        @Query('partnerId') partnerId?: string,
        @Query('status') status?: string,
    ) {
        return this.commissionsService.findAll(paginationDto, { merchantId, partnerId, status });
    }

    @Get('summary')
    @Roles('superadmin', 'admin', 'finance')
    @UseGuards(RolesGuard)
    async getSummary(
        @Query('ownerId') ownerId?: string,
        @Query('ownerType') ownerType?: string,
    ) {
        return this.commissionsService.getSummary(ownerId, ownerType);
    }

    @Patch(':id/adjust')
    @Roles('superadmin', 'admin', 'finance')
    @UseGuards(RolesGuard)
    async adjust(
        @Param('id') id: string,
        @Body('amount') amount: number,
        @Body('reason') reason: string,
    ) {
        return this.commissionsService.adjustCommission(id, amount, reason);
    }
}
