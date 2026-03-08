export enum UserType {
    ADMIN = 'admin',
    MERCHANT = 'merchant',
    PARTNER = 'partner',
    CUSTOMER = 'customer',
}

export enum MerchantCategory {
    STANDARD = 'standard',
    GOLD = 'gold',
    PREMIUM = 'premium',
}

export enum MerchantStatus {
    PENDING = 'pending',
    ACTIVE = 'active',
    SUSPENDED = 'suspended',
}

export enum MerchantRank {
    STARTER = 'starter',
    BUILDER = 'builder',
    SILVER = 'silver',
    GOLD = 'gold',
    PLATINUM = 'platinum',
    DIAMOND = 'diamond',
}

export enum PartnerStatus {
    PENDING = 'pending',
    ACTIVE = 'active',
    SUSPENDED = 'suspended',
}

export enum OrderStatus {
    PENDING = 'pending',
    CONFIRMED = 'confirmed',
    PROCESSING = 'processing',
    SHIPPED = 'shipped',
    DELIVERED = 'delivered',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
    REFUNDED = 'refunded',
}

export enum PaymentStatus {
    PENDING = 'pending',
    PAID = 'paid',
    FAILED = 'failed',
    REFUNDED = 'refunded',
}

export enum CommissionStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    PAID = 'paid',
    REVERSED = 'reversed',
}

export enum WithdrawalStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    PROCESSING = 'processing',
    PAID = 'paid',
    REJECTED = 'rejected',
}

export enum NotificationType {
    SYSTEM = 'system',
    ORDER = 'order',
    COMMISSION = 'commission',
    WITHDRAWAL = 'withdrawal',
    CHAT = 'chat',
    RANK_UPGRADE = 'rank_upgrade',
    CATEGORY_UPGRADE = 'category_upgrade',
}

export enum MessageType {
    TEXT = 'text',
    IMAGE = 'image',
    FILE = 'file',
}

export enum PaymentProvider {
    PAYSTACK = 'paystack',
    STRIPE = 'stripe',
}

export const COMMISSION_RATES: Record<MerchantCategory, number> = {
    [MerchantCategory.STANDARD]: 3,
    [MerchantCategory.GOLD]: 5,
    [MerchantCategory.PREMIUM]: 7.5,
};

export const CATEGORY_UPGRADE_THRESHOLDS = {
    [MerchantCategory.GOLD]: 1000000, // ₦1,000,000
    [MerchantCategory.PREMIUM]: 5000000, // ₦5,000,000
};

export const RANK_THRESHOLDS = {
    [MerchantRank.STARTER]: { min: 0, max: 99999 },
    [MerchantRank.BUILDER]: { min: 100000, max: 499999 },
    [MerchantRank.SILVER]: { min: 500000, max: 999999 },
    [MerchantRank.GOLD]: { min: 1000000, max: 2999999 },
    [MerchantRank.PLATINUM]: { min: 3000000, max: 4999999 },
    [MerchantRank.DIAMOND]: { min: 5000000, max: Infinity },
};

export const RANK_REWARDS: Record<MerchantRank, string> = {
    [MerchantRank.STARTER]: 'Access only',
    [MerchantRank.BUILDER]: 'Badge + 3%',
    [MerchantRank.SILVER]: '+₦10k bonus',
    [MerchantRank.GOLD]: 'Upgrade to 5%',
    [MerchantRank.PLATINUM]: '+₦50k bonus',
    [MerchantRank.DIAMOND]: '7.5% + perks',
};

export const MIN_WITHDRAWAL_AMOUNT = 10000; // ₦10,000
export const REFERRAL_COOKIE_DAYS = 30;
