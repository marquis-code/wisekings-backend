import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import Stripe from 'stripe';
import * as crypto from 'crypto';
import { OrdersService } from '../orders/orders.service';
import { PaymentStatus } from '@common/constants';

@Injectable()
export class PaymentsService {
    private readonly logger = new Logger(PaymentsService.name);
    private readonly stripe: Stripe;
    private readonly paystackSecret: string;
    private readonly africanCountries = [
        'NG', 'Nigeria', 'GH', 'Ghana', 'KE', 'Kenya', 'ZA', 'South Africa',
        'RW', 'Rwanda', 'CI', 'Cote d\'Ivoire', 'SN', 'Senegal', 'TZ', 'Tanzania', 'UG', 'Uganda'
    ];

    constructor(
        private configService: ConfigService,
        private ordersService: OrdersService,
    ) {
        this.stripe = new Stripe(this.configService.get<string>('stripe.secretKey') || '', {
            apiVersion: '2023-10-16' as any,
        });
        this.paystackSecret = this.configService.get<string>('paystack.secretKey') || '';
    }

    async initializePayment(dto: { orderId: string; email: string; amount: number; currency: string; callbackUrl?: string }) {
        const { orderId, email, amount, currency } = dto;

        // Fetch order to check country for regional routing
        let routeToPaystack = currency.toUpperCase() === 'NGN';

        try {
            const order = await this.ordersService.findById(orderId);
            const country = order.shippingAddress?.country;

            if (country && this.africanCountries.some(c => country.toLowerCase().includes(c.toLowerCase()))) {
                routeToPaystack = true;
                this.logger.log(`Routing order ${orderId} to Paystack based on country: ${country}`);
            }
        } catch (error) {
            this.logger.warn(`Could not fetch order ${orderId} for country routing, falling back to currency check`);
        }

        if (routeToPaystack) {
            this.logger.log(`Routing order ${orderId} to Paystack`);
            return this.initializePaystack(orderId, email, amount);
        } else {
            this.logger.log(`Routing order ${orderId} to Stripe`);
            return this.createStripeIntent(orderId, amount, currency.toLowerCase());
        }
    }

    // --- Paystack logic ---
    async initializePaystack(orderId: string, email: string, amount: number) {
        const amountInKobo = Math.round(amount * 100);

        try {
            const response = await axios.post(
                'https://api.paystack.co/transaction/initialize',
                {
                    email,
                    amount: amountInKobo,
                    metadata: { orderId },
                    callback_url: this.configService.get<string>('paystack.callbackUrl') || 'http://localhost:3004/checkout/success',
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.paystackSecret}`,
                        'Content-Type': 'application/json',
                    },
                },
            );

            if (response.data.status) {
                return response.data.data;
            }
            throw new BadRequestException('Failed to initialize Paystack transaction');
        } catch (error) {
            this.logger.error(`Paystack Initialization Error: ${error.response?.data?.message || error.message}`);
            throw new BadRequestException('Could not initialize payment with Paystack');
        }
    }

    async verifyPaystackWebhook(signature: string, payload: any) {
        this.logger.log(`Received Paystack webhook: ${payload.event}`);
        
        // Secure Signature Verification
        const hash = crypto.createHmac('sha512', this.paystackSecret).update(JSON.stringify(payload)).digest('hex');

        if (hash !== signature) {
            this.logger.error('Invalid Paystack signature detected');
            throw new BadRequestException('Invalid signature');
        }

        const event = payload.event;
        this.logger.debug(`Paystack event payload: ${JSON.stringify(payload.data?.metadata)}`);

        if (event === 'charge.success') {
            const orderId = payload.data.metadata?.orderId || payload.data.metadata?.custom_fields?.find((f: any) => f.variable_name === 'orderId')?.value;
            const reference = payload.data.reference;

            if (orderId) {
                this.logger.log(`Confirming payment for Order ${orderId} (Ref: ${reference})`);
                await this.ordersService.updatePaymentStatus(
                    orderId,
                    PaymentStatus.PAID,
                    reference,
                    'paystack',
                );
            } else {
                this.logger.warn(`Paystack webhook received but no orderId found in metadata. Reference: ${reference}`);
            }
        }

        return { status: 'success' };
    }

    // --- Stripe logic ---
    async createStripeIntent(orderId: string, amount: number, currency = 'usd') {
        try {
            const intent = await this.stripe.paymentIntents.create({
                amount: Math.round(amount * 100), // Stripe expects cents
                currency,
                metadata: { orderId },
            });

            return {
                clientSecret: intent.client_secret,
                id: intent.id,
            };
        } catch (error) {
            this.logger.error(`Stripe Error: ${error.message}`);
            throw new BadRequestException('Could not create Stripe payment intent');
        }
    }

    async verifyStripeWebhook(signature: string, rawBody: Buffer) {
        const webhookSecret = this.configService.get<string>('stripe.webhookSecret') || '';
        let event: Stripe.Event;

        try {
            event = this.stripe.webhooks.constructEvent(
                rawBody,
                signature,
                webhookSecret,
            );
        } catch (err) {
            this.logger.error(`Stripe Webhook Error: ${err.message}`);
            throw new BadRequestException(`Webhook Error: ${err.message}`);
        }

        this.logger.log(`Received Stripe event: ${event.type}`);

        if (event.type === 'payment_intent.succeeded') {
            const intent = event.data.object as Stripe.PaymentIntent;
            const orderId = intent.metadata.orderId;

            if (orderId) {
                this.logger.log(`Confirming payment for Order ${orderId} via Stripe (ID: ${intent.id})`);
                await this.ordersService.updatePaymentStatus(
                    orderId,
                    PaymentStatus.PAID,
                    intent.id,
                    'stripe',
                );
            } else {
                this.logger.warn(`Stripe webhook received but no orderId found in metadata (ID: ${intent.id})`);
            }
        }

        return { received: true };
    }
}
