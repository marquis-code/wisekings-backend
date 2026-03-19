import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ShelfReportDocument = ShelfReport & Document;

@Schema({ timestamps: true, collection: 'shelf_reports' })
export class ShelfReport {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    facilityMerchantId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Merchant', required: true })
    merchantId: Types.ObjectId;

    @Prop({ required: true })
    shelfPhoto: string;

    @Prop({ required: true, min: 0 })
    reportedStockCount: number;

    @Prop()
    notes: string;
}

export const ShelfReportSchema = SchemaFactory.createForClass(ShelfReport);

ShelfReportSchema.index({ facilityMerchantId: 1 });
ShelfReportSchema.index({ merchantId: 1 });
ShelfReportSchema.index({ createdAt: -1 });
