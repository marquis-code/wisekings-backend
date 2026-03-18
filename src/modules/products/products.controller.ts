import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Param,
    Body,
    Query,
    UseGuards,
    Patch,
    Headers,
    Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ProductsService } from './products.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { Public, Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';
import { PaginationDto } from '../../common/dto';

@Controller('products')
@UseGuards(RolesGuard)
export class ProductsController {
    constructor(private readonly productsService: ProductsService) { }

    @Public()
    @Get()
    async findAll(
        @Query() paginationDto: PaginationDto,
        @Headers('x-locale') locale: string = 'en',
        @Query('category') category?: string,
    ) {
        return this.productsService.findAll(paginationDto, { category, isActive: true }, locale);
    }

    @Get('admin/list')
    @Roles('admin', 'superadmin')
    async findAllAdmin(
        @Query() paginationDto: PaginationDto,
        @Headers('x-locale') locale: string = 'en',
        @Query('category') category?: string,
        @Query('isActive') isActive?: boolean,
    ) {
        return this.productsService.findAll(paginationDto, { category, isActive }, locale);
    }

    @Get('export')
    @Roles('admin', 'superadmin')
    async exportProducts(@Res() res: Response) {
        const csv = await this.productsService.exportToCsv();
        res.header('Content-Type', 'text/csv');
        res.attachment('products_export.csv');
        return res.send(csv);
    }

    @Public()
    @Get('slug/:slug')
    async findBySlug(@Param('slug') slug: string, @Headers('x-locale') locale: string = 'en') {
        return this.productsService.findBySlug(slug, locale);
    }

    @Get(':id')
    async findById(@Param('id') id: string, @Headers('x-locale') locale: string = 'en') {
        return this.productsService.findById(id, locale);
    }

    @Post()
    @Roles('admin', 'superadmin')
    async create(@Body() dto: CreateProductDto) {
        return this.productsService.create(dto);
    }

    @Put(':id')
    @Roles('admin', 'superadmin')
    async update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
        return this.productsService.update(id, dto);
    }

    @Delete(':id')
    @Roles('admin', 'superadmin')
    async delete(@Param('id') id: string) {
        return this.productsService.delete(id);
    }

    // Categories Controller Logic (can be separate but keeping here for simplicity as per requirement)
    @Public()
    @Get('categories/all')
    async findAllCategories(@Headers('x-locale') locale: string = 'en') {
        return this.productsService.findAllCategories(locale);
    }

    @Post('categories')
    @Roles('admin', 'superadmin')
    async createCategory(@Body() dto: CreateCategoryDto) {
        return this.productsService.createCategory(dto);
    }

    @Put('categories/:id')
    @Roles('admin', 'superadmin')
    async updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
        return this.productsService.updateCategory(id, dto);
    }

    @Delete('categories/:id')
    @Roles('admin', 'superadmin')
    async deleteCategory(@Param('id') id: string) {
        return this.productsService.deleteCategory(id);
    }

    @Patch('bulk')
    @Roles('admin', 'superadmin')
    async bulkUpdate(@Body() body: { ids: string[]; update: any }) {
        return this.productsService.bulkUpdate(body.ids, body.update);
    }

    @Public()
    @Get(':id/recommendations')
    async getRecommendations(
        @Param('id') id: string,
        @Headers('x-locale') locale: string,
        @Query('limit') limit?: number,
    ) {
        return this.productsService.getRecommendations(id, parseInt(limit as any) || 4, locale || 'en');
    }
}
