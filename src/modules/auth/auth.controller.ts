import {
    Controller,
    Post,
    Body,
    HttpCode,
    HttpStatus,
    UseGuards,
    Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
    RegisterDto,
    LoginDto,
    RefreshTokenDto,
    ForgotPasswordDto,
    ResetPasswordDto,
    VerifyOtpDto,
    ResendOtpDto,
    CompleteInvitationDto,
    SocialLoginDto,
} from './dto';
import { Public } from '../../common/decorators';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Public()
    @Post('register')
    async register(@Body() registerDto: RegisterDto) {
        return this.authService.register(registerDto);
    }

    @Public()
    @Throttle({ default: { ttl: 900000, limit: 5 } }) // 5 attempts per 15 min
    @Post('login')
    @HttpCode(HttpStatus.OK)
    async login(@Body() loginDto: LoginDto) {
        return this.authService.login(loginDto);
    }

    @Public()
    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
        return this.authService.refreshToken(refreshTokenDto);
    }

    @Public()
    @Post('verify-otp')
    @HttpCode(HttpStatus.OK)
    async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
        return this.authService.verifyOtp(verifyOtpDto);
    }

    @Public()
    @Throttle({ default: { ttl: 60000, limit: 3 } }) // 3 attempts per minute
    @Post('resend-otp')
    @HttpCode(HttpStatus.OK)
    async resendOtp(@Body() resendOtpDto: ResendOtpDto) {
        return this.authService.resendOtp(resendOtpDto);
    }

    @Public()
    @Post('complete-invitation')
    @HttpCode(HttpStatus.OK)
    async completeInvitation(@Body() completeDto: CompleteInvitationDto) {
        return this.authService.completeInvitation(completeDto);
    }

    @Post('logout')
    @HttpCode(HttpStatus.OK)
    async logout(@CurrentUser('_id') userId: string) {
        return this.authService.logout(userId);
    }

    @Public()
    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
        return this.authService.forgotPassword(forgotPasswordDto.email);
    }

    @Public()
    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
        return this.authService.resetPassword(
            resetPasswordDto.token,
            resetPasswordDto.newPassword,
        );
    }
    @Public()
    @Post('verify-login-otp')
    @HttpCode(HttpStatus.OK)
    async verifyLoginOtp(@Body() verifyOtpDto: VerifyOtpDto) {
        return this.authService.verifyLoginOtp(verifyOtpDto);
    }

    @Public()
    @Post('social-login')
    @HttpCode(HttpStatus.OK)
    async socialLogin(@Body() socialDto: SocialLoginDto) {
        return this.authService.socialLogin(socialDto);
    }
}
