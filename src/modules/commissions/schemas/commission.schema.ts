import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { CommissionStatus } from '@common/constants';

export type CommissionDocument = Commission & Document;

@Schema({ timestamps: true, collection: 'commissions' })
export class Commission {
    @Prop({ type: Types.ObjectId, ref: 'Order', required: true })
    orderId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Merchant' })
    merchantId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    facilityMerchantId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Partner' })
    partnerId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    userId: Types.ObjectId;

    @Prop()
    staffCode: string;

    @Prop()
    notes: string;

    @Prop({ required: true, min: 0 })
    orderValue: number;

    @Prop({ required: true })
    commissionRate: number;

    @Prop({ required: true, min: 0 })
    commissionAmount: number;

    @Prop({ type: String, enum: CommissionStatus, default: CommissionStatus.PENDING })
    status: CommissionStatus;

    @Prop()
    calculatedAt: Date;

    @Prop()
    approvedAt: Date;

    @Prop()
    paidAt: Date;

    @Prop()
    reversedAt: Date;

    @Prop()
    reversalReason: string;

    @Prop()
    bonusAmount: number;

    @Prop()
    bonusReason: string;
}

export const CommissionSchema = SchemaFactory.createForClass(Commission);

CommissionSchema.index({ orderId: 1 });
CommissionSchema.index({ merchantId: 1 });
CommissionSchema.index({ partnerId: 1 });
CommissionSchema.index({ status: 1 });
CommissionSchema.index({ createdAt: -1 });
