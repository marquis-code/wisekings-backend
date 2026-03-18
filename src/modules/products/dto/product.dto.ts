import { IsString, IsOptional, IsBoolean, IsNumber, IsNotEmpty, IsArray, IsObject } from 'class-validator';

export class CreateProductDto {
    @IsNotEmpty()
    name: any;

    @IsNotEmpty()
    description: any;

    @IsNumber()
    @IsNotEmpty()
    price: number;

    @IsNumber()
    @IsOptional()
    compareAtPrice?: number;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    images?: string[];

    @IsString()
    @IsOptional()
    category?: string;

    @IsNumber()
    @IsOptional()
    stock?: number;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;

    @IsString()
    @IsOptional()
    sku?: string;

    @IsNumber()
    @IsOptional()
    weight?: number;

    @IsObject()
    @IsOptional()
    dimensions?: {
        length: number;
        width: number;
        height: number;
    };

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    tags?: string[];

    @IsString()
    @IsNotEmpty()
    slug: string;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    relatedProducts?: string[];
}

export class UpdateProductDto {
    @IsOptional()
    name?: any;

    @IsOptional()
    description?: any;

    @IsNumber()
    @IsOptional()
    price?: number;

    @IsNumber()
    @IsOptional()
    compareAtPrice?: number;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    images?: string[];

    @IsString()
    @IsOptional()
    category?: string;

    @IsNumber()
    @IsOptional()
    stock?: number;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;

    @IsString()
    @IsOptional()
    sku?: string;

    @IsNumber()
    @IsOptional()
    weight?: number;

    @IsObject()
    @IsOptional()
    dimensions?: {
        length: number;
        width: number;
        height: number;
    };

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    tags?: string[];

    @IsString()
    @IsOptional()
    slug?: string;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    relatedProducts?: string[];
}
