import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SystemSettings, SystemSettingsDocument } from './schemas/settings.schema';

@Injectable()
export class SystemSettingsService implements OnModuleInit {
  private readonly logger = new Logger(SystemSettingsService.name);

  constructor(
    @InjectModel(SystemSettings.name) private settingsModel: Model<SystemSettingsDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
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
    const cacheKey = 'system:settings';
    const cached = await this.cacheManager.get<SystemSettingsDocument>(cacheKey);
    if (cached) return cached;

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

    await this.cacheManager.set(cacheKey, settings, 86400); // Cache for 24 hours
    return settings;
  }

  async updateKycDocuments(documentTypes: any[]): Promise<SystemSettings> {
    const settings = await this.getSettings();
    
    // Process and ensure values are slugs
    settings.kycDocumentTypes = documentTypes.map(doc => ({
      ...doc,
      value: doc.value || this.slugify(doc.label)
    }));

    const saved = await settings.save();
    await this.cacheManager.del('system:settings');
    return saved;
  }

  async updateSettings(dto: Partial<SystemSettings>): Promise<SystemSettings> {
    const settings = await this.getSettings();
    if (dto.whatsappNumber !== undefined) settings.whatsappNumber = dto.whatsappNumber;
    if (dto.customerBankDetails !== undefined) settings.customerBankDetails = dto.customerBankDetails;
    if (dto.merchantBankDetails !== undefined) settings.merchantBankDetails = dto.merchantBankDetails;
    if (dto.partnerBankDetails !== undefined) settings.partnerBankDetails = dto.partnerBankDetails;
    if (dto.commissionRates !== undefined) settings.commissionRates = dto.commissionRates;
    if (dto.rankThresholds !== undefined) settings.rankThresholds = dto.rankThresholds;
    if (dto.minWithdrawal !== undefined) settings.minWithdrawal = dto.minWithdrawal;
    if (dto.referralCookieLife !== undefined) settings.referralCookieLife = dto.referralCookieLife;
    
    const saved = await settings.save();
    await this.cacheManager.del('system:settings');
    return saved;
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w ]+/g, '')
      .replace(/ +/g, '_');
  }
}
