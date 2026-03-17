import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShippingService } from './shipping.service';
import { ShippingController } from './shipping.controller';
import { ShippingConfig, ShippingConfigSchema } from './schemas/shipping-config.schema';
import { CurrenciesModule } from '../currencies/currencies.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: ShippingConfig.name, schema: ShippingConfigSchema }
        ]),
        CurrenciesModule
    ],
    providers: [ShippingService],
    controllers: [ShippingController],
    exports: [ShippingService],
})
export class ShippingModule { }
