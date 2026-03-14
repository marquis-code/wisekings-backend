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
}

export const SystemSettingsSchema = SchemaFactory.createForClass(SystemSettings);
