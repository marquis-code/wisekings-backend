import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CompleteInvitationDto {
    @IsNotEmpty()
    @IsEmail()
    email: string;

    @IsNotEmpty()
    @IsString()
    otpCode: string;

    @IsNotEmpty()
    @IsString()
    @MinLength(8)
    password: string;
}
