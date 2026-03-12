import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { SystemSettingsService } from './system-settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards';
import { Roles, Public } from '../../common/decorators';

@Controller('settings')
export class SystemSettingsController {
  constructor(private readonly settingsService: SystemSettingsService) {}

  @Public()
  @Get('kyc-documents')
  async getKycDocuments() {
    const settings = await this.settingsService.getSettings();
    return {
      success: true,
      data: settings.kycDocumentTypes,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super-admin', 'admin')
  @Patch('kyc-documents')
  async updateKycDocuments(@Body() body: { documentTypes: { value: string; label: string }[] }) {
    const updated = await this.settingsService.updateKycDocuments(body.documentTypes);
    return {
      success: true,
      message: 'KYC Document Types updated successfully',
      data: updated.kycDocumentTypes,
    };
  }
}
