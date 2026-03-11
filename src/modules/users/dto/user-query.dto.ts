import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto';

export class UserQueryDto extends PaginationDto {
    @IsOptional()
    @IsString()
    userType?: string;

    @IsOptional()
    @IsString()
    applicationStatus?: string;
}
