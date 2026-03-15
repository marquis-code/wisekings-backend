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
        const rawKey = this.configService.get<string>('GOOGLE_API_KEY') || this.configService.get<string>('GOOGLE_MAP_API_KEY') || '';
        this.googleApiKey = rawKey.replace(/"/g, '').trim();
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
                pricingTiers: []
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
                distanceMeters: 0,
                fee: 0,
                baseFee: config.baseFee,
                pricePerKm: config.pricePerKm,
                method: 'pickup'
            };
        }

        if (method === 'waybill') {
            return {
                distanceKm: 0,
                distanceMeters: 0,
                fee: config.waybillFee || 3500,
                baseFee: config.baseFee,
                pricePerKm: config.pricePerKm,
                method: 'waybill'
            };
        }

        const distanceMeters = await this.getDistance(config.warehouseLat, config.warehouseLng, destLat, destLng);
        const distanceKm = distanceMeters / 1000;

        let fee = 0;
        let usedTier = false;

        // Check for tiered pricing matches
        if (config.pricingTiers && config.pricingTiers.length > 0) {
            const match = config.pricingTiers.find(t => distanceMeters >= t.from && distanceMeters <= t.to);
            if (match) {
                fee = match.price;
                usedTier = true;
            }
        }

        // Fallback to km calculation if no tier matches or tiers aren't defined
        if (!usedTier) {
            fee = config.baseFee + (distanceKm * config.pricePerKm);
        }

        return {
            distanceKm: parseFloat(distanceKm.toFixed(2)),
            distanceMeters,
            fee: Math.round(fee),
            baseFee: config.baseFee,
            pricePerKm: config.pricePerKm,
            usedTier,
            method: 'lagos_dispatch'
        };
    }

    /**
     * Haversine formula: calculates the straight-line distance between two GPS coordinates.
     * Used as a reliable fallback when Google Distance Matrix API is unavailable.
     */
    private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const R = 6371000; // Earth's radius in meters
        const toRad = (deg: number) => (deg * Math.PI) / 180;
        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // distance in meters
    }

    private async getDistance(originLat: number, originLng: number, destLat: number, destLng: number): Promise<number> {
        // Try Google Distance Matrix API first
        if (this.googleApiKey) {
            try {
                const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originLat},${originLng}&destinations=${destLat},${destLng}&key=${this.googleApiKey}`;
                const response = await axios.get(url);

                if (response.data.status === 'OK' && response.data.rows[0].elements[0].status === 'OK') {
                    return response.data.rows[0].elements[0].distance.value; // in meters
                }

                this.logger.warn('Google Distance Matrix API returned non-OK status, falling back to Haversine:', response.data.status);
            } catch (error) {
                this.logger.warn('Google Distance Matrix API failed, falling back to Haversine:', error.message);
            }
        } else {
            this.logger.warn('GOOGLE_MAP_API_KEY is not defined, using Haversine fallback');
        }

        // Fallback: Haversine formula (straight-line distance * 1.3 for road approximation)
        const straightLine = this.haversineDistance(originLat, originLng, destLat, destLng);
        const estimatedRoadDistance = straightLine * 1.3;
        this.logger.log(`Haversine fallback: straight-line=${(straightLine / 1000).toFixed(2)}km, estimated road=${(estimatedRoadDistance / 1000).toFixed(2)}km`);
        return estimatedRoadDistance;
    }
}
