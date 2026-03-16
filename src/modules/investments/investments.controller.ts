import { Controller, Get, Post, Body, Param, Put, Query, UseGuards } from '@nestjs/common';
import { InvestmentsService } from './investments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';

@Controller('investments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvestmentsController {
    constructor(private readonly investmentsService: InvestmentsService) {}

    @Post('proposals')
    @Roles('admin')
    async createProposal(@Body() dto: any) {
        return this.investmentsService.createProposal(dto);
    }

    @Get('proposals')
    async getProposals(@Query() query: any) {
        return this.investmentsService.findAllProposals(query);
    }

    @Get('proposals/:id')
    async getProposal(@Param('id') id: string) {
        return this.investmentsService.findProposalById(id);
    }

    @Post()
    @Roles('partner')
    async createInvestment(@Body() dto: any) {
        return this.investmentsService.createInvestment(dto);
    }

    @Get('my-investments')
    @Roles('partner')
    async getMyInvestments(@Query('partnerId') partnerId: string) {
        return this.investmentsService.findPartnerInvestments(partnerId);
    }

    @Get('all')
    @Roles('admin')
    async getAllInvestments(@Query() query: any) {
        return this.investmentsService.findAllInvestments(query);
    }

    @Put(':id/status')
    @Roles('admin')
    async updateStatus(@Param('id') id: string, @Body() update: any) {
        return this.investmentsService.updateInvestmentStatus(id, update);
    }

    // Investment Product Endpoints
    @Post('products')
    @Roles('admin')
    async createProduct(@Body() dto: any) {
        return this.investmentsService.createProduct(dto);
    }

    @Get('products')
    async getProducts(@Query() query: any) {
        return this.investmentsService.findAllProducts(query);
    }

    @Get('products/:id')
    async getProduct(@Param('id') id: string) {
        return this.investmentsService.findProductById(id);
    }

    @Put('products/:id')
    @Roles('admin')
    async updateProduct(@Param('id') id: string, @Body() update: any) {
        return this.investmentsService.updateProduct(id, update);
    }
}
