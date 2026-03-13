import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ContactService } from './contact.service';
import { Contact, ContactStatus } from './schemas/contact.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';

@Controller('contact')
export class ContactController {
    constructor(private readonly contactService: ContactService) { }

    @Post()
    async create(@Body() data: Partial<Contact>) {
        return this.contactService.create(data);
    }

    @Get()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin', 'support')
    async findAll(@Query() query: any) {
        return this.contactService.findAll(query);
    }

    @Get(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin', 'support')
    async findOne(@Param('id') id: string) {
        return this.contactService.findOne(id);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin', 'support')
    async update(@Param('id') id: string, @Body() data: Partial<Contact>) {
        return this.contactService.update(id, data);
    }
}
