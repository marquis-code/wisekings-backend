import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MerchantsService } from './merchants.service';
import { MerchantsController } from './merchants.controller';
import { Merchant, MerchantSchema } from './schemas/merchant.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { WalletSchema } from '../wallets/schemas/wallet.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';

import { MailModule } from '../mail/mail.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';

@Module({
    imports: [
        MailModule,
        SystemSettingsModule,
        MongooseModule.forFeature([
            { name: Merchant.name, schema: MerchantSchema },
            { name: User.name, schema: UserSchema },
            { name: 'Wallet', schema: WalletSchema },
            { name: Order.name, schema: OrderSchema },
        ]),
    ],
    controllers: [MerchantsController],
    providers: [MerchantsService],
    exports: [MerchantsService, MongooseModule],
})
export class MerchantsModule { }
