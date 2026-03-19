import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class CurrenciesService {
    private readonly logger = new Logger(CurrenciesService.name);
    private readonly apiKey: string;

    constructor(
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) {
        this.apiKey = this.configService.get<string>('exchangerate.apiKey', '');
    }

    // Fallback hardcoded rates
    private readonly fallbackRates: Record<string, number> = {
        NGN: 1,
        USD: 0.00065,
        EUR: 0.00060,
        GBP: 0.00052,
    };

    private readonly currencySymbols: Record<string, string> = {
        NGN: '₦',
        USD: '$',
        EUR: '€',
        GBP: '£',
    };

    async getRates(): Promise<Record<string, number>> {
        try {
            const url = `https://v6.exchangerate-api.com/v6/${this.apiKey}/latest/USD`;
            const { data } = await firstValueFrom(this.httpService.get(url));

            if (data?.result === 'success' && data?.conversion_rates) {
                const apiRates = data.conversion_rates;
                const ngnUsdRate = apiRates['NGN'];
                
                if (!ngnUsdRate) throw new Error('NGN rate not found in API response');

                const convertedRates: Record<string, number> = {};
                // We want NGN as base (1), so we divide all rates by NGN's USD rate
                // 1 NGN = apiRates[X] / apiRates['NGN'] of currency X
                ['NGN', 'USD', 'EUR', 'GBP'].forEach(code => {
                    if (apiRates[code]) {
                        convertedRates[code] = apiRates[code] / ngnUsdRate;
                    } else if (this.fallbackRates[code]) {
                        convertedRates[code] = this.fallbackRates[code];
                    }
                });

                this.logger.log('Currency rates updated from ExchangeRate API');
                return convertedRates;
            }
        } catch (error) {
            this.logger.error(`Failed to fetch exchange rates: ${error.message}`);
        }

        // Return fallback rates if API fails
        return this.fallbackRates;
    }

    async convert(amount: number, from: string, to: string): Promise<number> {
        const rates = await this.getRates();
        const fromRate = rates[from];
        const toRate = rates[to];

        if (!fromRate || !toRate) {
            this.logger.error(`Invalid currency conversion: ${from} to ${to}`);
            return amount; // Return original amount as safety
        }

        const baseAmount = amount / fromRate;
        return baseAmount * toRate;
    }

    async getCurrencies() {
        const rates = await this.getRates();
        const result = Object.keys(rates).map(code => ({
            code,
            symbol: this.currencySymbols[code] || code,
            rate: rates[code],
        }));

        return result;
    }
}
