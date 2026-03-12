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
    async findAll(
        @Query() paginationDto: PaginationDto, 
        @Query('status') status?: string,
        @Query('kycStatus') kycStatus?: string
    ) {
        return this.partnersService.findAll(paginationDto, { status, kycStatus });
    }

    @Get('me')
    @UseGuards(RolesGuard)
    @Roles('partner')
    async getMe(@CurrentUser('_id') userId: string) {
        return this.partnersService.findByUserId(userId);
    }

    @Get('me/dashboard')
    @UseGuards(RolesGuard)
    @Roles('partner')
    async getDashboard(@CurrentUser('_id') userId: string) {
        return this.partnersService.getDashboard(userId);
    }

    @Get('me/network')
    @UseGuards(RolesGuard)
    @Roles('partner')
    async getNetwork(@CurrentUser('_id') userId: string) {
        return this.partnersService.getNetwork(userId);
    }

    @Get('me/referral-qr')
    @UseGuards(RolesGuard)
    @Roles('partner')
    async getMyReferralQr(@CurrentUser('_id') userId: string) {
        return this.partnersService.getReferralQrCode(userId);
    }

    @Get('me/referrals')
    @UseGuards(RolesGuard)
    @Roles('partner')
    async getReferrals(@CurrentUser('_id') userId: string) {
        return this.partnersService.getReferrals(userId);
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

    @Get('me/kyc')
    @UseGuards(RolesGuard)
    @Roles('partner')
    async getMyKyc(@CurrentUser('_id') userId: string) {
        const partner = await this.partnersService.findByUserId(userId);
        const partnerDoc = await this.partnersService.initializeKycDocuments(partner as any);
        return { data: partnerDoc.kyc, overallStatus: this.partnersService.getOverallKycStatus(partnerDoc) };
    }

    @Post('me/kyc/document')
    @UseGuards(RolesGuard)
    @Roles('partner')
    async submitKycDocument(
        @CurrentUser('_id') userId: string,
        @Body() docData: { documentType: string; idNumber: string; documentUrl: string },
    ) {
        return this.partnersService.submitKycDocument(userId, docData);
    }

    @Patch(':id/kyc-document-status')
    @Roles('superadmin', 'admin')
    @UseGuards(RolesGuard)
    async updateKycDocumentStatus(
        @Param('id') id: string,
        @Body('documentType') documentType: string,
        @Body('status') status: 'approved' | 'rejected',
        @Body('reason') reason?: string,
    ) {
        return this.partnersService.updateKycDocumentStatus(id, documentType, status, reason);
    }
}
