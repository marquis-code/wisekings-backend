import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ShippingConfig, ShippingConfigDocument } from './schemas/shipping-config.schema';
import { CurrenciesService } from '../currencies/currencies.service';

@Injectable()
export class ShippingService {
    private readonly logger = new Logger(ShippingService.name);
    private readonly googleApiKey: string;

    constructor(
        @InjectModel(ShippingConfig.name) private configModel: Model<ShippingConfigDocument>,
        private configService: ConfigService,
        private currenciesService: CurrenciesService,
    ) {
        const rawKey = this.configService.get<string>('GOOGLE_API_KEY') || this.configService.get<string>('GOOGLE_MAP_API_KEY') || '';
        this.googleApiKey = rawKey.replace(/"/g, '').trim();
    }

    async getConfig() {
        let config = await this.configModel.findOne({ isActive: true });
        if (!config) {
            // Create a default if none exists (Prompt admin to set it)
            config = await this.configModel.create({
                warehouseAddress: 'Please set warehouse address in Admin',
                warehouseLat: 0,
                warehouseLng: 0,
                baseFee: 0,
                pricePerKm: 0,
                pricingTiers: []
            });
        }
        return config;
    }

    async updateConfig(dto: Partial<ShippingConfig>) {
        return this.configModel.findOneAndUpdate({ isActive: true }, dto, { new: true, upsert: true });
    }

    async calculateDeliveryFee(
        destLat: number, 
        destLng: number, 
        method: 'pickup' | 'waybill' | 'lagos_dispatch' = 'lagos_dispatch',
        country: string = 'Nigeria',
        weight: number = 0,
        isHomeDelivery: boolean = false
    ) {
        const config = await this.getConfig();

        // 1. Check for International Zones
        const intZone = config.internationalZones?.find(z => z.country.toLowerCase() === country.toLowerCase());
        
        if (intZone) {
            if (weight < intZone.minWeight) {
                return {
                    error: `Minimum order weight for ${intZone.country} is ${intZone.minWeight}kg. Your current weight is ${weight}kg.`,
                    minWeight: intZone.minWeight,
                    currentWeight: weight,
                    isInternational: true
                };
            }

            let fee = weight * intZone.baseRatePerKg;
            let surcharge = 0;

            // Canada Home Delivery Surcharge ($4/kg)
            if (intZone.country === 'Canada' && isHomeDelivery && intZone.surchargePerKg > 0) {
                try {
                    const rates = await this.currenciesService.getRates();
                    const ngnRate = 1; // Base
                    const usdToNgn = 1 / (rates['USD'] || 0.00065); // Inverse of NGN/USD to get NGN per 1 USD
                    
                    surcharge = (intZone.surchargePerKg * weight) * usdToNgn; 
                    fee += surcharge;
                } catch (e) {
                    this.logger.error('Failed to calculate Canada surcharge:', e.message);
                }
            }

            return {
                distanceKm: 0,
                distanceMeters: 0,
                fee: Math.round(fee),
                baseFee: intZone.baseRatePerKg,
                method: 'international',
                deliveryTime: intZone.deliveryTime,
                isInternational: true,
                country: intZone.country,
                surcharge: Math.round(surcharge)
            };
        }

        // 2. Local Logic (Nigeria)
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
            method: 'lagos_dispatch',
            isInternational: false
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
