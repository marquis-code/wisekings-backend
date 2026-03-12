import {
    Controller,
    Get,
    Post,
    Put,
    Patch,
    Param,
    Body,
    Query,
    UseGuards,
} from '@nestjs/common';
import { MerchantsService } from './merchants.service';
import { RegisterMerchantDto, UpdateMerchantDto } from './dto/merchant.dto';
import { Public, Roles, CurrentUser } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { PaginationDto } from '../../common/dto';

@Controller('merchants')
export class MerchantsController {
    constructor(private readonly merchantsService: MerchantsService) { }

    @Public()
    @Post('register')
    async register(@Body() dto: RegisterMerchantDto) {
        return this.merchantsService.register(dto);
    }

    @Get()
    @Roles('superadmin', 'admin', 'finance', 'support', 'viewer')
    @UseGuards(RolesGuard)
    async findAll(
        @Query() paginationDto: PaginationDto,
        @Query('status') status?: string,
        @Query('category') category?: string,
        @Query('rank') rank?: string,
        @Query('kycStatus') kycStatus?: string,
    ) {
        return this.merchantsService.findAll(paginationDto, { status, category, rank, kycStatus });
    }

    // --- "me" routes MUST be defined BEFORE ":id" to avoid casting "me" as ObjectId ---

    @Get('me')
    async getMyProfile(@CurrentUser('_id') userId: string) {
        return this.merchantsService.findOrCreateByUserId(userId);
    }

    @Put('me')
    async updateMyProfile(
        @CurrentUser('_id') userId: string,
        @Body() dto: UpdateMerchantDto,
    ) {
        return this.merchantsService.updateByUserId(userId, dto);
    }

    @Get('me/dashboard')
    async getDashboard(@CurrentUser('_id') userId: string) {
        return this.merchantsService.getDashboard(userId);
    }

    @Get('me/referral-qr')
    async getMyReferralQr(@CurrentUser('_id') userId: string) {
        return this.merchantsService.getReferralQrCode(userId);
    }

    @Get('me/referrals')
    async getMyReferrals(
        @CurrentUser('_id') userId: string,
        @Query() paginationDto: PaginationDto,
    ) {
        return this.merchantsService.getReferrals(userId, paginationDto);
    }

    @Get('stats')
    @Roles('superadmin', 'admin', 'finance')
    @UseGuards(RolesGuard)
    async getStats() {
        return this.merchantsService.getStats();
    }

    @Get('code/:code')
    async findByCode(@Param('code') code: string) {
        return this.merchantsService.findByCode(code);
    }

    @Get(':id')
    async findById(@Param('id') id: string) {
        return this.merchantsService.findById(id);
    }

    @Put(':id')
    @Roles('superadmin', 'admin')
    @UseGuards(RolesGuard)
    async update(@Param('id') id: string, @Body() dto: UpdateMerchantDto) {
        return this.merchantsService.update(id, dto);
    }

    @Patch(':id/suspend')
    @Roles('superadmin', 'admin')
    @UseGuards(RolesGuard)
    async suspend(
        @Param('id') id: string,
        @Body('reason') reason: string,
    ) {
        return this.merchantsService.suspend(id, reason);
    }

    @Patch(':id/activate')
    @Roles('superadmin', 'admin')
    @UseGuards(RolesGuard)
    async activate(@Param('id') id: string) {
        return this.merchantsService.activate(id);
    }

    @Get('me/kyc')
    @Roles('merchant')
    @UseGuards(RolesGuard)
    async getMyKyc(@CurrentUser('_id') userId: string) {
        const merchant = await this.merchantsService.findByUserId(userId);
        const merchantDoc = await this.merchantsService.initializeKycDocuments(merchant as any);
        return { data: merchantDoc.kyc, overallStatus: this.merchantsService.getOverallKycStatus(merchantDoc) };
    }

    @Post('me/kyc/document')
    @Roles('merchant')
    @UseGuards(RolesGuard)
    async submitKycDocument(
        @CurrentUser('_id') userId: string,
        @Body() docData: { documentType: string; idNumber: string; documentUrl: string },
    ) {
        return this.merchantsService.submitKycDocument(userId, docData);
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
        return this.merchantsService.updateKycDocumentStatus(id, documentType, status, reason);
    }
}
