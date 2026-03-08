import { IsOptional, IsPositive, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
    @IsOptional()
    @Type(() => Number)
    @IsPositive()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsPositive()
    @Min(1)
    limit?: number = 20;

    @IsOptional()
    @IsString()
    sortBy?: string = 'createdAt';

    @IsOptional()
    @IsString()
    sortOrder?: 'asc' | 'desc' = 'desc';

    @IsOptional()
    @IsString()
    search?: string;
}

export class PaginatedResult<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
    };

    constructor(data: T[], total: number, page: number, limit: number) {
        this.data = data;
        this.meta = {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            hasNextPage: page < Math.ceil(total / limit),
            hasPrevPage: page > 1,
        };
    }
}
