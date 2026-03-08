import {
    Injectable,
    UnauthorizedException,
    ConflictException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User, UserDocument } from '../users/schemas/user.schema';
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto';
import { UserType } from '../../common/constants';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private jwtService: JwtService,
        private configService: ConfigService,
    ) { }

    async register(registerDto: RegisterDto) {
        const { email, password, fullName, phone, userType } = registerDto;

        // Check if user exists
        const existingUser = await this.userModel.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            throw new ConflictException('A user with this email already exists');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const user = await this.userModel.create({
            email: email.toLowerCase(),
            password: hashedPassword,
            fullName,
            phone,
            userType: userType || UserType.CUSTOMER,
            role: userType === UserType.ADMIN ? 'admin' : 'user',
        });

        // Generate tokens
        const tokens = await this.generateTokens(user);

        // Save refresh token
        await this.userModel.findByIdAndUpdate(user._id, {
            refreshToken: tokens.refreshToken,
            lastLogin: new Date(),
        });

        return {
            message: 'Registration successful',
            data: {
                user: {
                    _id: user._id,
                    email: user.email,
                    fullName: user.fullName,
                    phone: user.phone,
                    userType: user.userType,
                    role: user.role,
                },
                ...tokens,
            },
        };
    }

    async login(loginDto: LoginDto) {
        const { email, password } = loginDto;

        // Find user with password
        const user = await this.userModel
            .findOne({ email: email.toLowerCase() })
            .select('+password');

        if (!user) {
            throw new UnauthorizedException('Invalid email or password');
        }

        if (!user.isActive) {
            throw new UnauthorizedException('Your account has been deactivated');
        }

        // Compare password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid email or password');
        }

        // Generate tokens
        const tokens = await this.generateTokens(user);

        // Update refresh token and last login
        await this.userModel.findByIdAndUpdate(user._id, {
            refreshToken: tokens.refreshToken,
            lastLogin: new Date(),
        });

        return {
            message: 'Login successful',
            data: {
                user: {
                    _id: user._id,
                    email: user.email,
                    fullName: user.fullName,
                    phone: user.phone,
                    userType: user.userType,
                    role: user.role,
                    avatar: user.avatar,
                },
                ...tokens,
            },
        };
    }

    async refreshToken(refreshTokenDto: RefreshTokenDto) {
        const { refreshToken } = refreshTokenDto;

        try {
            // Verify refresh token
            const payload = this.jwtService.verify(refreshToken, {
                secret: this.configService.get<string>('jwt.refreshSecret'),
            });

            // Find user with matching refresh token
            const user = await this.userModel
                .findById(payload.sub)
                .select('+refreshToken');

            if (!user || user.refreshToken !== refreshToken) {
                throw new UnauthorizedException('Invalid refresh token');
            }

            if (!user.isActive) {
                throw new UnauthorizedException('Account deactivated');
            }

            // Generate new tokens (rotation)
            const tokens = await this.generateTokens(user);

            // Update refresh token
            await this.userModel.findByIdAndUpdate(user._id, {
                refreshToken: tokens.refreshToken,
            });

            return {
                message: 'Token refreshed successfully',
                data: tokens,
            };
        } catch (error) {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }
    }

    async logout(userId: string) {
        await this.userModel.findByIdAndUpdate(userId, {
            refreshToken: null,
        });

        return { message: 'Logged out successfully' };
    }

    async forgotPassword(email: string) {
        const user = await this.userModel.findOne({ email: email.toLowerCase() });
        if (!user) {
            // Don't reveal if email exists
            return { message: 'If the email exists, a reset link has been sent' };
        }

        const resetToken = uuidv4();
        const resetExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

        await this.userModel.findByIdAndUpdate(user._id, {
            passwordResetToken: resetToken,
            passwordResetExpires: resetExpires,
        });

        // TODO: Send email with reset link
        this.logger.log(`Password reset token for ${email}: ${resetToken}`);

        return { message: 'If the email exists, a reset link has been sent' };
    }

    async resetPassword(token: string, newPassword: string) {
        const user = await this.userModel.findOne({
            passwordResetToken: token,
            passwordResetExpires: { $gt: new Date() },
        });

        if (!user) {
            throw new BadRequestException('Invalid or expired reset token');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);

        await this.userModel.findByIdAndUpdate(user._id, {
            password: hashedPassword,
            passwordResetToken: null,
            passwordResetExpires: null,
            refreshToken: null, // Invalidate all sessions
        });

        return { message: 'Password has been reset successfully' };
    }

    private async generateTokens(user: any) {
        const payload = {
            sub: user._id,
            email: user.email,
            userType: user.userType,
            role: user.role,
        };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: this.configService.get<string>('jwt.accessSecret'),
                expiresIn: this.configService.get<string>('jwt.accessExpiration'),
            }),
            this.jwtService.signAsync(payload, {
                secret: this.configService.get<string>('jwt.refreshSecret'),
                expiresIn: this.configService.get<string>('jwt.refreshExpiration'),
            }),
        ]);

        return { accessToken, refreshToken };
    }
}
