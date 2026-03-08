import { registerAs } from '@nestjs/config';
import * as Joi from 'joi';

export const validationSchema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
    PORT: Joi.number().default(3000),
    API_PREFIX: Joi.string().default('api/v1'),
    MONGODB_URI: Joi.string().required(),
    JWT_ACCESS_SECRET: Joi.string().required(),
    JWT_ACCESS_EXPIRATION: Joi.string().default('15m'),
    JWT_REFRESH_SECRET: Joi.string().required(),
    JWT_REFRESH_EXPIRATION: Joi.string().default('7d'),
    AWS_ACCESS_KEY_ID: Joi.string().required(),
    AWS_SECRET_ACCESS_KEY: Joi.string().required(),
    AWS_REGION: Joi.string().default('eu-west-1'),
    AWS_S3_BUCKET: Joi.string().required(),
    PAYSTACK_SECRET_KEY: Joi.string().required(),
    PAYSTACK_PUBLIC_KEY: Joi.string().required(),
    PAYSTACK_WEBHOOK_SECRET: Joi.string().optional(),
    STRIPE_SECRET_KEY: Joi.string().required(),
    STRIPE_PUBLIC_KEY: Joi.string().required(),
    STRIPE_WEBHOOK_SECRET: Joi.string().optional(),
    ENCRYPTION_KEY: Joi.string().min(32).required(),
    ADMIN_URL: Joi.string().default('http://localhost:3001'),
    MERCHANT_URL: Joi.string().default('http://localhost:3002'),
    PARTNER_URL: Joi.string().default('http://localhost:3003'),
    CUSTOMER_URL: Joi.string().default('http://localhost:3004'),
    THROTTLE_TTL: Joi.number().default(60),
    THROTTLE_LIMIT: Joi.number().default(100),
});

export const appConfig = registerAs('app', () => ({
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT as string, 10) || 3000,
    apiPrefix: process.env.API_PREFIX || 'api/v1',
}));

export const databaseConfig = registerAs('database', () => ({
    uri: process.env.MONGODB_URI,
}));

export const jwtConfig = registerAs('jwt', () => ({
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
}));

export const awsConfig = registerAs('aws', () => ({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'eu-west-1',
    s3Bucket: process.env.AWS_S3_BUCKET,
}));

export const paystackConfig = registerAs('paystack', () => ({
    secretKey: process.env.PAYSTACK_SECRET_KEY,
    publicKey: process.env.PAYSTACK_PUBLIC_KEY,
    webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET,
}));

export const stripeConfig = registerAs('stripe', () => ({
    secretKey: process.env.STRIPE_SECRET_KEY,
    publicKey: process.env.STRIPE_PUBLIC_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
}));

export const encryptionConfig = registerAs('encryption', () => ({
    key: process.env.ENCRYPTION_KEY,
}));

export const corsConfig = registerAs('cors', () => ({
    adminUrl: process.env.ADMIN_URL || 'http://localhost:3001',
    merchantUrl: process.env.MERCHANT_URL || 'http://localhost:3002',
    partnerUrl: process.env.PARTNER_URL || 'http://localhost:3003',
    customerUrl: process.env.CUSTOMER_URL || 'http://localhost:3004',
}));

export const throttleConfig = registerAs('throttle', () => ({
    ttl: parseInt(process.env.THROTTLE_TTL as string, 10) || 60,
    limit: parseInt(process.env.THROTTLE_LIMIT as string, 10) || 100,
}));

export default () => ({
    app: appConfig(),
    database: databaseConfig(),
    jwt: jwtConfig(),
    aws: awsConfig(),
    paystack: paystackConfig(),
    stripe: stripeConfig(),
    encryption: encryptionConfig(),
    cors: corsConfig(),
    throttle: throttleConfig(),
});
