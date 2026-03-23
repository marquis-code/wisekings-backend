import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import Stripe from 'stripe';
import * as crypto from 'crypto';
import { OrdersService } from '../orders/orders.service';
import { MailService } from '../mail/mail.service';
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
        private mailService: MailService,
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
        // Calculate amount to charge customer so business receives the full 'amount'
        // Paystack Fee (NGN): 1.5% + 100 NGN (100 NGN waived for < 2500 NGN)
        // Cap: 2000 NGN
        
        let amountToCharge = amount;
        if (amount < 2500) {
            amountToCharge = amount / (1 - 0.015);
        } else {
            amountToCharge = (amount + 100) / (1 - 0.015);
        }

        // If the calculated fee exceeds 2000, cap the fee at 2000
        if (amountToCharge - amount > 2000) {
            amountToCharge = amount + 2000;
        }

        const amountInKobo = Math.round(amountToCharge * 100);

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
            const customerEmail = payload.data.customer?.email || payload.data.metadata?.email;
            const amount = payload.data.amount / 100;

            if (orderId) {
                this.logger.log(`Confirming payment for Order ${orderId} (Ref: ${reference})`);
                await this.ordersService.updatePaymentStatus(
                    orderId,
                    PaymentStatus.PAID,
                    reference,
                    'paystack',
                );

                try {
                    const order = await this.ordersService.findById(orderId) as any;
                    
                    const customerHtml = this.mailService.brandWrapper(
                        'Payment Received',
                        `<p>Hi ${order.shippingAddress?.fullName || 'Valued Customer'},</p>
                        <p>We are thrilled to confirm that your payment for order <strong>#${order.orderNumber}</strong> was successful.</p>
                        <p>Total Paid: <strong>₦${amount.toLocaleString()}</strong></p>
                        <p>Our dispatch team is currently processing your items and will reach out with the tracking or delivery timeline shortly.</p>
                        <p>Thank you for choosing WiseKings!</p>`
                    );
                    const emailTo = customerEmail || order.shippingAddress?.email || order.customerId?.email;
                    if (emailTo) {
                        await this.mailService.sendEmail(emailTo, 'Payment Receipt - Order #' + order.orderNumber, customerHtml);
                    }

                    const adminHtml = this.mailService.brandWrapper(
                        'New Order Payment Confirmed',
                        `<p>A new Paystack payment has been successfully captured.</p>
                         <p>Order Number: <strong>${order.orderNumber}</strong></p>
                         <p>Amount Paid: <strong>₦${amount.toLocaleString()}</strong></p>
                         <p>Customer Name: ${order.shippingAddress?.fullName}</p>
                         <p>Customer Phone: ${order.shippingAddress?.phone}</p>
                         <div class="action-area">
                           <a href="${this.configService.get('ADMIN_URL') || 'https://admin.wisekings.ng'}/orders" class="btn">View Order Dashboard</a>
                         </div>`
                    );
                    await this.mailService.sendEmail('wisekingssnack@gmail.com', '🚨 Payment Received alert - Order #' + order.orderNumber, adminHtml);
                } catch (e) {
                    this.logger.error('Failed to dispatch Paystack email receipts: ' + e.message);
                }
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
