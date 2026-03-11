import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';
import { Banner, BannerSchema } from './schemas/banner.schema';
import { Promotion, PromotionSchema } from './schemas/promotion.schema';
import { MarketingCampaign, MarketingCampaignSchema } from './schemas/marketing-campaign.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { MailModule } from '../mail/mail.module';

@Module({
    imports: [
        MailModule,
        MongooseModule.forFeature([
            { name: Banner.name, schema: BannerSchema },
            { name: Promotion.name, schema: PromotionSchema },
            { name: MarketingCampaign.name, schema: MarketingCampaignSchema },
            { name: User.name, schema: UserSchema },
        ]),
    ],
    controllers: [MarketingController],
    providers: [MarketingService],
    exports: [MarketingService],
})
export class MarketingModule { }
