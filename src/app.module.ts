import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';

import configuration from './config/configuration';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { MerchantsModule } from './modules/merchants/merchants.module';
import { PartnersModule } from './modules/partners/partners.module';
import { ProductsModule } from './modules/products/products.module';
import { OrdersModule } from './modules/orders/orders.module';
import { CommissionsModule } from './modules/commissions/commissions.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ChatModule } from './modules/chat/chat.module';
import { AuditModule } from './modules/audit/audit.module';
import { UploadsModule } from './modules/uploads/uploads.module';

import { GlobalExceptionFilter } from './common/filters';
import { TransformInterceptor, AuditInterceptor } from './common/interceptors';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

@Module({
    imports: [
        // Configuration
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
        }),

        // Database
        MongooseModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                uri: configService.get<string>('database.uri'),
            }),
            inject: [ConfigService],
        }),

        // Rate Limiting
        ThrottlerModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => [
                {
                    ttl: configService.get<number>('throttle.ttl') || 60,
                    limit: configService.get<number>('throttle.limit') || 100,
                },
            ],
            inject: [ConfigService],
        }),

        // Feature Modules
        AuthModule,
        UsersModule,
        RolesModule,
        MerchantsModule,
        PartnersModule,
        ProductsModule,
        OrdersModule,
        CommissionsModule,
        WalletsModule,
        PaymentsModule,
        ReferralsModule,
        NotificationsModule,
        ChatModule,
        AuditModule,
        UploadsModule,
    ],
    providers: [
        // Global Filter
        {
            provide: APP_FILTER,
            useClass: GlobalExceptionFilter,
        },
        // Global Transformers
        {
            provide: APP_INTERCEPTOR,
            useClass: TransformInterceptor,
        },
        // Audit Trail Interceptor
        {
            provide: APP_INTERCEPTOR,
            useClass: AuditInterceptor,
        },
        // Global Auth Guard (JWT)
        {
            provide: APP_GUARD,
            useClass: JwtAuthGuard,
        },
        // Global Throttler Guard
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
    ],
})
export class AppModule { }
