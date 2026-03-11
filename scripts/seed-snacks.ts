import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

// Schemas
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
    dimensions: {
        length: Number,
        width: Number,
        height: Number,
    },
    tags: { type: [String], default: [] },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    totalSold: { type: Number, default: 0 },
    avgRating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
}, { timestamps: true });

const Category = mongoose.model('Category', CategorySchema, 'categories');
const Product = mongoose.model('Product', ProductSchema, 'products');

const categories = [
    { name: 'Chips & Crisps', slug: 'chips-crisps', description: 'Crunchy and salty snacks for any time.' },
    { name: 'Cookies & Biscuits', slug: 'cookies-biscuits', description: 'Sweet and savory baked treats.' },
    { name: 'Chocolate & Candy', slug: 'chocolate-candy', description: 'For those with a sweet tooth.' },
    { name: 'Nuts & Seeds', slug: 'nuts-seeds', description: 'Healthy and protein-packed snacks.' },
    { name: 'Popcorn', slug: 'popcorn', description: 'The perfect companion for movie nights.' },
    { name: 'Fruit Snacks', slug: 'fruit-snacks', description: 'Naturally sweet and chewy fruit-based snacks.' },
];

const products = [
    // Chips & Crisps
    {
        name: 'Classic Salted Potato Chips',
        description: 'Perfectly thin and crispy potato chips with a touch of sea salt.',
        price: 3.50,
        compareAtPrice: 4.00,
        stock: 100,
        categorySlug: 'chips-crisps',
        sku: 'CHP-CLS-001',
        weight: 150,
        tags: ['salty', 'potato', 'classic'],
        slug: 'classic-salted-potato-chips'
    },
    {
        name: 'Spicy Barbecue Crisps',
        description: 'Bold barbecue flavor with a spicy kick.',
        price: 3.75,
        stock: 80,
        categorySlug: 'chips-crisps',
        sku: 'CHP-BBQ-002',
        weight: 150,
        tags: ['spicy', 'barbecue', 'crunchy'],
        slug: 'spicy-barbecue-crisps'
    },
    // Cookies & Biscuits
    {
        name: 'Double Chocolate Chip Cookies',
        description: 'Soft and chewy cookies loaded with dark chocolate chips.',
        price: 5.00,
        compareAtPrice: 6.50,
        stock: 50,
        categorySlug: 'cookies-biscuits',
        sku: 'COK-DCH-001',
        weight: 200,
        tags: ['sweet', 'chocolate', 'chewy'],
        slug: 'double-chocolate-chip-cookies'
    },
    {
        name: 'Oatmeal Raisin Biscuits',
        description: 'Wholesome oats and sweet raisins in a classic biscuit.',
        price: 4.50,
        stock: 60,
        categorySlug: 'cookies-biscuits',
        sku: 'COK-OAT-002',
        weight: 200,
        tags: ['healthy', 'oatmeal', 'raisin'],
        slug: 'oatmeal-raisin-biscuits'
    },
    // Chocolate & Candy
    {
        name: 'Assorted Fruit Gummies',
        description: 'A mix of strawberry, orange, and lemon flavored gummy candies.',
        price: 2.99,
        stock: 120,
        categorySlug: 'chocolate-candy',
        sku: 'CAN-FRT-001',
        weight: 100,
        tags: ['sweet', 'gummy', 'fruit'],
        slug: 'assorted-fruit-gummies'
    },
    {
        name: 'Dark Chocolate Sea Salt Bar',
        description: 'Rich 70% dark chocolate with a hint of sea salt.',
        price: 4.99,
        stock: 45,
        categorySlug: 'chocolate-candy',
        sku: 'CAN-DCH-002',
        weight: 80,
        tags: ['chocolate', 'dark', 'fancy'],
        slug: 'dark-chocolate-sea-salt-bar'
    },
    // Nuts & Seeds
    {
        name: 'Roasted Salted Almonds',
        description: 'Premium roasted almonds lightly seasoned with sea salt.',
        price: 6.99,
        compareAtPrice: 8.00,
        stock: 30,
        categorySlug: 'nuts-seeds',
        sku: 'NUT-ALM-001',
        weight: 250,
        tags: ['healthy', 'nuts', 'protein'],
        slug: 'roasted-salted-almonds'
    },
    {
        name: 'Honey Roasted Peanuts',
        description: 'Sweet and crunchy peanuts roasted with honey.',
        price: 3.99,
        stock: 150,
        categorySlug: 'nuts-seeds',
        sku: 'NUT-PNT-002',
        weight: 300,
        tags: ['sweet', 'salty', 'nuts'],
        slug: 'honey-roasted-peanuts'
    },
    // Popcorn
    {
        name: 'Movie Theater Butter Popcorn',
        description: 'Extra buttery and salty popcorn for the ultimate movie experience.',
        price: 2.50,
        stock: 200,
        categorySlug: 'popcorn',
        sku: 'POP-BUT-001',
        weight: 100,
        tags: ['salty', 'butter', 'classic'],
        slug: 'movie-theater-butter-popcorn'
    },
    {
        name: 'Sweet & Salty Kettle Corn',
        description: 'Hand-popped popcorn with a perfect balance of sweet and salty.',
        price: 3.25,
        stock: 90,
        categorySlug: 'popcorn',
        sku: 'POP-KET-002',
        weight: 120,
        tags: ['sweet', 'salty', 'kettle'],
        slug: 'sweet-and-salty-kettle-corn'
    },
    // Fruit Snacks
    {
        name: 'Dried Mango Slices',
        description: 'Naturally sweet and chewy dried mango slices.',
        price: 5.99,
        stock: 40,
        categorySlug: 'fruit-snacks',
        sku: 'FRT-MNG-001',
        weight: 150,
        tags: ['healthy', 'fruit', 'chewy'],
        slug: 'dried-mango-slices'
    }
];

async function seedSnacks() {
    if (!MONGODB_URI) {
        console.error('MONGODB_URI is not defined in .env');
        process.exit(1);
    }

    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Clear existing categories and products (optional, but good for clean seed)
        // await Category.deleteMany({});
        // await Product.deleteMany({});

        console.log('Seeding categories...');
        const createdCategories = [];
        for (const catData of categories) {
            let category = await Category.findOne({ slug: catData.slug });
            if (!category) {
                category = await Category.create(catData);
                console.log(`Created category: ${catData.name}`);
            } else {
                console.log(`Category already exists: ${catData.name}`);
            }
            createdCategories.push(category);
        }

        console.log('Seeding products...');
        for (const prodData of products) {
            const category = createdCategories.find(c => c.slug === prodData.categorySlug);
            if (!category) {
                console.warn(`Category not found for product: ${prodData.name} (slug: ${prodData.categorySlug})`);
                continue;
            }

            const { categorySlug, ...productPayload } = prodData;
            const existingProduct = await Product.findOne({ slug: productPayload.slug });

            if (!existingProduct) {
                await Product.create({
                    ...productPayload,
                    category: category._id
                });
                console.log(`Created product: ${productPayload.name}`);
            } else {
                console.log(`Product already exists: ${productPayload.name}`);
            }
        }

        console.log('Seeding completed successfully!');

    } catch (error) {
        console.error('Error seeding snacks:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

seedSnacks();
