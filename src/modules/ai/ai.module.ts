import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Ticket, TicketSchema } from '../support/schemas/ticket.schema';
import { AuditLog, AuditLogSchema } from '../audit/schemas/audit-log.schema';

@Global()
@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Order.name, schema: OrderSchema },
            { name: Product.name, schema: ProductSchema },
            { name: User.name, schema: UserSchema },
            { name: Ticket.name, schema: TicketSchema },
            { name: AuditLog.name, schema: AuditLogSchema },
        ]),
        ConfigModule,
    ],
    controllers: [AiController],
    providers: [AiService],
    exports: [AiService],
})
export class AiModule { }
