import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { OrderStatus, PaymentStatus, PaymentProvider } from '@common/constants';

export type OrderDocument = Order & Document;

@Schema({ timestamps: true, collection: 'orders' })
export class Order {
    @Prop({ required: true, unique: true })
    orderNumber: string;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    customerId: Types.ObjectId;

    @Prop({
        type: [{
            productId: { type: Types.ObjectId, ref: 'Product' },
            name: String,
            price: Number,
            quantity: Number,
            image: String,
        }],
        required: true,
    })
    items: {
        productId: Types.ObjectId;
        name: string;
        price: number;
        quantity: number;
        image: string;
    }[];

    @Prop({ required: true, min: 0 })
    totalAmount: number;

    @Prop({ default: 0 })
    shippingFee: number;

    @Prop({ default: 0 })
    discount: number;

    @Prop({ type: String, enum: ['pickup', 'delivery'], default: 'delivery' })
    deliveryMethod: string;

    @Prop({ type: Object })
    deliveryLocation: {
        lat: number;
        lng: number;
    };

    @Prop({ type: String, enum: OrderStatus, default: OrderStatus.PENDING })
    status: OrderStatus;

    @Prop({ type: String, enum: PaymentStatus, default: PaymentStatus.PENDING })
    paymentStatus: PaymentStatus;

    @Prop({ type: String, enum: PaymentProvider })
    paymentProvider: PaymentProvider;

    @Prop()
    paymentReference: string;

    @Prop({ type: Types.ObjectId, ref: 'Merchant', default: null })
    merchantId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Partner', default: null })
    partnerId: Types.ObjectId;

    @Prop()
    referralCode: string;

    @Prop({ type: Object })
    shippingAddress: {
        fullName: string;
        phone: string;
        address: string;
        city: string;
        state: string;
        country: string;
        zipCode: string;
    };

    @Prop()
    notes: string;

    @Prop()
    completedAt: Date;

    @Prop()
    cancelledAt: Date;

    @Prop()
    cancellationReason: string;

    // AI Scaling Fields
    @Prop({ default: 0 })
    followUpEscalationLevel: number;

    @Prop()
    lastAiReminderSentAt: Date;

    @Prop({ type: Object })
    aiRiskAnalysis: {
        fraudScore: number;
        flaggedReasons: string[];
        isAnomaly: boolean;
    };
}

export const OrderSchema = SchemaFactory.createForClass(Order);

OrderSchema.index({ customerId: 1 });
OrderSchema.index({ merchantId: 1 });
OrderSchema.index({ partnerId: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ paymentStatus: 1 });
OrderSchema.index({ referralCode: 1 });
OrderSchema.index({ createdAt: -1 });
