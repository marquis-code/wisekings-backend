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

// ── Real Wisekings Products ───────────────────────────────────────────────────
const products = [
    // ── Popcorn ───────────────────────────────────────────────────────────────
    {
        name: 'Popcorn 30pcs Per Bag',
        description: 'A generous bag of 30 individually portioned Wisekings popcorn packs. Light, airy, and bursting with flavour — ideal for sharing at events, parties, or as daily snacks.',
        price: 2800,
        compareAtPrice: 3000,
        stock: 150,
        categorySlug: 'popcorn',
        sku: 'WK-POP-30B',
        weight: 300,
        tags: ['popcorn', 'sharing', 'party', 'bulk'],
        slug: 'popcorn-30pcs-per-bag',
        images: ['https://images.unsplash.com/photo-1578332158093-4a004bb15d65?auto=format&fit=crop&q=80&w=800'],
    },

    // ── Potato Chips ──────────────────────────────────────────────────────────
    {
        name: 'Potato Chips 220g Jar',
        description: 'Crispy, golden potato chips packed in a resealable 220g jar. NAFDAC-certified for your peace of mind. Great for kids, offices, and home snacking.',
        price: 3000,
        compareAtPrice: 3200,
        stock: 120,
        categorySlug: 'potato-chips',
        sku: 'WK-CHI-220J',
        weight: 220,
        tags: ['potato chips', 'jar', 'crispy'],
        slug: 'potato-chips-220g-jar',
        images: ['https://images.unsplash.com/photo-1566478989037-eec1707849e7?auto=format&fit=crop&q=80&w=800'],
    },
    {
        name: 'Potato Chips 350g Pack',
        description: 'Extra value 350g pack of Wisekings signature potato chips. Crunchy and perfectly seasoned for a satisfying snack experience.',
        price: 3500,
        compareAtPrice: 4000,
        stock: 100,
        categorySlug: 'potato-chips',
        sku: 'WK-CHI-350P',
        weight: 350,
        tags: ['potato chips', 'pack', 'value'],
        slug: 'potato-chips-350g-pack',
        images: ['https://images.unsplash.com/photo-1613967193490-1d17b930c1a1?auto=format&fit=crop&q=80&w=800'],
    },
    {
        name: 'Potato Chips Sachet',
        description: 'Convenient and pocket-friendly Wisekings potato chips sachet. The perfect on-the-go snack for any time of day.',
        price: 2800,
        compareAtPrice: 3000,
        stock: 300,
        categorySlug: 'potato-chips',
        sku: 'WK-CHI-SAC',
        weight: 50,
        tags: ['potato chips', 'sachet', 'on-the-go', 'affordable'],
        slug: 'potato-chips-sachet',
        images: ['https://images.unsplash.com/photo-1599490659213-e2b9527bb087?auto=format&fit=crop&q=80&w=800'],
    },

    // ── Plantain Chips ────────────────────────────────────────────────────────
    {
        name: 'Ripe Plantain Chips 300g Jar',
        description: 'Sweet and crunchy ripe plantain chips in a 300g jar. Made from carefully selected ripe plantains — a uniquely Nigerian snack with a premium twist.',
        price: 4300,
        compareAtPrice: 4800,
        stock: 80,
        categorySlug: 'plantain-chips',
        sku: 'WK-PLT-300J',
        weight: 300,
        tags: ['plantain chips', 'jar', 'ripe', 'premium'],
        slug: 'ripe-plantain-chips-300g-jar',
        images: ['https://images.unsplash.com/photo-1623933939524-814d9b4dbcb4?auto=format&fit=crop&q=80&w=800'],
        relatedSlugs: ['unripe-plantain-chips-300g-jar']
    },
    {
        name: 'Ripe Plantain Chips 30g x 24pcs Per Bag',
        description: 'A bag of 24 x 30g ripe plantain chip pouches from Wisekings. Perfect for retail distribution, bulk orders, or corporate gifting.',
        price: 8500,
        compareAtPrice: 10500,
        stock: 60,
        categorySlug: 'plantain-chips',
        sku: 'WK-PLT-30G24',
        weight: 720,
        tags: ['plantain chips', 'bulk', 'retail', '24-pack'],
        slug: 'ripe-plantain-chips-30g-x-24pcs-per-bag',
        images: ['https://images.unsplash.com/photo-1549465220-1a8b9238cd48?q=80&w=800&auto=format&fit=crop'],
    },
    {
        name: 'Ripe Plantain Chips 50g Pouch x 12pcs',
        description: 'A carton of 12 x 50g ripe plantain chips pouches. Great value for retailers and distributors who want a consistently high-quality product.',
        price: 10200,
        compareAtPrice: 10800,
        stock: 50,
        categorySlug: 'plantain-chips',
        sku: 'WK-PLT-50G12',
        weight: 600,
        tags: ['plantain chips', 'pouch', 'carton', '12-pack'],
        slug: 'ripe-plantain-chips-50g-pouch-x-12pcs',
        images: ['https://images.unsplash.com/photo-1505576391880-b3f9d713dc4f?auto=format&fit=crop&q=80&w=800'],
    },
    {
        name: 'Ripe Plantain Chips 50g Pouch x 24pcs',
        description: 'Wisekings ripe plantain chips in convenient 50g pouches, sold as a carton of 24. Ideal for wholesale buyers or stock-up purchases.',
        price: 19200,
        compareAtPrice: 20000,
        stock: 40,
        categorySlug: 'plantain-chips',
        sku: 'WK-PLT-50G24',
        weight: 1200,
        tags: ['plantain chips', 'pouch', 'wholesale', '24-pack'],
        slug: 'ripe-plantain-chips-50g-pouch-x-24pcs',
        images: ['https://images.unsplash.com/photo-1528975604071-b4dc52a2d18c?auto=format&fit=crop&q=80&w=800'],
    },
    {
        name: 'Ripe Plantain Chips 50g Pouch x 50pcs',
        description: 'Our largest plantain chips bulk pack — 50 x 50g pouches per carton. Perfect for large-scale retail, supermarkets, and distributor partners.',
        price: 37500,
        compareAtPrice: 42500,
        stock: 25,
        categorySlug: 'plantain-chips',
        sku: 'WK-PLT-50G50',
        weight: 2500,
        tags: ['plantain chips', 'pouch', 'bulk', 'distributor', '50-pack'],
        slug: 'ripe-plantain-chips-50g-pouch-x-50pcs',
        images: ['https://images.unsplash.com/photo-1534073828943-f801091bb18c?auto=format&fit=crop&q=80&w=800'],
        relatedSlugs: ['ripe-plantain-chips-30g-x-24pcs-per-bag', 'ripe-plantain-chips-50g-pouch-x-24pcs']
    },
    {
        name: 'Unripe Plantain Chips 300g Jar',
        description: 'Savory and crispy unripe plantain chips. A healthy, low-sugar alternative to our ripe chips, packed with the same Wisekings quality.',
        price: 4300,
        compareAtPrice: 4800,
        stock: 80,
        categorySlug: 'plantain-chips',
        sku: 'WK-PLT-U300J',
        weight: 300,
        tags: ['plantain chips', 'jar', 'unripe', 'savory'],
        slug: 'unripe-plantain-chips-300g-jar',
        images: ['https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&q=80&w=800'],
        relatedSlugs: ['ripe-plantain-chips-300g-jar']
    },
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

            const { categorySlug, relatedSlugs, ...productPayload } = prodData as any;
            await (Product as any).create({ ...productPayload, category: category._id });
            console.log(`   ✔  ${productPayload.name}  (₦${productPayload.price.toLocaleString()})`);
        }

        // Second pass to link related products
        console.log('\n🔗  Linking related products...');
        const allProducts = await (Product as any).find({});
        for (const prodData of products as any) {
            if (prodData.relatedSlugs && prodData.relatedSlugs.length > 0) {
                const targetProduct = allProducts.find((p: any) => p.slug === prodData.slug);
                const relatedIds = prodData.relatedSlugs
                    .map((slug: string) => allProducts.find((p: any) => p.slug === slug)?._id)
                    .filter(Boolean);
                
                if (targetProduct && relatedIds.length > 0) {
                    await (Product as any).findByIdAndUpdate(targetProduct._id, {
                        $set: { relatedProducts: relatedIds }
                    });
                    console.log(`   ✔  Linked ${relatedIds.length} products to ${prodData.name}`);
                }
            }
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
