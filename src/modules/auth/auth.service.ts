import {
    Injectable,
    UnauthorizedException,
    ConflictException,
    BadRequestException,
    NotFoundException,
    Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User, UserDocument } from '../users/schemas/user.schema';
import { RegisterDto, LoginDto, RefreshTokenDto, VerifyOtpDto, ResendOtpDto, CompleteInvitationDto, SocialLoginDto, CheckoutAuthDto, GuestChatDto } from './dto';
import { UserType } from '@common/constants';
import { MailService } from '../mail/mail.service';
import { FirebaseService } from './firebase.service';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        private jwtService: JwtService,
        private configService: ConfigService,
        private mailService: MailService,
        private firebaseService: FirebaseService,
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

        // Generate OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        // Create user
        const user = await this.userModel.create({
            email: email.toLowerCase(),
            password: hashedPassword,
            fullName,
            phone,
            userType: registerDto.userType || UserType.CUSTOMER,
            role: registerDto.userType === UserType.ADMIN ? (registerDto.role || 'admin') : 'user',
            isActive: true, // Activated by default now
            isEmailVerified: true, // Verified by default now
            otpCode,
            otpExpires,
        });

        // Send Welcome email instead of OTP (optional, but keep it clean)
        // await this.mailService.sendOtpEmail(user.email, user.fullName, otpCode).catch(e => this.logger.error('Failed to send OTP email', e));

        // Trigger emails if the user is a partner
        if (user.userType === UserType.PARTNER) {
            // Send confirmation to the applicant
            this.mailService.sendPartnerApplicationReceived(user.email, user.fullName).catch(e => this.logger.error('Failed to send partner confirmation email', e));
        }

        return {
            message: 'Registration successful.',
            requireOtp: false,
            email: user.email,
        };
    }

    async verifyOtp(verifyOtpDto: VerifyOtpDto) {
        const { email, otpCode } = verifyOtpDto;

        const user = await this.userModel.findOne({ email: email.toLowerCase() });
        if (!user) {
            throw new BadRequestException('Invalid email or OTP');
        }

        if (user.isEmailVerified) {
            throw new BadRequestException('Email is already verified');
        }

        if (user.otpCode !== otpCode) {
            throw new BadRequestException('Invalid OTP code');
        }

        if (user.otpExpires && user.otpExpires < new Date()) {
            throw new BadRequestException('OTP code has expired');
        }

        // OTP is valid
        user.isEmailVerified = true;
        user.isActive = true;
        user.otpCode = undefined;
        user.otpExpires = undefined;
        await user.save();

        // Generate tokens
        const tokens = await this.generateTokens(user);

        // Save refresh token
        user.refreshToken = tokens.refreshToken;
        user.lastLogin = new Date();
        await user.save();

        // If it's a partner, send additional alert to admin now that their email is verified
        if (user.userType === UserType.PARTNER) {
            await this.mailService.sendAdminNewPartnerAlert('wisekingssnack@gmail.com', user.fullName).catch(e => this.logger.error('Failed to send admin alert email', e));
        }

        return {
            message: 'Email verified successfully',
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
                tokens,
            },
        };
    }

    async resendOtp(resendOtpDto: ResendOtpDto) {
        const { email } = resendOtpDto;

        const user = await this.userModel.findOne({ email: email.toLowerCase() });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (user.isEmailVerified) {
            throw new BadRequestException('Email is already verified');
        }

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 15 * 60 * 1000);

        user.otpCode = otpCode;
        user.otpExpires = otpExpires;
        await user.save();

        await this.mailService.sendOtpEmail(user.email, user.fullName, otpCode).catch(e => this.logger.error('Failed to send OTP email', e));

        return { message: 'OTP sent successfully' };
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

        if (!user.isEmailVerified) {
            throw new UnauthorizedException('Please verify your email to log in');
        }

        if (!user.isActive) {
            throw new UnauthorizedException('Your account has been deactivated');
        }

        // Compare password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid email or password');
        }

        // --- REMOVED: OTP MFA for privileged roles as per request ---
        /*
        const privilegedRoles = [UserType.ADMIN, UserType.MERCHANT, UserType.PARTNER];
        if (privilegedRoles.includes(user.userType as any)) {
            // Generate login OTP
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
            const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

            await this.userModel.findByIdAndUpdate(user._id, {
                otpCode,
                otpExpires,
            });

            // Send OTP email
            await this.mailService.sendOtpEmail(user.email, user.fullName, otpCode).catch(e => this.logger.error('Failed to send login OTP email', e));

            return {
                message: 'OTP required for login',
                mfaRequired: true,
                email: user.email,
            };
        }
        */

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
                tokens,
            },
        };
    }

    async verifyLoginOtp(verifyOtpDto: VerifyOtpDto) {
        const { email, otpCode } = verifyOtpDto;

        const user = await this.userModel.findOne({ email: email.toLowerCase() });
        if (!user || user.otpCode !== otpCode) {
            throw new UnauthorizedException('Invalid email or OTP code');
        }

        if (user.otpExpires && user.otpExpires < new Date()) {
            throw new UnauthorizedException('OTP code has expired');
        }

        // Clear OTP and Activate account
        user.isEmailVerified = true;
        user.isActive = true;
        user.otpCode = undefined;
        user.otpExpires = undefined;
        await user.save();

        // Generate tokens
        const tokens = await this.generateTokens(user);

        // Save refresh token
        user.refreshToken = tokens.refreshToken;
        user.lastLogin = new Date();
        await user.save();

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
                tokens,
            },
        };
    }

    async socialLogin(socialDto: SocialLoginDto) {
        const { idToken } = socialDto;

        try {
            const decodedToken = await this.firebaseService.verifyIdToken(idToken);
            const { email, name, picture } = decodedToken;

            if (!email) {
                throw new BadRequestException('Email not provided by social provider');
            }

            // Social login for all verified users
            let user = await this.userModel.findOne({ email: email.toLowerCase() });

            if (user) {
                // Allow social login if the email matches, regardless of userType
                // This ensures existing Admins, Merchants, etc. can use social login
                this.logger.log(`Social login for existing user: ${user.email} (${user.userType})`);
            } else {
                // Create new customer user if they don't exist
                user = await this.userModel.create({
                    email: email.toLowerCase(),
                    fullName: name || email.split('@')[0],
                    password: await bcrypt.hash(uuidv4(), 12), // Random password
                    userType: UserType.CUSTOMER,
                    role: 'user',
                    isActive: true,
                    isEmailVerified: true,
                    avatar: picture,
                });
                this.logger.log(`Social signup created new customer: ${user.email}`);
            }

            if (!user.isActive) {
                throw new UnauthorizedException('Your account has been deactivated');
            }

            // Generate tokens
            const tokens = await this.generateTokens(user);

            // Update user
            user.refreshToken = tokens.refreshToken;
            user.lastLogin = new Date();
            await user.save();

            return {
                message: 'Social login successful',
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
                    tokens,
                },
            };
        } catch (error) {
            this.logger.error(`Social login failed for token: ${idToken?.substring(0, 20)}...`);
            this.logger.error(error.stack || error.message);
            
            if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
                throw error;
            }
            
            throw new UnauthorizedException(`Social authentication failed: ${error.message || 'Unknown error'}`);
        }
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
                data: { tokens },
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

    async completeInvitation(completeDto: CompleteInvitationDto) {
        const { email, otpCode, password } = completeDto;

        const user = await this.userModel.findOne({ email: email.toLowerCase() });
        if (!user) {
            throw new BadRequestException('Invalid email or invitation code');
        }

        if (!user.isInvited) {
            throw new BadRequestException('This user was not invited');
        }

        if (user.isEmailVerified && user.password) {
            throw new BadRequestException('Invitation has already been completed');
        }

        if (user.otpCode !== otpCode) {
            throw new BadRequestException('Invalid invitation code');
        }

        if (user.otpExpires && user.otpExpires < new Date()) {
            throw new BadRequestException('Invitation code has expired');
        }

        // Correct code, set password and activate
        user.password = await bcrypt.hash(password, 12);
        user.isEmailVerified = true;
        user.isActive = true;
        user.isInvited = false; // Invitation completed
        user.otpCode = undefined;
        user.otpExpires = undefined;
        await user.save();

        // Generate tokens
        const tokens = await this.generateTokens(user);

        // Save refresh token
        user.refreshToken = tokens.refreshToken;
        user.lastLogin = new Date();
        await user.save();

        return {
            message: 'Account activated successfully',
            data: {
                user: {
                    _id: user._id,
                    email: user.email,
                    fullName: user.fullName,
                    userType: user.userType,
                    role: user.role,
                },
                tokens,
            },
        };
    }

    async checkoutAuth(dto: CheckoutAuthDto) {
        const { email, password, fullName, phone } = dto;

        // Try to find user by email or phone
        let user: UserDocument | null = null;
        if (email) {
            user = await this.userModel.findOne({ email: email.toLowerCase() }).select('+password');
        } else if (phone) {
            user = await this.userModel.findOne({ phone }).select('+password');
        }

        if (user) {
            this.logger.log(`Existing user identified during seamless checkout: ${user.email || user.phone}`);
        } else {
            // Create a new user if not exists
            const fallbackPassword = password || uuidv4();
            const hashedPassword = await bcrypt.hash(fallbackPassword, 12);
            
            // If no email, create a synthetic one or just rely on phone
            const syntheticEmail = email ? email.toLowerCase() : `guest_${phone || uuidv4().substring(0, 8)}@wisekings.shop`;
            
            user = await this.userModel.create({
                email: syntheticEmail,
                password: hashedPassword,
                fullName: fullName || (email ? email.split('@')[0] : 'Guest'),
                phone,
                userType: UserType.CUSTOMER,
                role: 'user',
                isActive: true,
                isEmailVerified: true,
            });
            this.logger.log(`New guest user created during seamless checkout: ${user.email}`);
        }

        if (!user.isActive) {
            throw new UnauthorizedException('Your account has been deactivated');
        }

        // Generate tokens
        const tokens = await this.generateTokens(user);

        // Update refresh token and last login
        await this.userModel.findByIdAndUpdate(user._id, {
            refreshToken: tokens.refreshToken,
            lastLogin: new Date(),
        });

        return {
            message: 'Checkout authentication successful',
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
                tokens,
            },
        };
    }

    async guestChatAuth(dto: GuestChatDto) {
        const { email, fullName } = dto;
        let user: UserDocument | null = email ? await this.userModel.findOne({ email: email.toLowerCase() }) : null;

        if (user) {
            // Prevent seamless guest auth for privileged users
            if (user.userType !== UserType.CUSTOMER && user.role !== 'user') {
                throw new UnauthorizedException('Staff must login to access support chat');
            }
            this.logger.log(`Existing customer identified for guest chat: ${user.email}`);
        } else {
            const fallbackPassword = uuidv4();
            const hashedPassword = await bcrypt.hash(fallbackPassword, 12);
            user = await this.userModel.create({
                email: email?.toLowerCase() || `chat_${uuidv4().substring(0, 8)}@wisekings.shop`,
                password: hashedPassword,
                fullName: fullName,
                userType: UserType.CUSTOMER,
                role: 'user',
                isActive: true,
                isEmailVerified: false,
            });
            this.logger.log(`New guest user created for chat: ${user.email}`);
        }

        if (!user.isActive) {
            throw new UnauthorizedException('Your account has been deactivated');
        }

        // Generate tokens
        const tokens = await this.generateTokens(user);

        // Update refresh token and last login
        await this.userModel.findByIdAndUpdate(user._id, {
            refreshToken: tokens.refreshToken,
            lastLogin: new Date(),
        });

        return {
            message: 'Guest chat authenticated',
            data: {
                user: {
                    _id: user._id,
                    email: user.email,
                    fullName: user.fullName,
                    userType: user.userType,
                    role: user.role,
                    avatar: user.avatar,
                },
                tokens,
            },
        };
    }

    private async generateTokens(user: any) {
        const payload = {
            sub: user._id,
            email: user.email,
            fullName: user.fullName,
            userType: user.userType,
            role: user.role,
        };

        const accessExpiration = '100y';
        const refreshExpiration = '100y';

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: this.configService.get<string>('jwt.accessSecret'),
                expiresIn: accessExpiration,
            }),
            this.jwtService.signAsync(payload, {
                secret: this.configService.get<string>('jwt.refreshSecret'),
                expiresIn: refreshExpiration,
            }),
        ]);

        return { accessToken, refreshToken };
    }
}
