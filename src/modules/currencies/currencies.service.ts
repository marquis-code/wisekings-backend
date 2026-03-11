import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class CurrenciesService {
    private readonly logger = new Logger(CurrenciesService.name);

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
        return Object.keys(this.rates).map(code => ({
            code,
            symbol: this.currencySymbols[code] || code,
            rate: this.rates[code],
        }));
    }
}
