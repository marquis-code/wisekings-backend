import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Order, OrderSchema } from './schemas/order.schema';
import { UserSchema } from '../users/schemas/user.schema';
import { CommissionsModule } from '../commissions/commissions.module';
import { ShippingModule } from '../shipping/shipping.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Order.name, schema: OrderSchema },
            { name: 'User', schema: UserSchema },
        ]),
        CommissionsModule,
        ShippingModule,
    ],
    controllers: [OrdersController],
    providers: [OrdersService],
    exports: [OrdersService],
})
export class OrdersModule { }
