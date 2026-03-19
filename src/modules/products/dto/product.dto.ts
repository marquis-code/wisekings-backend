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

    @IsString()
    @IsOptional()
    unitDescription?: string;

    @IsNumber()
    @IsOptional()
    unitPrice?: number;

    @IsNumber()
    @IsOptional()
    quantityPerPack?: number;

    @IsNumber()
    @IsOptional()
    costPricePerPack?: number;

    @IsString()
    @IsOptional()
    varietyType?: string;

    @IsBoolean()
    @IsOptional()
    sellPerUnit?: boolean;
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

    @IsString()
    @IsOptional()
    unitDescription?: string;

    @IsNumber()
    @IsOptional()
    unitPrice?: number;

    @IsNumber()
    @IsOptional()
    quantityPerPack?: number;

    @IsNumber()
    @IsOptional()
    costPricePerPack?: number;

    @IsString()
    @IsOptional()
    varietyType?: string;

    @IsBoolean()
    @IsOptional()
    sellPerUnit?: boolean;

    @IsOptional()
    _id?: any;

    @IsOptional()
    __v?: any;

    @IsOptional()
    _translations?: any;

    @IsOptional()
    totalSold?: number;

    @IsOptional()
    avgRating?: number;

    @IsOptional()
    reviewCount?: number;

    @IsOptional()
    createdAt?: any;

    @IsOptional()
    updatedAt?: any;
}
