import 'module-alias/register';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as compression from 'compression';
import helmet from 'helmet';
import * as net from 'net';
import { AppModule } from './app.module';

async function bootstrap() {
    const logger = new Logger('Bootstrap');
    const app = await NestFactory.create(AppModule, {
        rawBody: true, // Required for Stripe/Paystack webhooks
    });

    const configService = app.get(ConfigService);
    const port = configService.get<number>('app.port') || 3000;

    // Security
    app.use(helmet());
    app.enableCors({
        origin: (origin, callback) => {
            // Allow all origins
            callback(null, true);
        },
        credentials: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        allowedHeaders: 'Origin,X-Requested-With,Content-Type,Accept,Authorization,Range',
        exposedHeaders: 'Content-Range,X-Content-Range',
    });

    // Performance
    app.use(compression());

    // Validation
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidNonWhitelisted: true,
        }),
    );

    // Prefix
    app.setGlobalPrefix('api/v1');

    await app.listen(port);
    logger.log(`WiseKings Backend running on: http://localhost:${port}/api/v1`);
}

bootstrap();
