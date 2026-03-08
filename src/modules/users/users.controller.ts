import {
    Controller,
    Get,
    Put,
    Delete,
    Param,
    Body,
    Query,
    UseGuards,
    Patch,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Roles, Permissions, CurrentUser } from '../../common/decorators';
import { RolesGuard, PermissionsGuard } from '../../common/guards';
import { PaginationDto } from '../../common/dto';
import { ChangePasswordDto } from '../auth/dto';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get()
    @Roles('superadmin', 'admin')
    @UseGuards(RolesGuard)
    async findAll(@Query() paginationDto: PaginationDto) {
        return this.usersService.findAll(paginationDto);
    }

    @Get('me')
    async getProfile(@CurrentUser('_id') userId: string) {
        return this.usersService.findById(userId);
    }

    @Get('stats')
    @Roles('superadmin', 'admin')
    @UseGuards(RolesGuard)
    async getStats() {
        return this.usersService.getStats();
    }

    @Get(':id')
    @Roles('superadmin', 'admin')
    @UseGuards(RolesGuard)
    async findById(@Param('id') id: string) {
        return this.usersService.findById(id);
    }

    @Put('me')
    async updateProfile(
        @CurrentUser('_id') userId: string,
        @Body() updateData: any,
    ) {
        // Prevent users from changing their own role/userType
        delete updateData.role;
        delete updateData.userType;
        delete updateData.isActive;
        delete updateData.password;
        return this.usersService.update(userId, updateData);
    }

    @Put(':id')
    @Roles('superadmin', 'admin')
    @UseGuards(RolesGuard)
    async update(@Param('id') id: string, @Body() updateData: any) {
        delete updateData.password;
        return this.usersService.update(id, updateData);
    }

    @Patch('me/password')
    async changePassword(
        @CurrentUser('_id') userId: string,
        @Body() changePasswordDto: ChangePasswordDto,
    ) {
        return this.usersService.changePassword(
            userId,
            changePasswordDto.currentPassword,
            changePasswordDto.newPassword,
        );
    }

    @Patch(':id/toggle-active')
    @Roles('superadmin', 'admin')
    @UseGuards(RolesGuard)
    async toggleActive(@Param('id') id: string) {
        return this.usersService.toggleActive(id);
    }

    @Delete(':id')
    @Roles('superadmin')
    @UseGuards(RolesGuard)
    async delete(@Param('id') id: string) {
        return this.usersService.delete(id);
    }
}
