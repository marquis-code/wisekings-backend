import { IsString, IsOptional, IsBoolean, IsNumber, IsNotEmpty } from 'class-validator';

export class CreateCategoryDto {
    @IsNotEmpty()
    name: any;

    @IsOptional()
    description?: any;

    @IsString()
    @IsOptional()
    image?: string;

    @IsString()
    @IsOptional()
    parentCategory?: string;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;

    @IsNumber()
    @IsOptional()
    sortOrder?: number;

    @IsString()
    @IsNotEmpty()
    slug: string;
}

export class UpdateCategoryDto {
    @IsOptional()
    name?: any;

    @IsOptional()
    description?: any;

    @IsString()
    @IsOptional()
    image?: string;

    @IsString()
    @IsOptional()
    parentCategory?: string;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;

    @IsNumber()
    @IsOptional()
    sortOrder?: number;

    @IsString()
    @IsOptional()
    slug?: string;
}
