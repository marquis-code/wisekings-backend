import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiController {
    constructor(private readonly aiService: AiService) { }

    @Post('assistant')
    @Roles('admin', 'staff')
    askAssistant(@Body('question') question: string) {
        return this.aiService.askAssistant(question);
    }

    @Get('forecast')
    @Roles('admin')
    triggerForecast() {
        return this.aiService.predictDemand();
    }

    @Get('churn-analysis')
    @Roles('admin')
    triggerChurnAnalysis() {
        return this.aiService.analyzeChurn();
    }

    @Get('productivity')
    @Roles('admin')
    async getProductivityInsights() {
        return this.aiService.analyzeStaffProductivity();
    }
}
