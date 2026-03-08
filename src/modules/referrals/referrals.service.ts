import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Referral, ReferralDocument } from './schemas/referral.schema';
import { REFERRAL_COOKIE_DAYS } from '@common/constants';

@Injectable()
export class ReferralsService {
    private readonly logger = new Logger(ReferralsService.name);

    constructor(
        @InjectModel(Referral.name) private referralModel: Model<ReferralDocument>,
        @InjectModel('Merchant') private merchantModel: Model<any>,
        @InjectModel('Partner') private partnerModel: Model<any>,
    ) { }

    async trackClick(referralCode: string, ipAddress: string, userAgent: string, landingPage: string, sessionId: string) {
        // Check for self-referral abuse (same IP clicking multiple times)
        const recentClick = await this.referralModel.findOne({
            referralCode,
            ipAddress,
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        });

        if (recentClick) {
            this.logger.warn(`Duplicate referral click from IP ${ipAddress} for code ${referralCode}`);
            return { existing: true, referral: recentClick };
        }

        // Find merchant or partner by code
        let merchantId: Types.ObjectId | null = null;
        let partnerId: Types.ObjectId | null = null;

        const merchant = await this.merchantModel.findOne({ merchantCode: referralCode, status: 'active' }).lean();
        if (merchant) {
            merchantId = (merchant as any)._id;
        } else {
            const partner = await this.partnerModel.findOne({ partnerCode: referralCode, status: 'active' }).lean();
            if (partner) partnerId = (partner as any)._id;
        }

        if (!merchantId && !partnerId) {
            return { valid: false, message: 'Invalid referral code' };
        }

        const cookieExpiry = new Date(Date.now() + REFERRAL_COOKIE_DAYS * 24 * 60 * 60 * 1000);

        const referral = await this.referralModel.create({
            referralCode,
            merchantId,
            partnerId,
            ipAddress,
            userAgent,
            landingPage,
            sessionId,
            status: 'clicked',
            cookieExpiry,
        });

        return {
            valid: true,
            referral,
            cookieExpiry,
            merchantId: merchantId?.toString(),
            partnerId: partnerId?.toString(),
        };
    }

    async resolveCode(code: string) {
        const merchant = await this.merchantModel.findOne({ merchantCode: code, status: 'active' }).lean();
        if (merchant) return { type: 'merchant', id: (merchant as any)._id, code: (merchant as any).merchantCode };

        const partner = await this.partnerModel.findOne({ partnerCode: code, status: 'active' }).lean();
        if (partner) return { type: 'partner', id: (partner as any)._id, code: (partner as any).partnerCode };

        return null;
    }

    async convertReferral(referralCode: string, customerId: string, orderId: string) {
        const referral = await this.referralModel.findOneAndUpdate(
            { referralCode, status: 'clicked', cookieExpiry: { $gte: new Date() } },
            {
                status: 'converted',
                customerId: new Types.ObjectId(customerId),
                convertedOrderId: new Types.ObjectId(orderId),
            },
            { new: true, sort: { createdAt: -1 } },
        );
        return referral;
    }

    async getStats(merchantId?: string) {
        const filter: any = {};
        if (merchantId) filter.merchantId = new Types.ObjectId(merchantId);

        const [clicks, conversions] = await Promise.all([
            this.referralModel.countDocuments({ ...filter, status: 'clicked' }),
            this.referralModel.countDocuments({ ...filter, status: 'converted' }),
        ]);

        return {
            totalClicks: clicks + conversions,
            totalConversions: conversions,
            conversionRate: clicks + conversions > 0 ? ((conversions / (clicks + conversions)) * 100).toFixed(2) : '0',
        };
    }
}
