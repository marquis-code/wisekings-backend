import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../src/modules/users/schemas/user.schema';
import { Product, ProductDocument } from '../src/modules/products/schemas/product.schema';
import { Store, StoreDocument } from '../src/modules/stores/schemas/store.schema';
import { Category, CategoryDocument } from '../src/modules/categories/schemas/category.schema';
import { Banner, BannerDocument } from '../src/modules/banners/schemas/banner.schema';

async function bootstrap() {
    console.log('Starting aggressive image optimization script (WebP)...');

    // Create the NestJS application context (will establish DB connection)
    const app = await NestFactory.createApplicationContext(AppModule);

    // Helper function to aggressively optimize Cloudinary URLs to WebP format
    const optimizeUrl = (url: string) => {
        if (!url || !url.includes('cloudinary.com')) return url;
        // Ignore if already optimized
        if (url.includes('f_webp') || url.includes('/v') && url.endsWith('.webp')) return url;
        
        // Add forced f_webp,q_auto transformations to existing Cloudinary URLs for max optimization
        // Example: https://res.cloudinary.com/xyz/image/upload/v123... -> https://res.cloudinary.com/xyz/image/upload/f_webp,q_auto:best/v123...
        return url.replace('/image/upload/', '/image/upload/f_webp,q_auto:best/');
    };

    try {
        // 1. Optimize Users
        const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
        const users = await userModel.find({ avatar: { $regex: 'cloudinary.com' } });
        let userCount = 0;
        for (const user of users) {
             const optimized = optimizeUrl(user.avatar);
             if (optimized !== user.avatar) {
                 user.avatar = optimized;
                 await user.save();
                 userCount++;
             }
        }
        console.log(`Optimized ${userCount} user avatars to WebP.`);

        // 2. Optimize Products
        const prodModel = app.get<Model<ProductDocument>>(getModelToken(Product.name));
        const products = await prodModel.find({ 'images.0': { $exists: true } });
        let prodCount = 0;
        for (const prod of products) {
            let updated = false;
            // Iterate and optimize gallery images
            if (prod.images && Array.isArray(prod.images)) {
                 const newImages = prod.images.map(img => optimizeUrl(img));
                 if (JSON.stringify(newImages) !== JSON.stringify(prod.images)) {
                     prod.images = newImages;
                     updated = true;
                 }
            }
            if (updated) {
                await prod.save();
                prodCount++;
            }
        }
        console.log(`Optimized ${prodCount} product image galleries to WebP.`);

        // 3. Optimize Stores
        try {
            const storeModel = app.get<Model<StoreDocument>>(getModelToken(Store.name));
            const stores = await storeModel.find({ 
                $or: [
                    { logo: { $regex: 'cloudinary.com' } },
                    { coverImage: { $regex: 'cloudinary.com' } }
                ]
            });
            let storeCount = 0;
            for (const store of stores) {
                 let updated = false;
                 if (store.logo && store.logo !== optimizeUrl(store.logo)) {
                     store.logo = optimizeUrl(store.logo);
                     updated = true;
                 }
                 if (store.coverImage && store.coverImage !== optimizeUrl(store.coverImage)) {
                     store.coverImage = optimizeUrl(store.coverImage);
                     updated = true;
                 }
                 if (updated) {
                     await store.save();
                     storeCount++;
                 }
            }
            console.log(`Optimized ${storeCount} store logos/covers to WebP.`);
        } catch (e) {
            console.log('Skipping stores, model might differ or not exist.');
        }

        // 4. Optimize Categories
        try {
            const catModel = app.get<Model<CategoryDocument>>(getModelToken(Category.name));
            const categories = await catModel.find({ image: { $regex: 'cloudinary.com' } });
            let catCount = 0;
            for (const cat of categories) {
                 const optimized = optimizeUrl(cat.image);
                 if (optimized !== cat.image) {
                     cat.image = optimized;
                     await cat.save();
                     catCount++;
                 }
            }
            console.log(`Optimized ${catCount} category images to WebP.`);
        } catch (e) {
            console.log('Skipping categories, model might differ or not exist.');
        }

        // 5. Optimize Banners
        try {
            const bannerModel = app.get<Model<BannerDocument>>(getModelToken(Banner.name));
            const banners = await bannerModel.find({ image: { $regex: 'cloudinary.com' } });
            let bannerCount = 0;
            for (const banner of banners) {
                 const optimized = optimizeUrl(banner.image);
                 if (optimized !== banner.image) {
                     banner.image = optimized;
                     await banner.save();
                     bannerCount++;
                 }
            }
            console.log(`Optimized ${bannerCount} banner images to WebP.`);
        } catch (e) {
            console.log('Skipping banners, model might differ or not exist.');
        }

    } catch (error) {
        console.error('Error during image optimization:', error);
    } finally {
        await app.close();
        console.log('Image WebP optimization script complete.');
    }
}

bootstrap().catch(console.error);
