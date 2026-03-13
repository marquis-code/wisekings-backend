import {
    Injectable,
    ConflictException,
    NotFoundException,
    BadRequestException,
    Logger,
    Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Partner, PartnerDocument } from './schemas/partner.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { UserType, PartnerStatus } from '@common/constants';
import { PaginationDto, PaginatedResult } from '@common/dto';
import { EncryptionUtil } from '@common/utils';

import { MailService } from '../mail/mail.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import * as QRCode from 'qrcode';

@Injectable()
export class PartnersService {
    private readonly logger = new Logger(PartnersService.name);

    constructor(
        @InjectModel(Partner.name) private partnerModel: Model<PartnerDocument>,
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        @InjectModel('Wallet') private walletModel: Model<any>,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private readonly mailService: MailService,
        private readonly systemSettingsService: SystemSettingsService,
    ) { }

    async register(dto: any) {
        const email = dto.email.toLowerCase().trim();
        const existing = await this.partnerModel.findOne({ email });
        if (existing) throw new ConflictException('Partner email already registered');

        const hashedPassword = await bcrypt.hash(dto.password, 12);
        const user = await this.userModel.create({
            email,
            password: hashedPassword,
            fullName: dto.contactPerson,
            phone: dto.phone,
            userType: UserType.PARTNER,
            role: 'user',
        });

        const partnerCode = await this.generatePartnerCode(dto.companyName);
        const bankDetails = dto.bankAccountDetails
            ? {
                bankName: dto.bankAccountDetails.bankName,
                accountNumber: EncryptionUtil.encrypt(dto.bankAccountDetails.accountNumber),
                accountName: dto.bankAccountDetails.accountName,
            }
            : undefined;

        const partner = await this.partnerModel.create({
            userId: user._id,
            partnerCode,
            companyName: dto.companyName,
            contactPerson: dto.contactPerson,
            phone: dto.phone,
            email,
            bankAccountDetails: bankDetails,
            category: dto.category || 'standard',
            commissionRate: dto.commissionRate || 3,
            status: PartnerStatus.PENDING,
            referralLink: `https://wisekings.ng/?ref=${partnerCode}`,
            companyAddress: dto.companyAddress,
            registrationNumber: dto.registrationNumber,
            agreedToTerms: dto.agreedToTerms || false,
        });

        await this.walletModel.create({ ownerId: partner._id, ownerType: 'partner' });

        return {
            message: 'Partner registration successful, awaiting approval',
            data: { partnerId: partner._id, partnerCode, referralLink: partner.referralLink },
        };
    }

    async findAll(paginationDto: PaginationDto, filters?: any) {
        const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', search } = paginationDto;
        const skip = (Number(page) - 1) * Number(limit);
        const filter: any = {};
        if (search) {
            filter.$or = [
                { companyName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { partnerCode: { $regex: search, $options: 'i' } },
            ];
        }
        if (filters?.status) {
            if (filters.status === 'pending') {
                filter.$or = filter.$or || [];
                filter.$or.push({ status: 'pending' }, { 'kyc.status': 'pending' });
            } else {
                filter.status = filters.status;
            }
        }
        if (filters?.kycStatus) {
            if (filters.kycStatus === 'submitted') {
                filter['kyc.status'] = { $ne: 'not_submitted' };
            } else {
                filter['kyc.status'] = filters.kycStatus;
            }
        }

        const [data, total] = await Promise.all([
            this.partnerModel.find(filter)
                .populate('userId', 'email fullName')
                .sort({ [sortBy as string]: sortOrder === 'asc' ? 1 : -1 })
                .skip(skip)
                .limit(limit as number)
                .lean(),
            this.partnerModel.countDocuments(filter),
        ]);
        return new PaginatedResult(data as any[], total, page, limit);
    }

    async findById(id: string) {
        const cacheKey = `partner:id:${id}`;
        const cached = await this.cacheManager.get(cacheKey);
        if (cached) return cached;

        const partner = await this.partnerModel.findById(id).populate('userId', 'email fullName avatar').lean();
        if (!partner) throw new NotFoundException('Partner not found');
        if (partner.bankAccountDetails?.accountNumber) {
            partner.bankAccountDetails.accountNumber = EncryptionUtil.decrypt(partner.bankAccountDetails.accountNumber);
        }

        await this.cacheManager.set(cacheKey, partner, 3600);
        return partner;
    }

    async findByUserId(userId: string): Promise<PartnerDocument> {
        let partner = await this.partnerModel.findOne({ userId: new Types.ObjectId(userId) });

        if (!partner) {
            const user = await this.userModel.findById(userId);
            if (!user) throw new NotFoundException('User not found');
            
            if (user.userType !== UserType.PARTNER) {
                throw new BadRequestException('User is not a partner');
            }

            // double check
            partner = await this.partnerModel.findOne({ userId: new Types.ObjectId(userId) });
            if (!partner) {
                const partnerCode = `WKP-${user.fullName?.substring(0, 3).toUpperCase() || 'WK'}-${Math.floor(1000 + Math.random() * 9000)}`;
                partner = await this.partnerModel.create({
                    userId: user._id,
                    partnerCode,
                    companyName: user.fullName || 'My Company',
                    contactPerson: user.fullName,
                    phone: user.phone || '',
                    email: user.email,
                    status: PartnerStatus.ACTIVE,
                    referralLink: `https://wisekings.ng/?ref=${partnerCode}`,
                });

                await this.walletModel.create({ ownerId: partner._id, ownerType: 'partner' });
            }
        }
        return partner;
    }

    async getDashboard(userId: string) {
        const cacheKey = `partner:dashboard:${userId}`;
        const cached = await this.cacheManager.get(cacheKey);
        if (cached) return cached;

        const partner = await this.findByUserId(userId);
        const wallet = await this.walletModel.findOne({ ownerId: (partner as any)._id, ownerType: 'partner' }).lean();

        // Fetch total referrals count
        const totalReferrals = await this.userModel.countDocuments({
            referredBy: (partner as any).partnerCode
        });

        // Fetch recent referrals
        const recentReferrals = await this.userModel.find({
            referredBy: (partner as any).partnerCode
        }).select('fullName email createdAt').sort({ createdAt: -1 }).limit(5).lean();

        const result = {
            data: {
                partner: {
                    partnerCode: partner.partnerCode,
                    category: partner.category,
                    commissionRate: partner.commissionRate,
                    status: partner.status,
                    referralLink: partner.referralLink,
                    companyName: partner.companyName
                },
                stats: {
                    totalOrdersReferred: partner.totalOrdersReferred || 0,
                    totalSalesValue: partner.totalSalesValue || 0,
                    totalReferrals
                },
                wallet: wallet ? {
                    availableBalance: (wallet as any).availableBalance,
                    pendingBalance: (wallet as any).pendingBalance,
                    totalEarned: (wallet as any).totalEarned,
                    totalWithdrawn: (wallet as any).totalWithdrawn
                } : null,
                recentReferrals
            },
        };

        await this.cacheManager.set(cacheKey, result, 300);
        return result;
    }

    async getNetwork(userId: string) {
        const partner = await this.findByUserId(userId);
        // Implementation for network tiers
        return {
            success: true,
            data: {
                tier1: [],
                tier2: [],
                summary: { totalActive: 0, totalInactive: 0 }
            }
        };
    }

    async getReferrals(userId: string) {
        const partner = await this.findByUserId(userId);
        return {
            success: true,
            data: []
        };
    }

    async update(id: string, dto: any) {
        const partner = await this.partnerModel.findByIdAndUpdate(id, dto, { new: true }).lean();
        if (!partner) throw new NotFoundException('Partner not found');

        // Clear cache
        await this.cacheManager.del(`partner:id:${id}`);
        if (partner.userId) {
            await this.cacheManager.del(`partner:dashboard:${partner.userId}`);
        }

        return { message: 'Partner updated successfully', data: partner };
    }

    async approve(id: string) {
        const partner = await this.partnerModel.findByIdAndUpdate(id, { status: PartnerStatus.ACTIVE }, { new: true });
        if (!partner) throw new NotFoundException('Partner not found');
        await this.userModel.findByIdAndUpdate(partner.userId, { isActive: true });

        // Clear cache
        await this.cacheManager.del(`partner:id:${id}`);
        await this.cacheManager.del(`partner:dashboard:${partner.userId}`);

        return { message: 'Partner approved' };
    }

    async suspend(id: string, reason: string) {
        const partner = await this.partnerModel.findByIdAndUpdate(id, { status: PartnerStatus.SUSPENDED, suspendedAt: new Date(), suspendedReason: reason }, { new: true });
        if (!partner) throw new NotFoundException('Partner not found');
        await this.userModel.findByIdAndUpdate(partner.userId, { isActive: false });

        // Clear cache
        await this.cacheManager.del(`partner:id:${id}`);
        await this.cacheManager.del(`partner:dashboard:${partner.userId}`);

        return { message: 'Partner suspended' };
    }

    // --- Multi-Document KYC ---

    async initializeKycDocuments(partner: PartnerDocument): Promise<PartnerDocument> {
        if (!partner.kyc || !partner.kyc.documents || partner.kyc.documents.length === 0) {
            const user = await this.userModel.findById(partner.userId).lean();
            const userCountry = user?.country || '';

            const settings = await this.systemSettingsService.getSettings();
            const docTypes = settings.kycDocumentTypes || [];
            
            // Filter by target and country
            const filteredDocs = docTypes.filter(dt => {
                const targetMatch = dt.target === 'partner' || dt.target === 'both';
                const countryMatch = dt.countries.length === 0 || dt.countries.includes(userCountry);
                return targetMatch && countryMatch;
            });

            partner.kyc = {
                documents: filteredDocs.map(dt => ({
                    documentType: dt.value,
                    documentLabel: dt.label,
                    isRequired: dt.isRequired,
                    requiresIdNumber: (dt as any).requiresIdNumber !== undefined ? (dt as any).requiresIdNumber : true,
                    requiresFileUpload: (dt as any).requiresFileUpload !== undefined ? (dt as any).requiresFileUpload : true,
                    idNumber: '',
                    documentUrl: '',
                    status: 'not_submitted' as const,
                })),
                status: 'not_submitted',
            };
            await partner.save();
        }
        return partner;
    }

    getOverallKycStatus(partner: any): string {
        const docs = partner?.kyc?.documents || [];
        if (docs.length === 0) return 'not_submitted';
        
        // Filter compulsory documents
        const compulsoryDocs = docs.filter((d: any) => d.isRequired === true);
        
        // If all compulsory docs are approved, then overall is approved
        // (Even if optional docs are pending or not submitted)
        if (compulsoryDocs.every((d: any) => d.status === 'approved')) return 'approved';
        
        // If any document (even optional) is rejected, we might show rejected status
        // Decisions: if any doc is rejected, let's say rejected.
        if (docs.some((d: any) => d.status === 'rejected')) return 'rejected';
        
        // If any compulsory doc is pending or not submitted, it's pending/not_submitted
        if (compulsoryDocs.some((d: any) => d.status === 'pending')) return 'pending';
        
        return 'not_submitted';
    }

    async submitKycDocument(userId: string, docData: { documentType: string; idNumber: string; documentUrl: string }) {
        const partner = await this.findByUserId(userId);
        const partnerDoc = await this.partnerModel.findById((partner as any)._id).populate('userId');
        if (!partnerDoc) throw new NotFoundException('Partner profile record missing');

        await this.initializeKycDocuments(partnerDoc);

        const docIndex = partnerDoc.kyc.documents.findIndex(d => d.documentType === docData.documentType);
        if (docIndex === -1) throw new BadRequestException(`Document type '${docData.documentType}' not found in KYC requirements`);

        partnerDoc.kyc.documents[docIndex].idNumber = docData.idNumber;
        partnerDoc.kyc.documents[docIndex].documentUrl = docData.documentUrl;
        partnerDoc.kyc.documents[docIndex].status = 'pending';
        partnerDoc.kyc.documents[docIndex].submittedAt = new Date();
        partnerDoc.kyc.documents[docIndex].rejectionReason = undefined;

        partnerDoc.kyc.status = this.getOverallKycStatus(partnerDoc) as any;
        partnerDoc.markModified('kyc');
        await partnerDoc.save();

        const user = partnerDoc.userId as any;
        if (user && user.email) {
            try {
                await this.mailService.sendKycSubmittedEmail(user.email, user.fullName || 'Partner');
            } catch (err) {
                this.logger.error(`Failed to send KYC submission email: ${err.message}`);
            }
        }

        return { message: 'Document submitted successfully', data: partnerDoc.kyc };
    }

    async updateKycDocumentStatus(id: string, documentType: string, status: 'approved' | 'rejected', reason?: string) {
        const partner = await this.partnerModel.findById(id).populate('userId');
        if (!partner) throw new NotFoundException('Partner not found');

        const docIndex = partner.kyc.documents.findIndex(d => d.documentType === documentType);
        if (docIndex === -1) throw new BadRequestException(`Document type '${documentType}' not found`);

        partner.kyc.documents[docIndex].status = status;
        partner.kyc.documents[docIndex].verifiedAt = new Date();
        if (reason) partner.kyc.documents[docIndex].rejectionReason = reason;

        partner.kyc.status = this.getOverallKycStatus(partner) as any;
        partner.markModified('kyc');
        await partner.save();

        // If all documents approved, update user applicationStatus
        const overallStatus = this.getOverallKycStatus(partner);
        const user = partner.userId as any;
        if (overallStatus === 'approved') {
            await this.userModel.findByIdAndUpdate(user._id, { applicationStatus: 'approved' });
        }

        try {
            const docLabel = partner.kyc.documents[docIndex].documentLabel;
            await this.mailService.sendKycStatusUpdate(user.email, user.fullName, status, reason ? `${docLabel}: ${reason}` : docLabel);
        } catch (err) {
            this.logger.error(`Failed to send KYC email for partner: ${err.message}`);
        }

        // Clear cache
        await this.cacheManager.del(`partner:id:${id}`);
        if (partner.userId) {
            const user = partner.userId as any;
            await this.cacheManager.del(`partner:dashboard:${user?._id || user}`);
        }

        return { message: `Document ${status} successfully`, data: partner.kyc };
    }

    async getReferralQrCode(userId: string): Promise<string> {
        const partner = await this.findByUserId(userId);

        const link = partner.referralLink || `https://wisekings.ng/?ref=${partner.partnerCode}`;
        try {
            const qrCodeDataUrl = await QRCode.toDataURL(link, {
                margin: 2,
                scale: 10,
                color: {
                    dark: '#033958',
                    light: '#ffffff',
                },
            });
            return qrCodeDataUrl;
        } catch (err) {
            this.logger.error(`Failed to generate QR code for partner: ${err.message}`);
            throw new BadRequestException('Could not generate QR code');
        }
    }

    private async generatePartnerCode(name: string): Promise<string> {
        const prefix = name.substring(0, 3).toUpperCase();
        let code = '';
        let exists = true;
        while (exists) {
            const random = Math.floor(1000 + Math.random() * 9000);
            code = `WKP-${prefix}-${random}`;
            exists = !!(await this.partnerModel.findOne({ partnerCode: code }));
        }
        return code;
    }
}
