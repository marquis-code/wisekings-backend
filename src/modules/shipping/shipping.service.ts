import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ShippingConfig, ShippingConfigDocument } from './schemas/shipping-config.schema';

@Injectable()
export class ShippingService {
    private readonly logger = new Logger(ShippingService.name);
    private readonly googleApiKey: string;

    constructor(
        @InjectModel(ShippingConfig.name) private configModel: Model<ShippingConfigDocument>,
        private configService: ConfigService,
    ) {
        this.googleApiKey = this.configService.get<string>('GOOGLE_MAP_API_KEY') || '';
    }

    async getConfig() {
        let config = await this.configModel.findOne({ isActive: true });
        if (!config) {
            // Create a default if none exists (Lagos, Nigeria example)
            config = await this.configModel.create({
                warehouseAddress: '20, Admiralty Way, Lekki Phase 1, Lagos',
                warehouseLat: 6.4478,
                warehouseLng: 3.4735,
                baseFee: 1000,
                pricePerKm: 200,
            });
        }
        return config;
    }

    async updateConfig(dto: Partial<ShippingConfig>) {
        return this.configModel.findOneAndUpdate({ isActive: true }, dto, { new: true, upsert: true });
    }

    async calculateDeliveryFee(destLat: number, destLng: number, method: 'pickup' | 'waybill' | 'lagos_dispatch' = 'lagos_dispatch') {
        const config = await this.getConfig();

        if (method === 'pickup') {
            return {
                distanceKm: 0,
                fee: 0,
                baseFee: config.baseFee,
                pricePerKm: config.pricePerKm,
                method: 'pickup'
            };
        }

        if (method === 'waybill') {
            return {
                distanceKm: 0,
                fee: config.waybillFee || 3500,
                baseFee: config.baseFee,
                pricePerKm: config.pricePerKm,
                method: 'waybill'
            };
        }

        const distance = await this.getDistance(config.warehouseLat, config.warehouseLng, destLat, destLng);

        // distance is in meters, convert to km
        const distanceKm = distance / 1000;
        const fee = config.baseFee + (distanceKm * config.pricePerKm);

        return {
            distanceKm: parseFloat(distanceKm.toFixed(2)),
            fee: Math.round(fee),
            baseFee: config.baseFee,
            pricePerKm: config.pricePerKm,
            method: 'lagos_dispatch'
        };
    }

    private async getDistance(originLat: number, originLng: number, destLat: number, destLng: number): Promise<number> {
        if (!this.googleApiKey) {
            this.logger.error('GOOGLE_MAP_API_KEY is not defined in environment');
            // Simplified fallback for testing (Haversine formula approximation or error)
            throw new InternalServerErrorException('Shipping calculation error');
        }

        try {
            const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originLat},${originLng}&destinations=${destLat},${destLng}&key=${this.googleApiKey}`;
            const response = await axios.get(url);

            if (response.data.status !== 'OK' || response.data.rows[0].elements[0].status !== 'OK') {
                this.logger.error('Google Distance Matrix API Error:', response.data);
                throw new InternalServerErrorException('Could not calculate distance');
            }

            return response.data.rows[0].elements[0].distance.value; // in meters
        } catch (error) {
            this.logger.error('Distance Fetch Error:', error);
            throw new InternalServerErrorException('Distance service unavailable');
        }
    }
}
