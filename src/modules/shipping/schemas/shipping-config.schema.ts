import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ShippingConfigDocument = ShippingConfig & Document;

@Schema({ _id: false })
export class InternationalZone {
    @Prop({ required: true })
    country: string;

    @Prop({ required: true, default: 11 })
    minWeight: number;

    @Prop({ required: true })
    baseRatePerKg: number;

    @Prop({ required: true, default: '2-3 Weeks' })
    deliveryTime: string;

    @Prop({ required: false, default: 0 })
    surchargePerKg: number; // In USD, specifically for Canada home delivery logic
}

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

    @Prop({
        type: [{
            from: { type: Number, required: true }, // meters
            to: { type: Number, required: true },   // meters
            price: { type: Number, required: true }
        }],
        default: []
    })
    pricingTiers: { from: number; to: number; price: number }[];

    @Prop({
        type: [SchemaFactory.createForClass(InternationalZone)],
        default: [
            { country: 'UK', minWeight: 11, baseRatePerKg: 8000, deliveryTime: '2-3 Weeks' },
            { country: 'US', minWeight: 11, baseRatePerKg: 14500, deliveryTime: '2-3 Weeks' },
            { country: 'Canada', minWeight: 11, baseRatePerKg: 6000, deliveryTime: '2-3 Weeks', surchargePerKg: 4 }
        ]
    })
    internationalZones: InternationalZone[];
}

export const ShippingConfigSchema = SchemaFactory.createForClass(ShippingConfig);
