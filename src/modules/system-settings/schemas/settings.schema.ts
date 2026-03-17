import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SystemSettingsDocument = SystemSettings & Document;

@Schema({ timestamps: true })
export class SystemSettings {
  @Prop({ 
    type: [{ 
      value: { type: String, required: true }, 
      label: { type: String, required: true },
      target: { type: String, enum: ['merchant', 'partner', 'both'], default: 'both' },
      isRequired: { type: Boolean, default: true },
      requiresIdNumber: { type: Boolean, default: true },
      requiresFileUpload: { type: Boolean, default: true },
      countries: { type: [String], default: [] }
    }], 
    default: [] 
  })
  kycDocumentTypes: { 
    value: string; 
    label: string;
    target: 'merchant' | 'partner' | 'both';
    isRequired: boolean;
    requiresIdNumber: boolean;
    requiresFileUpload: boolean;
    countries: string[];
  }[];

  @Prop({
    type: [{
      name: { type: String, required: true },
      percentage: { type: Number, required: true },
      description: { type: String }
    }],
    default: [
      { name: 'Standard', percentage: 3, description: 'Default merchant category' },
      { name: 'Gold', percentage: 5, description: '₦1M+ total sales' },
      { name: 'Premium', percentage: 7.5, description: '₦5M+ total sales' }
    ]
  })
  commissionRates: {
    name: string;
    percentage: number;
    description: string;
  }[];

  @Prop({
    type: [{
      name: { type: String, required: true },
      minSales: { type: Number, required: true },
      maxSales: { type: Number }
    }],
    default: [
      { name: 'Starter', minSales: 0, maxSales: 99999 },
      { name: 'Builder', minSales: 100000, maxSales: 499999 },
      { name: 'Silver', minSales: 500000, maxSales: 999999 },
      { name: 'Gold', minSales: 1000000, maxSales: 2999999 },
      { name: 'Platinum', minSales: 3000000, maxSales: 4999999 },
      { name: 'Diamond', minSales: 5000000 }
    ]
  })
  rankThresholds: {
    name: string;
    minSales: number;
    maxSales?: number;
  }[];

  @Prop({ default: 10000 })
  minWithdrawal: number;

  @Prop({ default: 30 })
  referralCookieLife: number;

  @Prop()
  whatsappNumber: string;
  
  @Prop({ type: Object })
  customerBankDetails: {
    accountName: string;
    accountNumber: string;
    bankName: string;
  };

  @Prop({ type: Object })
  merchantBankDetails: {
    accountName: string;
    accountNumber: string;
    bankName: string;
  };

  @Prop({ type: Object })
  partnerBankDetails: {
    accountName: string;
    accountNumber: string;
    bankName: string;
  };

  @Prop({ type: Object, default: {} })
  emailMappings: Record<string, string>;

  @Prop({
    type: [{
      name: { type: String, required: true },
      address: { type: String, required: true },
      phone: { type: String, required: true },
      isActive: { type: Boolean, default: true }
    }],
    default: [
      { name: 'Company Depot', address: '20, Olorunfunmi street behind philips factory ojota', phone: '', isActive: false },
      { name: 'Factory Address', address: '13, Sonubi street, off Bakare street ketu, Lagos', phone: '', isActive: true }
    ]
  })
  pickupLocations: {
    name: string;
    address: string;
    phone: string;
    isActive: boolean;
  }[];
}

export const SystemSettingsSchema = SchemaFactory.createForClass(SystemSettings);
