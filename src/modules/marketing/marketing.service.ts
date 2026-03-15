import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Banner, BannerDocument } from './schemas/banner.schema';
import { Promotion, PromotionDocument } from './schemas/promotion.schema';
import { MarketingCampaign, MarketingCampaignDocument } from './schemas/marketing-campaign.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { MailService } from '../mail/mail.service';
import { UserType } from '@common/constants';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class MarketingService {
    private readonly logger = new Logger(MarketingService.name);
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
    async sendCampaign(userId: string, data: { 
        title: string; 
        subject: string; 
        content: string; 
        bannerUrl?: string; 
        previewText?: string; 
        targetAudience: 'merchants' | 'partners' | 'customers' | 'all' | 'custom'; 
        customEmails?: string[];
        scheduledAt?: Date;
        isRecurring?: boolean;
        cronExpression?: string;
    }) {
        const campaign = await this.campaignModel.create({
            ...data,
            createdBy: userId,
            status: data.scheduledAt ? 'scheduled' : 'sent',
            sentAt: data.scheduledAt ? null : new Date(),
        });

        if (data.scheduledAt) {
            return { message: 'Campaign scheduled successfully', campaignId: campaign._id };
        }

        return this.executeCampaign(campaign);
    }

    async executeCampaign(campaign: MarketingCampaignDocument) {
        let users: { email: string; fullName?: string }[] = [];

        if (campaign.targetAudience === 'custom' && campaign.customEmails) {
            users = campaign.customEmails.map(email => ({ email: email.trim() }));
        } else {
            const filter: any = { isActive: true };
            if (campaign.targetAudience === 'merchants') filter.userType = UserType.MERCHANT;
            else if (campaign.targetAudience === 'partners') filter.userType = UserType.PARTNER;
            else if (campaign.targetAudience === 'customers') filter.userType = UserType.CUSTOMER;

            users = await this.userModel.find(filter).select('email fullName').lean();
        }

        // Update campaign with recipient count
        await this.campaignModel.findByIdAndUpdate(campaign._id, { recipientsCount: users.length, sentAt: new Date(), status: 'sent' });

        const failedEmails: string[] = [];
        const plainText = this.stripHtml(campaign.content);
        const htmlContent = this.formatCampaignHtml(campaign);

        for (const user of users) {
            try {
                await this.mailService.sendEmail(user.email, campaign.subject, htmlContent, undefined, undefined, plainText);
            } catch (err) {
                failedEmails.push(user.email);
            }
        }

        if (failedEmails.length > 0) {
            await this.campaignModel.findByIdAndUpdate(campaign._id, { failedEmails });
        }

        return { message: `Campaign sent to ${users.length - failedEmails.length} users successfully`, campaignId: campaign._id };
    }

    private stripHtml(html: string): string {
        return html.replace(/<[^>]*>?/gm, '').trim();
    }

    private formatCampaignHtml(campaign: any): string {
        let bannerHtml = '';
        if (campaign.bannerUrl) {
            bannerHtml = `
                <div style="margin-bottom: 32px; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
                    <img src="${campaign.bannerUrl}" style="width: 100%; display: block;" alt="Campaign Banner" />
                </div>`;
        }

        const bodyContent = `
            ${bannerHtml}
            <div style="font-size: 16px; line-height: 1.8; color: #475569;">
                ${campaign.content}
            </div>
            <p style="margin-top: 40px; font-size: 13px; color: #94a3b8; text-align: center; font-style: italic;">
                You are receiving this because you are a valued member of WiseKings.
            </p>
        `;

        return this.mailService.brandWrapper(campaign.title, bodyContent);
    }

    @Cron(CronExpression.EVERY_MINUTE)
    async handleScheduledCampaigns() {
        const now = new Date();
        const pending = await this.campaignModel.find({
            status: 'scheduled',
            scheduledAt: { $lte: now },
            isRecurring: false
        });

        for (const campaign of pending) {
            this.logger.log(`Executing scheduled campaign: ${campaign.title}`);
            await this.executeCampaign(campaign);
        }

        // Note: Recurring campaigns (Cron Expression based) should ideally be handled by a more dynamic scheduler 
        // if they are truly user-defined. For simplicity here, we'll just handle basic scheduling.
    }

    async getCampaigns() {
        return this.campaignModel.find().sort({ sentAt: -1 }).populate('createdBy', 'fullName').exec();
    }

    async getCampaignById(id: string) {
        const campaign = await this.campaignModel.findById(id).populate('createdBy', 'fullName');
        if (!campaign) throw new NotFoundException('Campaign not found');
        return campaign;
    }

    async deleteCampaign(id: string) {
        const campaign = await this.campaignModel.findByIdAndDelete(id);
        if (!campaign) throw new NotFoundException('Campaign not found');
        return { message: 'Campaign deleted' };
    }
}
