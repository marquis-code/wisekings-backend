import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wisekings';

async function run() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        if (!db) {
            console.error('❌ Database connection not established');
            return;
        }

        const result = await db.collection('shipping_configs').updateMany(
            {},
            { $set: { waybillFee: 0 } }
        );

        console.log(`✅ Updated ${result.modifiedCount} shipping configuration(s) to waybillFee: 0`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

run();
