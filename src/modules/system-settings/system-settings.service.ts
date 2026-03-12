import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SystemSettings, SystemSettingsDocument } from './schemas/settings.schema';

@Injectable()
export class SystemSettingsService implements OnModuleInit {
  private readonly logger = new Logger(SystemSettingsService.name);

  constructor(
    @InjectModel(SystemSettings.name) private settingsModel: Model<SystemSettingsDocument>,
  ) {}

  async onModuleInit() {
    await this.initializeDefaults();
  }

  private async initializeDefaults() {
    const existing = await this.settingsModel.findOne().exec();
    if (!existing) {
      this.logger.log('Initializing default System Settings');
      await this.settingsModel.create({
        kycDocumentTypes: [
          { value: 'national_id', label: 'National Identification Card (NIN)', target: 'both', isRequired: true, requiresIdNumber: true, requiresFileUpload: true, countries: [] },
          { value: 'voters_card', label: 'Permanent Voters Card (PVC)', target: 'both', isRequired: true, requiresIdNumber: true, requiresFileUpload: true, countries: [] },
          { value: 'drivers_license', label: "Driver's License", target: 'both', isRequired: true, requiresIdNumber: true, requiresFileUpload: true, countries: [] },
          { value: 'intl_passport', label: 'International Passport', target: 'both', isRequired: true, requiresIdNumber: true, requiresFileUpload: true, countries: [] },
          { value: 'cac_certificate', label: 'CAC Registration Certificate', target: 'both', isRequired: true, requiresIdNumber: true, requiresFileUpload: true, countries: [] },
          { value: 'tax_id_cert', label: 'Tax Identification (TIN) Certificate', target: 'both', isRequired: true, requiresIdNumber: true, requiresFileUpload: true, countries: [] },
          { value: 'proof_of_address', label: 'Utility Bill (Proof of Address)', target: 'both', isRequired: true, requiresIdNumber: false, requiresFileUpload: true, countries: [] },
          { value: 'directors_id', label: 'Goverment Issued ID (Director)', target: 'both', isRequired: true, requiresIdNumber: true, requiresFileUpload: true, countries: [] },
        ],
        whatsappNumber: '2348147626501',
      });
    }
  }

  async getSettings(): Promise<SystemSettingsDocument> {
    let settings = await this.settingsModel.findOne().exec();
    if (!settings) {
      settings = await this.settingsModel.create({
        kycDocumentTypes: [
          { value: 'national_id', label: 'National Identification Card (NIN)', target: 'both', isRequired: true, requiresIdNumber: true, requiresFileUpload: true, countries: [] },
          { value: 'voters_card', label: 'Permanent Voters Card (PVC)', target: 'both', isRequired: true, requiresIdNumber: true, requiresFileUpload: true, countries: [] },
          { value: 'drivers_license', label: "Driver's License", target: 'both', isRequired: true, requiresIdNumber: true, requiresFileUpload: true, countries: [] },
          { value: 'intl_passport', label: 'International Passport', target: 'both', isRequired: true, requiresIdNumber: true, requiresFileUpload: true, countries: [] },
          { value: 'cac_certificate', label: 'CAC Registration Certificate', target: 'both', isRequired: true, requiresIdNumber: true, requiresFileUpload: true, countries: [] },
          { value: 'tax_id_cert', label: 'Tax Identification (TIN) Certificate', target: 'both', isRequired: true, requiresIdNumber: true, requiresFileUpload: true, countries: [] },
          { value: 'proof_of_address', label: 'Utility Bill (Proof of Address)', target: 'both', isRequired: true, requiresIdNumber: false, requiresFileUpload: true, countries: [] },
          { value: 'directors_id', label: 'Goverment Issued ID (Director)', target: 'both', isRequired: true, requiresIdNumber: true, requiresFileUpload: true, countries: [] },
        ]
      });
    }
    return settings;
  }

  async updateKycDocuments(documentTypes: any[]): Promise<SystemSettings> {
    const settings = await this.getSettings();
    
    // Process and ensure values are slugs
    settings.kycDocumentTypes = documentTypes.map(doc => ({
      ...doc,
      value: doc.value || this.slugify(doc.label)
    }));

    return settings.save();
  }

  async updateSettings(dto: Partial<SystemSettings>): Promise<SystemSettings> {
    const settings = await this.getSettings();
    if (dto.whatsappNumber !== undefined) settings.whatsappNumber = dto.whatsappNumber;
    return settings.save();
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w ]+/g, '')
      .replace(/ +/g, '_');
  }
}
