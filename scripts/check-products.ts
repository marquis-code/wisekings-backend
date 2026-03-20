import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wisekings';

async function run() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const CategorySchema = new mongoose.Schema({}, { strict: false });
        const Category = mongoose.model('Category', CategorySchema, 'categories');

        const ProductSchema = new mongoose.Schema({
            category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' }
        }, { strict: false });
        const Product = mongoose.model('Product', ProductSchema, 'products');

        const products = await Product.find({ isActive: true }).populate('category').lean();
        console.log(`Found ${products.length} active products:`);
        products.forEach((p: any) => {
            console.log(`- ${p.name?.en || p.name} (Category: ${p.category?.name || 'None'}, Slug: ${p.slug})`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

run();
