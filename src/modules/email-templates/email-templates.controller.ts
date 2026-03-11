import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { EmailTemplatesService } from './email-templates.service';
import { Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';

@Controller('email-templates')
@Roles('superadmin', 'admin') // Only admins can manage templates
@UseGuards(RolesGuard)
export class EmailTemplatesController {
    constructor(private readonly templatesService: EmailTemplatesService) { }

    @Get()
    async findAll() {
        return this.templatesService.findAll();
    }

    @Get(':id')
    async findById(@Param('id') id: string) {
        return this.templatesService.findById(id);
    }

    @Post()
    async create(@Body() createData: any) {
        return this.templatesService.create(createData);
    }

    @Put(':id')
    async update(@Param('id') id: string, @Body() updateData: any) {
        return this.templatesService.update(id, updateData);
    }

    @Delete(':id')
    async delete(@Param('id') id: string) {
        return this.templatesService.delete(id);
    }
}
