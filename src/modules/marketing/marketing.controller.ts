import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
} from '@nestjs/common';
import { MarketingService } from './marketing.service';
import { Public, CurrentUser, Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { UseGuards } from '@nestjs/common';

@Controller('marketing')
export class MarketingController {
    constructor(private readonly marketingService: MarketingService) { }

    // === BANNERS ===
    @Post('banners')
    createBanner(@Body() data: any) {
        return this.marketingService.createBanner(data);
    }

    @Public()
    @Get('banners')
    getAllBanners(@Query() query: any) {
        return this.marketingService.getAllBanners(query);
    }

    @Public()
    @Get('banners/:id')
    getBannerById(@Param('id') id: string) {
        return this.marketingService.getBannerById(id);
    }

    @Patch('banners/:id')
    updateBanner(@Param('id') id: string, @Body() data: any) {
        return this.marketingService.updateBanner(id, data);
    }

    @Delete('banners/:id')
    deleteBanner(@Param('id') id: string) {
        return this.marketingService.deleteBanner(id);
    }

    // === PROMOTIONS ===
    @Post('promotions')
    createPromotion(@Body() data: any) {
        return this.marketingService.createPromotion(data);
    }

    @Public()
    @Get('promotions')
    getAllPromotions(@Query() query: any) {
        return this.marketingService.getAllPromotions(query);
    }

    @Public()
    @Get('promotions/:id')
    getPromotionById(@Param('id') id: string) {
        return this.marketingService.getPromotionById(id);
    }

    @Patch('promotions/:id')
    updatePromotion(@Param('id') id: string, @Body() data: any) {
        return this.marketingService.updatePromotion(id, data);
    }

    @Delete('promotions/:id')
    deletePromotion(@Param('id') id: string) {
        return this.marketingService.deletePromotion(id);
    }

    // === CAMPAIGNS ===
    @Post('campaigns')
    @Roles('superadmin', 'admin')
    @UseGuards(RolesGuard)
    async sendCampaign(
        @CurrentUser('_id') userId: string,
        @Body() data: any,
    ) {
        return this.marketingService.sendCampaign(userId, data);
    }

    @Get('campaigns')
    @Roles('superadmin', 'admin')
    @UseGuards(RolesGuard)
    async getCampaigns() {
        return this.marketingService.getCampaigns();
    }

    @Get('campaigns/:id')
    @Roles('superadmin', 'admin')
    @UseGuards(RolesGuard)
    async getCampaignById(@Param('id') id: string) {
        return this.marketingService.getCampaignById(id);
    }

    @Delete('campaigns/:id')
    @Roles('superadmin', 'admin')
    @UseGuards(RolesGuard)
    async deleteCampaign(@Param('id') id: string) {
        return this.marketingService.deleteCampaign(id);
    }
}
