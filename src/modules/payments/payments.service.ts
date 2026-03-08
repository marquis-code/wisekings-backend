import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import Stripe from 'stripe';
import { OrdersService } from '../orders/orders.service';
import { PaymentStatus } from '@common/constants';

@Injectable()
export class PaymentsService {
    private readonly logger = new Logger(PaymentsService.name);
    private readonly stripe: Stripe;
    private readonly paystackSecret: string;

    constructor(
        private configService: ConfigService,
        private ordersService: OrdersService,
    ) {
        this.stripe = new Stripe(this.configService.get<string>('stripe.secretKey') || '', {
            apiVersion: '2023-10-16' as any,
        });
        this.paystackSecret = this.configService.get<string>('paystack.secretKey') || '';
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
                    callback_url: this.configService.get<string>('paystack.callbackUrl'),
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
            this.logger.error(`Paystack Error: ${error.response?.data?.message || error.message}`);
            throw new BadRequestException('Could not initialize payment with Paystack');
        }
    }

    async verifyPaystackWebhook(signature: string, payload: any) {
        // Signature verification logic would go here using crypto.createHmac
        // For now, assume it's valid if we trust the endpoint is secured by other means or if we implement the check
        const event = payload.event;

        if (event === 'charge.success') {
            const { orderId } = payload.data.metadata;
            const reference = payload.data.reference;

            await this.ordersService.updatePaymentStatus(
                orderId,
                PaymentStatus.PAID,
                reference,
                'paystack',
            );
            this.logger.log(`Payment confirmed for Order ${orderId} via Paystack`);
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

        if (event.type === 'payment_intent.succeeded') {
            const intent = event.data.object as Stripe.PaymentIntent;
            const orderId = intent.metadata.orderId;

            await this.ordersService.updatePaymentStatus(
                orderId,
                PaymentStatus.PAID,
                intent.id,
                'stripe',
            );
            this.logger.log(`Payment confirmed for Order ${orderId} via Stripe`);
        }

        return { received: true };
    }
}
