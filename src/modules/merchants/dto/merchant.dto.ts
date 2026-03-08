import {
    IsNotEmpty,
    IsString,
    IsEmail,
    IsEnum,
    IsOptional,
    IsBoolean,
    IsObject,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MerchantCategory } from '@common/constants';

export class BankAccountDto {
    @IsNotEmpty()
    @IsString()
    bankName: string;

    @IsNotEmpty()
    @IsString()
    accountNumber: string;

    @IsNotEmpty()
    @IsString()
    accountName: string;
}

export class RegisterMerchantDto {
    @IsNotEmpty()
    @IsString()
    fullName: string;

    @IsNotEmpty()
    @IsString()
    phone: string;

    @IsNotEmpty()
    @IsEmail()
    email: string;

    @IsNotEmpty()
    @IsString()
    password: string;

    @ValidateNested()
    @Type(() => BankAccountDto)
    bankAccountDetails: BankAccountDto;

    @IsEnum(MerchantCategory)
    category: MerchantCategory;

    @IsBoolean()
    agreedToTerms: boolean;
}

export class UpdateMerchantDto {
    @IsOptional()
    @IsString()
    fullName?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsEnum(MerchantCategory)
    category?: MerchantCategory;

    @IsOptional()
    commissionRate?: number;

    @IsOptional()
    @ValidateNested()
    @Type(() => BankAccountDto)
    bankAccountDetails?: BankAccountDto;
}
