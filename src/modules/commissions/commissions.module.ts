import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommissionsService } from './commissions.service';
import { CommissionsController } from './commissions.controller';
import { Commission, CommissionSchema } from './schemas/commission.schema';
import { MerchantSchema } from '../merchants/schemas/merchant.schema';
import { PartnerSchema } from '../partners/schemas/partner.schema';
import { WalletSchema } from '../wallets/schemas/wallet.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Commission.name, schema: CommissionSchema },
            { name: 'Merchant', schema: MerchantSchema },
            { name: 'Partner', schema: PartnerSchema },
            { name: 'Wallet', schema: WalletSchema },
        ]),
    ],
    controllers: [CommissionsController],
    providers: [CommissionsService],
    exports: [CommissionsService],
})
export class CommissionsModule { }
