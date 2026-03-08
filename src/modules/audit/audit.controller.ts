import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { PaginationDto } from '../../common/dto';

@Controller('audit-logs')
@UseGuards(RolesGuard)
@Roles('superadmin', 'admin')
export class AuditController {
    constructor(private readonly auditService: AuditService) { }

    @Get()
    async findAll(
        @Query() paginationDto: PaginationDto,
        @Query('userId') userId?: string,
        @Query('resource') resource?: string,
        @Query('action') action?: string,
    ) {
        return this.auditService.findAll(paginationDto, { userId, resource, action });
    }

    @Get(':id')
    async findById(@Param('id') id: string) {
        return this.auditService.findById(id);
    }
}
