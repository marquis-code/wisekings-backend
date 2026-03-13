import {
    Injectable,
    NotFoundException,
    BadRequestException,
    Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
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
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) { }

    async create(dto: any) {
        if (dto.category) {
            const category = await this.categoryModel.findById(dto.category);
            if (!category) throw new NotFoundException('Category not found');
        }

        // Handle string to Map conversion if necessary for legacy-style DTOs
        if (typeof dto.name === 'string') {
            dto.name = { en: dto.name }; // Default to English
        }
        if (typeof dto.description === 'string') {
            dto.description = { en: dto.description };
        }

        const product = await this.productModel.create(dto);
        await this.cacheManager.del(`product:categories:*`); // Invalidate categories just in case
        return product;
    }

    async findAll(paginationDto: PaginationDto, filters?: any, locale: string = 'en') {
        const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', search } = paginationDto;
        const skip = ((page as any) - 1) * (limit as any);

        const filter: any = {};
        if (search) {
            // Search across all languages in the name Map
            filter.$or = [
                { [`name.${locale}`]: { $regex: search, $options: 'i' } },
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
                .limit(limit as any)
                .lean(),
            this.productModel.countDocuments(filter),
        ]);

        const localizedData = data.map(item => this.localizeProduct(item, locale));
        return new PaginatedResult(localizedData, total, page, limit);
    }

    async findById(id: string, locale: string = 'en') {
        const cacheKey = `product:id:${id}:${locale}`;
        const cached = await this.cacheManager.get(cacheKey);
        if (cached) return cached;

        const product = await this.productModel
            .findById(id)
            .populate('category', 'name slug')
            .lean();
        if (!product) throw new NotFoundException('Product not found');
        
        const localized = this.localizeProduct(product, locale);
        await this.cacheManager.set(cacheKey, localized, 3600);
        return localized;
    }

    async findBySlug(slug: string, locale: string = 'en') {
        const cacheKey = `product:slug:${slug}:${locale}`;
        const cached = await this.cacheManager.get(cacheKey);
        if (cached) return cached;

        const product = await this.productModel
            .findOne({ slug, isActive: true })
            .populate('category', 'name slug')
            .lean();
        if (!product) throw new NotFoundException('Product not found');
        
        const localized = this.localizeProduct(product, locale);
        await this.cacheManager.set(cacheKey, localized, 3600);
        return localized;
    }

    async update(id: string, dto: any) {
        if (dto.category) {
            const category = await this.categoryModel.findById(dto.category);
            if (!category) throw new NotFoundException('Category find failed');
        }

        // Handle string to Map conversion if necessary (fixes "Iterator value R" 500 error)
        if (dto.name && typeof dto.name === 'string') {
            dto.name = { en: dto.name };
        }
        if (dto.description && typeof dto.description === 'string') {
            dto.description = { en: dto.description };
        }

        const product = await this.productModel.findByIdAndUpdate(id, dto, {
            new: true,
        });
        if (!product) throw new NotFoundException('Product not found');

        // Clear cache
        await this.cacheManager.del(`product:id:${id}:*`);
        if (product.slug) {
            await this.cacheManager.del(`product:slug:${product.slug}:*`);
        }
        await this.cacheManager.del(`product:recommendations:${id}:*`);

        return product;
    }

    async delete(id: string) {
        const product = await this.productModel.findById(id).lean();
        const result = await this.productModel.findByIdAndDelete(id);
        if (!result) throw new NotFoundException('Product not found');

        // Clear cache
        await this.cacheManager.del(`product:id:${id}:*`);
        if (product && (product as any).slug) {
            await this.cacheManager.del(`product:slug:${(product as any).slug}:*`);
        }
        await this.cacheManager.del(`product:recommendations:${id}:*`);

        return { message: 'Product deleted successfully' };
    }

    // Category Methods
    async findAllCategories(locale: string = 'en') {
        const cacheKey = `product:categories:${locale}`;
        const cached = await this.cacheManager.get(cacheKey);
        if (cached) return cached;

        const categories = await this.categoryModel
            .find()
            .populate('parentCategory', 'name')
            .sort({ sortOrder: 1, name: 1 })
            .lean();
        
        const localized = categories.map(cat => this.localizeCategory(cat, locale));
        await this.cacheManager.set(cacheKey, localized, 86400); // 24 hours
        return localized;
    }

    async findCategoryById(id: string, locale: string = 'en') {
        const category = await this.categoryModel.findById(id).lean();
        if (!category) throw new NotFoundException('Category not found');
        return this.localizeCategory(category, locale);
    }

    async createCategory(dto: any) {
        // Robust normalization for Map fields (name, description)
        if (dto.name && typeof dto.name === 'string') {
            dto.name = { en: dto.name };
        }
        if (dto.description && typeof dto.description === 'string') {
            dto.description = { en: dto.description };
        }

        const existing = await this.categoryModel.findOne({ slug: dto.slug });
        if (existing) throw new BadRequestException('Category slug must be unique');

        return this.categoryModel.create(dto);
    }

    async updateCategory(id: string, dto: any) {
        // Normalize Map fields (name, description) to objects if provided as strings
        if (dto.name && typeof dto.name === 'string') {
            dto.name = { en: dto.name };
        }
        if (dto.description && typeof dto.description === 'string') {
            dto.description = { en: dto.description };
        }

        const category = await this.categoryModel.findByIdAndUpdate(
            id,
            { $set: dto },
            { new: true }
        );

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

    async getRecommendations(productId: string, limit = 4, locale = 'en') {
        const cacheKey = `product:recommendations:${productId}:${locale}`;
        const cached = await this.cacheManager.get(cacheKey);
        if (cached) return cached;

        const product = await this.productModel.findById(productId);
        if (!product) throw new NotFoundException('Product not found');

        const recommendations = await this.productModel.find({
            _id: { $ne: product._id },
            $or: [
                { category: product.category },
                { tags: { $in: product.tags } },
            ],
            isActive: true,
        }).limit(limit as any).lean();

        const localized = recommendations.map(p => this.localizeProduct(p as any, locale));
        await this.cacheManager.set(cacheKey, localized, 3600);
        return localized;
    }

    async bulkUpdate(ids: string[], update: any) {
        await this.productModel.updateMany(
            { _id: { $in: ids.map(id => new Types.ObjectId(id)) } },
            { $set: update }
        );
        return { message: `${ids.length} products updated successfully` };
    }

    // Localization Helpers
    private localizeProduct(product: any, locale: string): any {
        if (!product) return null;
        return {
            ...product,
            name: this.translate(product.name, locale),
            description: this.translate(product.description, locale),
            category: this.localizeCategory(product.category, locale),
            // Include raw translations for editors if needed
            _translations: {
                name: product.name,
                description: product.description,
            }
        };
    }

    private localizeCategory(category: any, locale: string): any {
        if (!category) return null;
        return {
            ...category,
            name: this.translate(category.name, locale),
            description: this.translate(category.description, locale),
            _translations: {
                name: category.name,
                description: category.description,
            }
        };
    }

    private translate(map: any, locale: string): string {
        if (!map) return '';
        if (typeof map === 'string') return map;
        return map[locale] || map['en'] || Object.values(map)[0] || '';
    }

    async exportToCsv() {
        const products = await this.productModel.find().populate('category').lean();
        const header = ['ID', 'Name', 'SKU', 'Price', 'Stock', 'Category', 'Status', 'CreatedAt'];
        const rows = products.map((p: any) => [
            p._id.toString(),
            `"${p.name.replace(/"/g, '""')}"`,
            p.sku || 'N/A',
            p.price,
            p.stock,
            p.category?.name || 'Uncategorized',
            p.isActive ? 'Active' : 'Inactive',
            p.createdAt?.toISOString() || ''
        ]);
        return [header.join(','), ...rows.map(r => r.join(','))].join('\n');
    }
}
