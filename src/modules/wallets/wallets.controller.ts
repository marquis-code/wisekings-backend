import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { Roles, CurrentUser } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { PaginationDto } from '../../common/dto';

@Controller('wallets')
export class WalletsController {
    constructor(private readonly walletsService: WalletsService) { }

    @Get('me')
    async getMyWallet(@CurrentUser('_id') userId: string) {
        return this.walletsService.getMyWallet(userId);
    }

    @Post('withdraw')
    async requestWithdrawal(
        @CurrentUser('_id') userId: string,
        @Body() body: { amount: number; bankDetails: any },
    ) {
        return this.walletsService.requestWithdrawal(userId, body.amount, body.bankDetails);
    }

    @Get('my-withdrawals')
    async getMyWithdrawals(@CurrentUser('_id') userId: string, @Query() paginationDto: PaginationDto) {
        return this.walletsService.getMyWithdrawals(userId, paginationDto);
    }

    @Get('withdrawals/me')
    async getMyWithdrawalsMe(@CurrentUser('_id') userId: string, @Query() paginationDto: PaginationDto) {
        return this.walletsService.getMyWithdrawals(userId, paginationDto);
    }

    @Get('withdrawals')
    @Roles('superadmin', 'admin', 'finance')
    @UseGuards(RolesGuard)
    async getWithdrawals(@Query() paginationDto: PaginationDto, @Query('status') status?: string) {
        return this.walletsService.getWithdrawals(paginationDto, { status });
    }

    @Patch('withdrawals/:id/approve')
    @Roles('superadmin', 'admin', 'finance')
    @UseGuards(RolesGuard)
    async approveWithdrawal(@Param('id') id: string, @CurrentUser('_id') adminId: string) {
        return this.walletsService.approveWithdrawal(id, adminId);
    }

    @Patch('withdrawals/:id/reject')
    @Roles('superadmin', 'admin', 'finance')
    @UseGuards(RolesGuard)
    async rejectWithdrawal(@Param('id') id: string, @CurrentUser('_id') adminId: string, @Body('reason') reason: string) {
        return this.walletsService.rejectWithdrawal(id, adminId, reason);
    }

    @Patch('withdrawals/:id/pay')
    @Roles('superadmin', 'admin', 'finance')
    @UseGuards(RolesGuard)
    async markAsPaid(@Param('id') id: string, @Body('reference') reference: string) {
        return this.walletsService.markAsPaid(id, reference);
    }

    @Get('export/staff-salary')
    @Roles('superadmin', 'admin', 'finance')
    @UseGuards(RolesGuard)
    async exportStaffSalaryData() {
        return this.walletsService.exportStaffSalaryData();
    }

    @Post('fund')
    async requestFunding(
        @CurrentUser('_id') userId: string,
        @Body() body: { amount: number; proofUrl: string; description?: string },
    ) {
        return this.walletsService.requestFunding(userId, body.amount, body.proofUrl, body.description);
    }

    @Patch('transactions/:id/verify')
    @Roles('superadmin', 'admin', 'finance')
    @UseGuards(RolesGuard)
    async verifyFunding(
        @Param('id') id: string,
        @Body('status') status: 'completed' | 'failed',
        @CurrentUser('_id') adminId: string,
    ) {
        return this.walletsService.verifyFunding(id, status, adminId);
    }

    @Get('transactions/me')
    async getMyTransactions(@CurrentUser('_id') userId: string, @Query() paginationDto: PaginationDto) {
        return this.walletsService.getTransactionHistory(userId, paginationDto);
    }
}
