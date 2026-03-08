import { IsEmail, IsNotEmpty, IsString, MinLength, IsEnum, IsOptional } from 'class-validator';
import { UserType } from '@common/constants';

export class RegisterDto {
    @IsNotEmpty()
    @IsString()
    fullName: string;

    @IsNotEmpty()
    @IsEmail()
    email: string;

    @IsNotEmpty()
    @IsString()
    @MinLength(8)
    password: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsEnum(UserType)
    userType?: UserType;
}

export class LoginDto {
    @IsNotEmpty()
    @IsEmail()
    email: string;

    @IsNotEmpty()
    @IsString()
    password: string;
}

export class RefreshTokenDto {
    @IsNotEmpty()
    @IsString()
    refreshToken: string;
}

export class ForgotPasswordDto {
    @IsNotEmpty()
    @IsEmail()
    email: string;
}

export class ResetPasswordDto {
    @IsNotEmpty()
    @IsString()
    token: string;

    @IsNotEmpty()
    @IsString()
    @MinLength(8)
    newPassword: string;
}

export class ChangePasswordDto {
    @IsNotEmpty()
    @IsString()
    currentPassword: string;

    @IsNotEmpty()
    @IsString()
    @MinLength(8)
    newPassword: string;
}
