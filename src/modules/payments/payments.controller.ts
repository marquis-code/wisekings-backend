import {
    Controller,
    Post,
    Body,
    Headers,
    Req,
    BadRequestException,
    UseGuards,
    RawBodyRequest,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { Public, CurrentUser } from '../../common/decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('payments')
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) { }

    @Post('paystack/initialize')
    @UseGuards(JwtAuthGuard)
    async initPaystack(
        @Body() body: { orderId: string; email: string; amount: number },
    ) {
        return this.paymentsService.initializePaystack(
            body.orderId,
            body.email,
            body.amount,
        );
    }

    @Public()
    @Post('paystack/webhook')
    async paystackWebhook(
        @Headers('x-paystack-signature') signature: string,
        @Body() payload: any,
    ) {
        if (!signature) throw new BadRequestException('Missing signature');
        return this.paymentsService.verifyPaystackWebhook(signature, payload);
    }

    @Post('stripe/intent')
    @UseGuards(JwtAuthGuard)
    async initStripe(
        @Body() body: { orderId: string; amount: number; currency?: string },
    ) {
        return this.paymentsService.createStripeIntent(
            body.orderId,
            body.amount,
            body.currency,
        );
    }

    @Public()
    @Post('stripe/webhook')
    async stripeWebhook(
        @Headers('stripe-signature') signature: string,
        @Req() req: RawBodyRequest<Request>,
    ) {
        if (!signature) throw new BadRequestException('Missing signature');
        return this.paymentsService.verifyStripeWebhook(signature, req.rawBody || Buffer.from(''));
    }
}
