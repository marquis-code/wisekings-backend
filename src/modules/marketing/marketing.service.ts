import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Banner, BannerDocument } from './schemas/banner.schema';
import { Promotion, PromotionDocument } from './schemas/promotion.schema';
import { MarketingCampaign, MarketingCampaignDocument } from './schemas/marketing-campaign.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { MailService } from '../mail/mail.service';
import { UserType } from '@common/constants';
export class MarketingService {
    constructor(
        @InjectModel(Banner.name) private bannerModel: Model<BannerDocument>,
        @InjectModel(Promotion.name) private promotionModel: Model<PromotionDocument>,
        @InjectModel(MarketingCampaign.name) private campaignModel: Model<MarketingCampaignDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private readonly mailService: MailService,
    ) { }

    // === BANNERS ===
    async createBanner(data: Partial<Banner>) {
        return this.bannerModel.create(data);
    }

    async getAllBanners(query: any = {}) {
        const { position, isActive } = query;
        const filter: any = {};
        if (position) filter.position = position;
        if (isActive !== undefined) filter.isActive = isActive === 'true';
        return this.bannerModel.find(filter).sort({ sortOrder: 1 }).exec();
    }

    async getBannerById(id: string) {
        const banner = await this.bannerModel.findById(id);
        if (!banner) throw new NotFoundException('Banner not found');
        return banner;
    }

    async updateBanner(id: string, data: Partial<Banner>) {
        const banner = await this.bannerModel.findByIdAndUpdate(id, data, { new: true });
        if (!banner) throw new NotFoundException('Banner not found');
        return banner;
    }

    async deleteBanner(id: string) {
        const banner = await this.bannerModel.findByIdAndDelete(id);
        if (!banner) throw new NotFoundException('Banner not found');
        return { message: 'Banner deleted' };
    }

    // === PROMOTIONS ===
    async createPromotion(data: Partial<Promotion>) {
        return this.promotionModel.create(data);
    }

    async getAllPromotions(query: any = {}) {
        const { type, isActive } = query;
        const filter: any = {};
        if (type) filter.type = type;
        if (isActive !== undefined) filter.isActive = isActive === 'true';
        return this.promotionModel.find(filter).sort({ sortOrder: 1 }).populate('products').exec();
    }

    async getPromotionById(id: string) {
        const promo = await this.promotionModel.findById(id).populate('products');
        if (!promo) throw new NotFoundException('Promotion not found');
        return promo;
    }

    async updatePromotion(id: string, data: Partial<Promotion>) {
        const promo = await this.promotionModel.findByIdAndUpdate(id, data, { new: true });
        if (!promo) throw new NotFoundException('Promotion not found');
        return promo;
    }

    async deletePromotion(id: string) {
        const promo = await this.promotionModel.findByIdAndDelete(id);
        if (!promo) throw new NotFoundException('Promotion not found');
        return { message: 'Promotion deleted' };
    }

    // === CAMPAIGNS ===
    async sendCampaign(userId: string, data: { title: string; subject: string; content: string; targetAudience: 'merchants' | 'partners' | 'customers' | 'all' }) {
        const filter: any = { isActive: true };
        if (data.targetAudience === 'merchants') filter.userType = UserType.MERCHANT;
        else if (data.targetAudience === 'partners') filter.userType = UserType.PARTNER;
        else if (data.targetAudience === 'customers') filter.userType = UserType.CUSTOMER;

        const users = await this.userModel.find(filter).select('email fullName').lean();
        const campaign = await this.campaignModel.create({
            ...data,
            createdBy: userId,
            recipientsCount: users.length,
            sentAt: new Date(),
        });

        const failedEmails: string[] = [];

        // Sending in batches or concurrently (using Resend which handles some concurrency)
        // For simplicity, we loop, but in production, a queue/worker is better
        for (const user of users) {
            try {
                await this.mailService.sendEmail(user.email, data.subject, data.content);
            } catch (err) {
                failedEmails.push(user.email);
            }
        }

        if (failedEmails.length > 0) {
            await this.campaignModel.findByIdAndUpdate(campaign._id, { failedEmails });
        }

        return { message: `Campaign sent to ${users.length - failedEmails.length} users successfully`, campaignId: campaign._id };
    }

    async getCampaigns() {
        return this.campaignModel.find().sort({ sentAt: -1 }).populate('createdBy', 'fullName').exec();
    }
}
