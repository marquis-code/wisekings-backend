import { Module, ValidationPipe, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { APP_GUARD, APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';

import configuration, { validationSchema } from './config/configuration';
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
import { SupportModule } from './modules/support/support.module';
import { AiModule } from './modules/ai/ai.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { MarketingModule } from './modules/marketing/marketing.module';
import { MailModule } from './modules/mail/mail.module';
import { WebsocketsModule } from './modules/websockets/websockets.module';
import { EmailTemplatesModule } from './modules/email-templates/email-templates.module';
import { CurrenciesModule } from './modules/currencies/currencies.module';
import { ShippingModule } from './modules/shipping/shipping.module';
import { InvestmentsModule } from './modules/investments/investments.module';
import { SystemSettingsModule } from './modules/system-settings/system-settings.module';
import { ContactModule } from './modules/contact/contact.module';
import { ProductionModule } from './modules/production/production.module';
import { GiftingModule } from './modules/gifting/gifting.module';

import { GlobalExceptionFilter } from './common/filters';
import { TransformInterceptor, AuditInterceptor } from './common/interceptors';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
            validationSchema,
            validationOptions: {
                allowUnknown: true,
                abortEarly: true,
            },
        }),
        CacheModule.registerAsync({
            isGlobal: true,
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => {
                const redisUrl = configService.get<string>('redis.url');
                const redisTtl = configService.get<number>('redis.ttl');
                
                const logger = new Logger('CacheModule');
                if (redisUrl) {
                    logger.log(`Connecting to Redis at: ${redisUrl.split('@')[1] || 'URL masked'}`);
                } else {
                    logger.error('REDIS_URL is not defined in configuration!');
                }

                try {
                    const store = await redisStore({
                        url: redisUrl,
                        ttl: redisTtl,
                        socket: {
                            keepAlive: 10000,
                            connectTimeout: 20000,
                            reconnectStrategy: (retries: number) => {
                                logger.warn(`Redis reconnection attempt #${retries}`);
                                return Math.min(retries * 100, 3000);
                            },
                        },
                    } as any);
                    return { store };
                } catch (e) {
                    logger.error(`Redis connection failed initial setup: ${e.message}. Falling back to in-memory cache.`);
                    return { ttl: redisTtl }; // Fallback to memory
                }
            },
            inject: [ConfigService],
        }),
        ScheduleModule.forRoot(),

        MongooseModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                uri: configService.get<string>('database.uri'),
            }),
            inject: [ConfigService],
        }),
        MailModule,
        WebsocketsModule,

        ThrottlerModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => [
                {
                    ttl: configService.get<number>('throttle.ttl') ?? 60,
                    limit: configService.get<number>('throttle.limit') ?? 100,
                },
            ],
        }),
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
        SupportModule,
        AiModule,
        UploadsModule,
        MarketingModule,
        CurrenciesModule,
        ShippingModule,
        InvestmentsModule,
        SystemSettingsModule,
        ContactModule,
        ProductionModule,
        GiftingModule,
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
