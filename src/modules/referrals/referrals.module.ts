import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReferralsService } from './referrals.service';
import { ReferralsController } from './referrals.controller';
import { Referral, ReferralSchema } from './schemas/referral.schema';
import { MerchantSchema } from '../merchants/schemas/merchant.schema';
import { PartnerSchema } from '../partners/schemas/partner.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Referral.name, schema: ReferralSchema },
            { name: 'Merchant', schema: MerchantSchema },
            { name: 'Partner', schema: PartnerSchema },
        ]),
    ],
    controllers: [ReferralsController],
    providers: [ReferralsService],
    exports: [ReferralsService],
})
export class ReferralsModule { }
