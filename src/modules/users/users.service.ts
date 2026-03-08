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

@Injectable()
export class UsersService {
    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
    ) { }

    async findAll(paginationDto: PaginationDto) {
        const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', search } = paginationDto;
        const skip = (page - 1) * limit;

        const filter: any = {};
        if (search) {
            filter.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
            ];
        }

        const [data, total] = await Promise.all([
            this.userModel
                .find(filter)
                .sort({ [sortBy as string]: sortOrder === 'asc' ? 1 : -1 })
                .skip(skip)
                .limit(limit)
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
}
