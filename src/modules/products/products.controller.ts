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
} from '@nestjs/common';
import { ProductsService } from './products.service';
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
        @Query('category') category?: string,
    ) {
        return this.productsService.findAll(paginationDto, { category, isActive: true });
    }

    @Get('admin/list')
    @Roles('admin', 'superadmin')
    async findAllAdmin(
        @Query() paginationDto: PaginationDto,
        @Query('category') category?: string,
        @Query('isActive') isActive?: boolean,
    ) {
        return this.productsService.findAll(paginationDto, { category, isActive });
    }

    @Public()
    @Get('slug/:slug')
    async findBySlug(@Param('slug') slug: string) {
        return this.productsService.findBySlug(slug);
    }

    @Get(':id')
    async findById(@Param('id') id: string) {
        return this.productsService.findById(id);
    }

    @Post()
    @Roles('admin', 'superadmin')
    async create(@Body() dto: any) {
        return this.productsService.create(dto);
    }

    @Put(':id')
    @Roles('admin', 'superadmin')
    async update(@Param('id') id: string, @Body() dto: any) {
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
    async findAllCategories() {
        return this.productsService.findAllCategories();
    }

    @Post('categories')
    @Roles('admin', 'superadmin')
    async createCategory(@Body() dto: any) {
        return this.productsService.createCategory(dto);
    }

    @Put('categories/:id')
    @Roles('admin', 'superadmin')
    async updateCategory(@Param('id') id: string, @Body() dto: any) {
        return this.productsService.updateCategory(id, dto);
    }

    @Delete('categories/:id')
    @Roles('admin', 'superadmin')
    async deleteCategory(@Param('id') id: string) {
        return this.productsService.deleteCategory(id);
    }
}
