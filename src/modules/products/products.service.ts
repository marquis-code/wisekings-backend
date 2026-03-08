import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { Category, CategoryDocument } from './schemas/category.schema';
import { PaginationDto, PaginatedResult } from '@common/dto';

@Injectable()
export class ProductsService {
    constructor(
        @InjectModel(Product.name) private productModel: Model<ProductDocument>,
        @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    ) { }

    async create(dto: any) {
        if (dto.category) {
            const category = await this.categoryModel.findById(dto.category);
            if (!category) throw new NotFoundException('Category not found');
        }

        const product = await this.productModel.create(dto);
        return product;
    }

    async findAll(paginationDto: PaginationDto, filters?: any) {
        const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', search } = paginationDto;
        const skip = (page - 1) * limit;

        const filter: any = {};
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { tags: { $regex: search, $options: 'i' } },
            ];
        }
        if (filters?.category) filter.category = new Types.ObjectId(filters.category);
        if (filters?.isActive !== undefined) filter.isActive = filters.isActive;

        const [data, total] = await Promise.all([
            this.productModel
                .find(filter)
                .populate('category', 'name slug')
                .sort({ [sortBy as string]: sortOrder === 'asc' ? 1 : -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            this.productModel.countDocuments(filter),
        ]);

        return new PaginatedResult(data as any[], total, page, limit);
    }

    async findById(id: string) {
        const product = await this.productModel
            .findById(id)
            .populate('category', 'name slug')
            .lean();
        if (!product) throw new NotFoundException('Product not found');
        return product;
    }

    async findBySlug(slug: string) {
        const product = await this.productModel
            .findOne({ slug, isActive: true })
            .populate('category', 'name slug')
            .lean();
        if (!product) throw new NotFoundException('Product not found');
        return product;
    }

    async update(id: string, dto: any) {
        if (dto.category) {
            const category = await this.categoryModel.findById(dto.category);
            if (!category) throw new NotFoundException('Category not found');
        }

        const product = await this.productModel.findByIdAndUpdate(id, dto, {
            new: true,
        });
        if (!product) throw new NotFoundException('Product not found');
        return product;
    }

    async delete(id: string) {
        const result = await this.productModel.findByIdAndDelete(id);
        if (!result) throw new NotFoundException('Product not found');
        return { message: 'Product deleted successfully' };
    }

    // Category Methods
    async findAllCategories() {
        return this.categoryModel.find().populate('parentCategory', 'name').sort({ sortOrder: 1, name: 1 }).lean();
    }

    async findCategoryById(id: string) {
        const category = await this.categoryModel.findById(id).lean();
        if (!category) throw new NotFoundException('Category not found');
        return category;
    }

    async createCategory(dto: any) {
        const existing = await this.categoryModel.findOne({ slug: dto.slug });
        if (existing) throw new BadRequestException('Category slug must be unique');

        return this.categoryModel.create(dto);
    }

    async updateCategory(id: string, dto: any) {
        const category = await this.categoryModel.findByIdAndUpdate(id, dto, { new: true });
        if (!category) throw new NotFoundException('Category not found');
        return category;
    }

    async deleteCategory(id: string) {
        // Check if products exist in category
        const productCount = await this.productModel.countDocuments({ category: new Types.ObjectId(id) });
        if (productCount > 0) {
            throw new BadRequestException('Cannot delete category with associated products');
        }

        const result = await this.categoryModel.findByIdAndDelete(id);
        if (!result) throw new NotFoundException('Category not found');
        return { message: 'Category deleted successfully' };
    }
}
