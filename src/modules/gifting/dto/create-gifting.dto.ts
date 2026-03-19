import { IsString, IsEmail, IsNotEmpty, IsOptional, ValidateNested, IsArray, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

class SenderDetailsDto {
  @IsString() @IsNotEmpty() name: string;
  @IsEmail() @IsNotEmpty() email: string;
  @IsString() @IsNotEmpty() phone: string;
}

class RecipientDetailsDto {
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsNotEmpty() phone: string;
  @IsString() @IsNotEmpty() address: string;
  @IsString() @IsNotEmpty() country: string;
  @IsString() @IsNotEmpty() occasion: string;
}

class ProductItemDto {
  @IsString() @IsNotEmpty() product: string; // ObjectId
  @IsNumber() @IsNotEmpty() quantity: number;
}

export class CreateGiftingDto {
  @ValidateNested() @Type(() => SenderDetailsDto) @IsNotEmpty() senderDetails: SenderDetailsDto;
  @ValidateNested() @Type(() => RecipientDetailsDto) @IsNotEmpty() recipientDetails: RecipientDetailsDto;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ProductItemDto) @IsNotEmpty() products: ProductItemDto[];
  @IsString() @IsOptional() specialInstructions?: string;
}
