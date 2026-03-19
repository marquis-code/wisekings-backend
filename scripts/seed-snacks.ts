import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

// ── Schemas ──────────────────────────────────────────────────────────────────
const CategorySchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: String,
    image: String,
    parentCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: Number,
    images: { type: [String], default: [] },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    stock: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    sku: { type: String, trim: true },
    weight: { type: Number, default: 0, min: 0 },
    tags: { type: [String], default: [] },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    totalSold: { type: Number, default: 0 },
    avgRating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    unitDescription: String,
    unitPrice: Number,
    quantityPerPack: Number,
    costPricePerPack: Number,
    varietyType: String,
    relatedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
}, { timestamps: true });

const Category = mongoose.model('Category', CategorySchema, 'categories');
const Product = mongoose.model('Product', ProductSchema, 'products');

// ── Real Wisekings Categories ─────────────────────────────────────────────────
const categories = [
    {
        name: 'Popcorn',
        slug: 'popcorn',
        description: 'Light, crispy popcorn snacks – perfect for movie nights and everyday munching.',
        sortOrder: 1,
    },
    {
        name: 'Plantain Chips',
        slug: 'plantain-chips',
        description: 'Crunchy and flavourful ripe plantain chips in a variety of pack sizes.',
        sortOrder: 2,
    },
    {
        name: 'Potato Chips',
        slug: 'potato-chips',
        description: 'Classic potato chips available in jars, packs, and sachets.',
        sortOrder: 3,
    },
];

// ── Real Wisekings Products (14 Items from Table) ────────────────────────────────
const products = [
    // Popcorn
    {
        name: 'Popcorn (30g)',
        description: 'Premium quality Popcorn (30g). A delectable and crunchy delight for everyone. variety: Mini Pack.',
        price: 2800,
        unitPrice: 93.33,
        unitDescription: '30g',
        quantityPerPack: 30,
        costPricePerPack: 2800,
        varietyType: 'Mini Pack',
        stock: 50,
        categorySlug: 'popcorn',
        sku: 'WK-POP-30G',
        slug: 'popcorn-30g-mini',
        weight: 0.03,
        images: ['https://res.cloudinary.com/dn3xsj1jo/image/upload/v1773929215/products/bebux2js7cmfpluagv6r.jpg'],
        tags: ['popcorn', 'snack', 'mini']
    },
    // Plantain Chips
    {
        name: 'Plantain Chips (30g)',
        description: 'Premium quality Plantain Chips (30g). Variety: Ripe & Unripe. Packed with 24 units per carton.',
        price: 8500,
        unitPrice: 354.16,
        unitDescription: '30g',
        quantityPerPack: 24,
        costPricePerPack: 8500,
        varietyType: 'Ripe & Unripe',
        stock: 50,
        categorySlug: 'plantain-chips',
        sku: 'WK-PLN-30G',
        slug: 'plantain-chips-30g-carton',
        weight: 0.03,
        images: ['https://res.cloudinary.com/dn3xsj1jo/image/upload/v1773929215/products/bebux2js7cmfpluagv6r.jpg'],
        tags: ['plantain', 'chips', 'snack']
    },
    {
        name: 'Plantain Chips (50g) - 24pcs',
        description: 'Premium quality Plantain Chips (50g). Variety: Ripe & Unripe. Packed with 24 units per carton.',
        price: 19200,
        unitPrice: 800,
        unitDescription: '50g',
        quantityPerPack: 24,
        costPricePerPack: 19200,
        varietyType: 'Ripe & Unripe',
        stock: 50,
        categorySlug: 'plantain-chips',
        sku: 'WK-PLN-50G-24',
        slug: 'plantain-chips-50g-24pcs',
        weight: 0.05,
        images: ['https://res.cloudinary.com/dn3xsj1jo/image/upload/v1773929215/products/bebux2js7cmfpluagv6r.jpg'],
        tags: ['plantain', 'chips', 'snack']
    },
    {
        name: 'Plantain Chips (50g) - 50pcs',
        description: 'Premium quality Plantain Chips (50g). Variety: Ripe & Unripe. Packed with 50 units per carton.',
        price: 37500,
        unitPrice: 750,
        unitDescription: '50g',
        quantityPerPack: 50,
        costPricePerPack: 37500,
        varietyType: 'Ripe & Unripe',
        stock: 50,
        categorySlug: 'plantain-chips',
        sku: 'WK-PLN-50G-50',
        slug: 'plantain-chips-50g-50pcs',
        weight: 0.05,
        images: ['https://res.cloudinary.com/dn3xsj1jo/image/upload/v1773929215/products/bebux2js7cmfpluagv6r.jpg'],
        tags: ['plantain', 'chips', 'snack']
    },
    {
        name: 'Plantain Chips (80g) - 24pcs',
        description: 'Premium quality Plantain Chips (80g). Variety: Ripe & Unripe. Packed with 24 units per carton.',
        price: 31200,
        unitPrice: 1300,
        unitDescription: '80g',
        quantityPerPack: 24,
        costPricePerPack: 31200,
        varietyType: 'Ripe & Unripe',
        stock: 50,
        categorySlug: 'plantain-chips',
        sku: 'WK-PLN-80G-24',
        slug: 'plantain-chips-80g-24pcs',
        weight: 0.08,
        images: ['https://res.cloudinary.com/dn3xsj1jo/image/upload/v1773929215/products/bebux2js7cmfpluagv6r.jpg'],
        tags: ['plantain', 'chips', 'snack']
    },
    {
        name: 'Plantain Chips (80g) - 50pcs',
        description: 'Premium quality Plantain Chips (80g). Variety: Ripe & Unripe. Packed with 50 units per carton.',
        price: 62500,
        unitPrice: 1250,
        unitDescription: '80g',
        quantityPerPack: 50,
        costPricePerPack: 62500,
        varietyType: 'Ripe & Unripe',
        stock: 50,
        categorySlug: 'plantain-chips',
        sku: 'WK-PLN-80G-50',
        slug: 'plantain-chips-80g-50pcs',
        weight: 0.08,
        images: ['https://res.cloudinary.com/dn3xsj1jo/image/upload/v1773929215/products/bebux2js7cmfpluagv6r.jpg'],
        tags: ['plantain', 'chips', 'snack']
    },
    {
        name: 'Plantain Chips (300g Jar)',
        description: 'Premium quality Plantain Chips (300g). Variety: Ripe & Unripe. Packed with 12 units per carton.',
        price: 54000,
        unitPrice: 4500,
        unitDescription: '300g Jar',
        quantityPerPack: 12,
        costPricePerPack: 54000,
        varietyType: 'Ripe & Unripe',
        stock: 50,
        categorySlug: 'plantain-chips',
        sku: 'WK-PLN-300J',
        slug: 'plantain-chips-300g-jar',
        weight: 0.3,
        images: ['https://res.cloudinary.com/dn3xsj1jo/image/upload/v1773929215/products/bebux2js7cmfpluagv6r.jpg'],
        tags: ['plantain', 'chips', 'snack']
    },
    {
        name: 'Plantain Chips (520g Jar)',
        description: 'Premium quality Plantain Chips (520g). Variety: Ripe & Unripe. Packed with 12 units per carton.',
        price: 90000,
        unitPrice: 7500,
        unitDescription: '520g Jar',
        quantityPerPack: 12,
        costPricePerPack: 90000,
        varietyType: 'Ripe & Unripe',
        stock: 50,
        categorySlug: 'plantain-chips',
        sku: 'WK-PLN-520J',
        slug: 'plantain-chips-520g-jar',
        weight: 0.52,
        images: ['https://res.cloudinary.com/dn3xsj1jo/image/upload/v1773929215/products/bebux2js7cmfpluagv6r.jpg'],
        tags: ['plantain', 'chips', 'snack']
    },
    {
        name: 'Plantain Chips (650g Jar)',
        description: 'Premium quality Plantain Chips (650g). Variety: Ripe & Unripe. Packed with 12 units per carton.',
        price: 102000,
        unitPrice: 8500,
        unitDescription: '650g Jar',
        quantityPerPack: 12,
        costPricePerPack: 102000,
        varietyType: 'Ripe & Unripe',
        stock: 50,
        categorySlug: 'plantain-chips',
        sku: 'WK-PLN-650J',
        slug: 'plantain-chips-650g-jar',
        weight: 0.65,
        images: ['https://res.cloudinary.com/dn3xsj1jo/image/upload/v1773929215/products/bebux2js7cmfpluagv6r.jpg'],
        tags: ['plantain', 'chips', 'snack']
    },
    // Potato Chips
    {
        name: 'Potato Chips (20g)',
        description: 'Premium quality Potato Chips (20g). Variety: Peppered. Packed with 30 units per carton.',
        price: 2800,
        unitPrice: 93.33,
        unitDescription: '20g',
        quantityPerPack: 30,
        costPricePerPack: 2800,
        varietyType: 'Peppered',
        stock: 50,
        categorySlug: 'potato-chips',
        sku: 'WK-POT-20G',
        slug: 'potato-chips-20g-carton',
        weight: 0.02,
        images: ['https://res.cloudinary.com/dn3xsj1jo/image/upload/v1773929215/products/bebux2js7cmfpluagv6r.jpg'],
        tags: ['potato', 'chips', 'snack']
    },
    {
        name: 'Potato Chips (50g) - 24pcs',
        description: 'Premium quality Potato Chips (50g). Variety: Peppered. Packed with 24 units per carton.',
        price: 19200,
        unitPrice: 800,
        unitDescription: '50g',
        quantityPerPack: 24,
        costPricePerPack: 19200,
        varietyType: 'Peppered',
        stock: 50,
        categorySlug: 'potato-chips',
        sku: 'WK-POT-50G-24',
        slug: 'potato-chips-50g-24pcs',
        weight: 0.05,
        images: ['https://res.cloudinary.com/dn3xsj1jo/image/upload/v1773929215/products/bebux2js7cmfpluagv6r.jpg'],
        tags: ['potato', 'chips', 'snack']
    },
    {
        name: 'Potato Chips (50g) - 50pcs',
        description: 'Premium quality Potato Chips (50g). Variety: Peppered. Packed with 50 units per carton.',
        price: 37500,
        unitPrice: 750,
        unitDescription: '50g',
        quantityPerPack: 50,
        costPricePerPack: 37500,
        varietyType: 'Peppered',
        stock: 50,
        categorySlug: 'potato-chips',
        sku: 'WK-POT-50G-50',
        slug: 'potato-chips-50g-50pcs',
        weight: 0.05,
        images: ['https://res.cloudinary.com/dn3xsj1jo/image/upload/v1773929215/products/bebux2js7cmfpluagv6r.jpg'],
        tags: ['potato', 'chips', 'snack']
    },
    {
        name: 'Potato Chips (220g Jar)',
        description: 'Premium quality Potato Chips (220g). Variety: Peppered. Packed with 12 units per carton.',
        price: 36000,
        unitPrice: 3000,
        unitDescription: '220g Jar',
        quantityPerPack: 12,
        costPricePerPack: 36000,
        varietyType: 'Peppered',
        stock: 50,
        categorySlug: 'potato-chips',
        sku: 'WK-POT-220J',
        slug: 'potato-chips-220g-jar',
        weight: 0.22,
        images: ['https://res.cloudinary.com/dn3xsj1jo/image/upload/v1773929215/products/bebux2js7cmfpluagv6r.jpg'],
        tags: ['potato', 'chips', 'snack']
    },
    {
        name: 'Potato Chips (350g Jar)',
        description: 'Premium quality Potato Chips (350g). Variety: Peppered. Packed with 12 units per carton.',
        price: 42000,
        unitPrice: 3500,
        unitDescription: '350g Jar',
        quantityPerPack: 12,
        costPricePerPack: 42000,
        varietyType: 'Peppered',
        stock: 50,
        categorySlug: 'potato-chips',
        sku: 'WK-POT-350J',
        slug: 'potato-chips-350g-jar',
        weight: 0.35,
        images: ['https://res.cloudinary.com/dn3xsj1jo/image/upload/v1773929215/products/bebux2js7cmfpluagv6r.jpg'],
        tags: ['potato', 'chips', 'snack']
    }
];

// ── Seed Function ─────────────────────────────────────────────────────────────
async function seedSnacks() {
    if (!MONGODB_URI) {
        console.error('❌  MONGODB_URI is not defined in .env');
        process.exit(1);
    }

    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅  Connected to MongoDB');

        // Clear existing placeholder data
        console.log('🗑️   Clearing old categories and products...');
        await (Category as any).deleteMany({});
        await (Product as any).deleteMany({});
        console.log('   Cleared.');

        // Seed categories
        console.log('\n📂  Seeding categories...');
        const createdCategories: any[] = [];
        for (const catData of categories) {
            const category = await (Category as any).create(catData);
            console.log(`   ✔  ${catData.name}`);
            createdCategories.push(category);
        }

        // Seed products
        console.log('\n🛒  Seeding products...');
        for (const prodData of products) {
            const category = createdCategories.find(c => c.slug === prodData.categorySlug);
            if (!category) {
                console.warn(`   ⚠  Category not found for: ${prodData.name}`);
                continue;
            }

            const { categorySlug, ...productPayload } = prodData as any;
            await (Product as any).create({ ...productPayload, category: category._id });
            console.log(`   ✔  ${productPayload.name}  (₦${productPayload.price.toLocaleString()})`);
        }

        console.log('\n🎉  Seeding completed successfully!');

    } catch (error) {
        console.error('❌  Error seeding:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

seedSnacks();
