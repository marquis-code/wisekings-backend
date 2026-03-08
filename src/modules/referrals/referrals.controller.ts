import { Controller, Get, Post, Body, Query, Req } from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { Public } from '../../common/decorators';
import { Request } from 'express';

@Controller('referrals')
export class ReferralsController {
    constructor(private readonly referralsService: ReferralsService) { }

    @Public()
    @Post('track')
    async trackClick(@Body() body: { referralCode: string; landingPage: string; sessionId: string }, @Req() req: Request) {
        const ip = (req.headers['x-forwarded-for'] as string) || req.ip;
        const userAgent = req.headers['user-agent'];
        return this.referralsService.trackClick(body.referralCode, ip || '', userAgent || '', body.landingPage || '', body.sessionId || '');
    }

    @Public()
    @Get('resolve')
    async resolve(@Query('code') code: string) {
        return this.referralsService.resolveCode(code);
    }

    @Get('stats')
    async getStats(@Query('merchantId') merchantId?: string) {
        return this.referralsService.getStats(merchantId);
    }
}
