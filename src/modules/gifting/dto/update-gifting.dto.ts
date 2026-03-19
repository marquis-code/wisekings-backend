import { IsNumber, IsOptional, IsString, IsEnum } from 'class-validator';

export class UpdateGiftingDto {
  @IsEnum(['pending', 'approved', 'rejected', 'paid', 'shipped']) @IsOptional() status?: string;
  @IsNumber() @IsOptional() productsCost?: number;
  @IsNumber() @IsOptional() shippingFee?: number;
  @IsNumber() @IsOptional() totalCost?: number;
  @IsString() @IsOptional() receiptUrl?: string;
}
