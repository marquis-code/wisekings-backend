import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Param,
    Body,
    UseGuards,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { Roles, Permissions } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';

@Controller('roles')
@Roles('superadmin', 'admin')
@UseGuards(RolesGuard)
export class RolesController {
    constructor(private readonly rolesService: RolesService) { }

    @Get()
    async findAll() {
        return this.rolesService.findAll();
    }

    @Get('permissions')
    async getAvailablePermissions() {
        return this.rolesService.getAvailablePermissions();
    }

    @Get(':name')
    async findByName(@Param('name') name: string) {
        return this.rolesService.findByName(name);
    }

    @Post()
    @Roles('superadmin', 'admin')
    async create(@Body() data: { name: string; description: string; permissions: string[] }) {
        return this.rolesService.create(data);
    }

    @Put(':id')
    @Roles('superadmin', 'admin')
    async update(@Param('id') id: string, @Body() data: any) {
        return this.rolesService.update(id, data);
    }

    @Delete(':id')
    @Roles('superadmin', 'admin')
    async delete(@Param('id') id: string) {
        return this.rolesService.delete(id);
    }
}
