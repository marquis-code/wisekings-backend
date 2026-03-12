import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ShippingConfigDocument = ShippingConfig & Document;

@Schema({ timestamps: true, collection: 'shipping_configs' })
export class ShippingConfig {
    @Prop({ required: true, default: 'Default Warehouse' })
    warehouseName: string;

    @Prop({ required: true })
    warehouseAddress: string;

    @Prop({ required: true })
    warehouseLat: number;

    @Prop({ required: true })
    warehouseLng: number;

    @Prop({ required: true, default: 0 })
    baseFee: number;

    @Prop({ required: true, default: 0 })
    pricePerKm: number;

    @Prop({ required: true, default: 2500 })
    waybillFee: number;

    @Prop({ required: false })
    pickupAddress: string;

    @Prop({ default: true })
    isActive: boolean;
}

export const ShippingConfigSchema = SchemaFactory.createForClass(ShippingConfig);
