import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { IsOptional, IsString } from 'class-validator';
import { UserType } from '@common/constants';

export type UserDocument = User & Document;

@Schema({ timestamps: true, collection: 'users' })
export class User {
    @Prop({ required: true, trim: true })
    fullName: string;

    @Prop({ required: true, unique: true, lowercase: true, trim: true })
    email: string;

    @Prop({ required: true, select: false })
    password: string;

    @Prop({ trim: true })
    phone: string;

    @Prop({ type: String, enum: UserType, default: UserType.CUSTOMER })
    userType: UserType;

    @Prop({ type: String, default: 'user' })
    role: string;

    @Prop({ default: true })
    isActive: boolean;

    @Prop({ default: false })
    isEmailVerified: boolean;

    @Prop({ default: false })
    isInvited: boolean;

    @Prop()
    avatar: string;

    @Prop()
    lastLogin: Date;

    @Prop({ select: false })
    refreshToken: string;

    @Prop()
    passwordResetToken: string;

    @Prop()
    passwordResetExpires?: Date;

    @Prop()
    otpCode?: string;

    @Prop()
    otpExpires?: Date;

    @Prop({ type: [String], default: [] })
    fcmTokens: string[];

    @Prop({ type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' })
    applicationStatus: string;

    @Prop({ type: String, enum: ['pending_signature', 'signed'], default: 'pending_signature' })
    agreementStatus: string;

    @Prop()
    agreementSignedAt: Date;

    @Prop({ default: 0 })
    points: number;

    // AI Scaling Fields
    @Prop({ type: String, enum: ['active', 'at_risk', 'churned'], default: 'active' })
    engagementStatus: string;

    @Prop()
    churnProbability: number;

    @Prop({ type: [Types.ObjectId], ref: 'Product', default: [] })
    recommendedProducts: Types.ObjectId[];

    @IsOptional()
    @IsString()
    @Prop({ trim: true })
    country: string;

    @Prop({ default: 0 })
    leadScore: number;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ userType: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ isActive: 1 });
