import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PartnersService } from './partners.service';
import { PartnersController } from './partners.controller';
import { Partner, PartnerSchema } from './schemas/partner.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { WalletSchema } from '../wallets/schemas/wallet.schema';

import { MailModule } from '../mail/mail.module';
import { SystemSettingsModule } from '../system-settings/system-settings.module';

@Module({
    imports: [
        MailModule,
        SystemSettingsModule,
        MongooseModule.forFeature([
            { name: Partner.name, schema: PartnerSchema },
            { name: User.name, schema: UserSchema },
            { name: 'Wallet', schema: WalletSchema },
        ]),
    ],
    controllers: [PartnersController],
    providers: [PartnersService],
    exports: [PartnersService, MongooseModule],
})
export class PartnersModule { }
