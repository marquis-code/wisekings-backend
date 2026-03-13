import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CurrenciesService {
    private readonly logger = new Logger(CurrenciesService.name);

    constructor(
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) {}

    // Hardcoded rates for now. In production, fetch from an external API.
    private readonly rates: Record<string, number> = {
        NGN: 1,      // Base currency
        USD: 0.00065, // Example rate: 1 NGN = 0.00065 USD
        EUR: 0.00060,
        GBP: 0.00052,
    };

    private readonly currencySymbols: Record<string, string> = {
        NGN: '₦',
        USD: '$',
        EUR: '€',
        GBP: '£',
    };

    async getRates() {
        const cacheKey = 'currency:rates';
        const cached = await this.cacheManager.get(cacheKey);
        if (cached) return cached;

        await this.cacheManager.set(cacheKey, this.rates, 86400);
        return this.rates;
    }

    async convert(amount: number, from: string, to: string): Promise<number> {
        const fromRate = this.rates[from];
        const toRate = this.rates[to];

        if (!fromRate || !toRate) {
            throw new Error(`Invalid currency: ${from} or ${to}`);
        }

        const baseAmount = amount / fromRate;
        return baseAmount * toRate;
    }

    async getCurrencies() {
        const cacheKey = 'currency:list';
        const cached = await this.cacheManager.get(cacheKey);
        if (cached) return cached;

        const result = Object.keys(this.rates).map(code => ({
            code,
            symbol: this.currencySymbols[code] || code,
            rate: this.rates[code],
        }));

        await this.cacheManager.set(cacheKey, result, 86400);
        return result;
    }
}
