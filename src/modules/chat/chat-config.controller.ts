import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ChatConfigService } from './chat-config.service';
import { Roles } from '@common/decorators';
import { AdminRole } from '@common/constants';
import { JwtAuthGuard } from '@modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';

@Controller('chat/config')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatConfigController {
    constructor(private readonly configService: ChatConfigService) { }

    @Get()
    @Roles(AdminRole.ADMIN, AdminRole.SUPERADMIN, AdminRole.SUPPORT)
    async getConfig() {
        return this.configService.getConfig();
    }

    @Patch()
    @Roles(AdminRole.ADMIN, AdminRole.SUPERADMIN)
    async updateConfig(@Body() updateDto: any) {
        return this.configService.updateConfig(updateDto);
    }
}
