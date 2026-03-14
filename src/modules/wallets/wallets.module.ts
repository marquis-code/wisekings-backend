import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WalletsService } from './wallets.service';
import { WalletsController } from './wallets.controller';
import { WalletSchema, WithdrawalSchema, TransactionSchema } from './schemas/wallet.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: 'Wallet', schema: WalletSchema },
            { name: 'Withdrawal', schema: WithdrawalSchema },
            { name: 'Transaction', schema: TransactionSchema },
        ]),
    ],
    controllers: [WalletsController],
    providers: [WalletsService],
    exports: [WalletsService, MongooseModule],
})
export class WalletsModule { }
