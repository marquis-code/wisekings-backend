import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { PaginationDto, PaginatedResult } from '@common/dto';
import { MailService } from '../mail/mail.service';
import { InviteUserDto } from './dto/invite-user.dto';
import { UserType } from '@common/constants';

@Injectable()
export class UsersService {
    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private mailService: MailService,
    ) { }

    async findAll(paginationDto: PaginationDto, currentUser: any, userType?: string, applicationStatus?: string) {
        const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', search } = paginationDto;
        const skip = (Number(page) - 1) * Number(limit);

        const filter: any = {};
        
        // Role-based visibility logic
        if (currentUser.userType === UserType.MERCHANT) {
            // Merchants can see Admins, other Merchants, and THEIR referred customers
            const merchant = await this.userModel.db.model('Merchant').findOne({ userId: currentUser._id }).lean() as any;
            if (merchant) {
                const referrals = await this.userModel.db.model('Referral').find({ merchantId: merchant._id, status: 'converted' }).lean();
                const referredCustomerIds = referrals.map(r => r.customerId).filter(id => !!id);
                
                filter.$and = filter.$and || [];
                filter.$and.push({
                    $or: [
                        { userType: { $in: [UserType.ADMIN, UserType.MERCHANT] } },
                        { _id: { $in: referredCustomerIds } }
                    ]
                });
            } else {
                filter.userType = { $in: [UserType.ADMIN, UserType.MERCHANT] };
            }
        } else if (currentUser.userType === UserType.PARTNER) {
            // Partners can see Admins, other Partners, and THEIR referred people
            const partner = await this.userModel.db.model('Partner').findOne({ userId: currentUser._id }).lean() as any;
            if (partner) {
                // Find users referred by this partner
                const referrals = await this.userModel.db.model('Referral').find({ partnerId: partner._id, status: 'converted' }).lean();
                // A partner might refer customers or other partners
                const referredUserIds = referrals.map(r => r.customerId || r.partnerId).filter(id => !!id);
                
                filter.$and = filter.$and || [];
                filter.$and.push({
                    $or: [
                        { userType: { $in: [UserType.ADMIN, UserType.PARTNER] } },
                        { _id: { $in: referredUserIds } }
                    ]
                });
            } else {
                filter.userType = { $in: [UserType.ADMIN, UserType.PARTNER] };
            }
        }

        if (search) {
            const searchFilter = {
                $or: [
                    { fullName: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { phone: { $regex: search, $options: 'i' } },
                ]
            };
            if (filter.$and) {
                filter.$and.push(searchFilter);
            } else {
                Object.assign(filter, searchFilter);
            }
        }
        if (userType) filter.userType = userType;
        if (applicationStatus) filter.applicationStatus = applicationStatus;

        const [data, total] = await Promise.all([
            this.userModel
                .find(filter)
                .sort({ [sortBy as string]: sortOrder === 'asc' ? 1 : -1 })
                .skip(skip)
                .limit(limit as any)
                .select('-password -refreshToken')
                .lean(),
            this.userModel.countDocuments(filter),
        ]);

        return new PaginatedResult(data as any[], total, page, limit);
    }

    async findById(id: string) {
        const user = await this.userModel
            .findById(id)
            .select('-password -refreshToken')
            .lean();
        if (!user) {
            throw new NotFoundException('User not found');
        }
        return user;
    }

    async findByEmail(email: string) {
        return this.userModel.findOne({ email: email.toLowerCase() }).lean();
    }

    async update(id: string, updateData: Partial<User>) {
        const user = await this.userModel
            .findByIdAndUpdate(id, updateData, { new: true })
            .select('-password -refreshToken')
            .lean();

        if (!user) {
            throw new NotFoundException('User not found');
        }
        return user;
    }

    async changePassword(userId: string, currentPassword: string, newPassword: string) {
        const user = await this.userModel.findById(userId).select('+password');
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            throw new BadRequestException('Current password is incorrect');
        }

        user.password = await bcrypt.hash(newPassword, 12);
        await user.save();

        return { message: 'Password changed successfully' };
    }

    async toggleActive(id: string) {
        const user = await this.userModel.findById(id);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        user.isActive = !user.isActive;
        await user.save();

        return {
            message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
            data: { isActive: user.isActive },
        };
    }

    async approvePartner(id: string) {
        const user = await this.userModel.findById(id);
        if (!user || user.userType !== 'partner') {
            throw new NotFoundException('Partner not found');
        }

        user.applicationStatus = 'approved';
        await user.save();

        // Send email notification to partner
        await this.mailService.sendPartnerApplicationApproved(user.email, user.fullName).catch(console.error);

        return { message: 'Partner approved successfully! Notification email queued.', data: user };
    }

    async signAgreement(userId: string) {
        const user = await this.userModel.findById(userId);
        if (!user || user.userType !== 'partner') {
            throw new NotFoundException('Partner not found');
        }

        if (user.applicationStatus !== 'approved') {
            throw new BadRequestException('Partnership application must be approved by an Admin before signing.');
        }

        user.agreementStatus = 'signed';
        user.agreementSignedAt = new Date();
        await user.save();

        return { message: 'Agreement digitally signed successfully!', data: user };
    }

    async getStats() {
        const [total, active, merchants, partners, customers, admins] =
            await Promise.all([
                this.userModel.countDocuments(),
                this.userModel.countDocuments({ isActive: true }),
                this.userModel.countDocuments({ userType: 'merchant' }),
                this.userModel.countDocuments({ userType: 'partner' }),
                this.userModel.countDocuments({ userType: 'customer' }),
                this.userModel.countDocuments({ userType: 'admin' }),
            ]);

        return { total, active, merchants, partners, customers, admins };
    }

    async delete(id: string) {
        const result = await this.userModel.findByIdAndDelete(id);
        if (!result) {
            throw new NotFoundException('User not found');
        }
        return { message: 'User deleted successfully' };
    }

    async inviteUser(inviteDto: InviteUserDto) {
        const { email, fullName, role } = inviteDto;

        const existingUser = await this.userModel.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            throw new ConflictException('A user with this email already exists');
        }

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Create a user without a password (it will be set during the "Join" process)
        // We'll use a placeholder password for now because it's required in the schema, 
        // but the user will reset it.
        const tempPassword = await bcrypt.hash(Math.random().toString(36), 12);

        const user = await this.userModel.create({
            email: email.toLowerCase(),
            fullName,
            role,
            userType: UserType.ADMIN,
            password: tempPassword,
            isInvited: true,
            isEmailVerified: false,
            isActive: false, // Stays pending until activation
            applicationStatus: 'pending',
            otpCode,
            otpExpires,
        });

        await this.mailService.sendAdminInvitationEmail(user.email, user.fullName, otpCode).catch(e => console.error('Failed to send invitation email', e));

        return {
            message: 'Invitation sent successfully',
            data: {
                _id: user._id,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
            },
        };
    }
}
