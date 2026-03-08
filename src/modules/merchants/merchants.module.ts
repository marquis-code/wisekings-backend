import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MerchantsService } from './merchants.service';
import { MerchantsController } from './merchants.controller';
import { Merchant, MerchantSchema } from './schemas/merchant.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Wallet, WalletSchema } from '../wallets/schemas/wallet.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Merchant.name, schema: MerchantSchema },
            { name: User.name, schema: UserSchema },
            { name: 'Wallet', schema: WalletSchema },
        ]),
    ],
    controllers: [MerchantsController],
    providers: [MerchantsService],
    exports: [MerchantsService, MongooseModule],
})
export class MerchantsModule { }
