import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Clear All Test Data from Database
 * WARNING: This will delete ALL data from the database!
 */

const clearDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hindustan-tiles');
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    // Get all collections
    const collections = await db.listCollections().toArray();
    console.log(`\n📦 Found ${collections.length} collections:`);
    collections.forEach(col => console.log(`   - ${col.name}`));

    // Ask for confirmation
    console.log('\n⚠️  WARNING: This will DELETE ALL DATA from the database!');
    console.log('⚠️  Press Ctrl+C within 5 seconds to cancel...\n');

    // Wait 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('🗑️  Starting deletion...\n');

    // Delete all documents from each collection
    let totalDeleted = 0;
    for (const collection of collections) {
      const collectionName = collection.name;
      
      // Skip system collections
      if (collectionName.startsWith('system.')) {
        console.log(`⏭️  Skipping system collection: ${collectionName}`);
        continue;
      }

      const result = await db.collection(collectionName).deleteMany({});
      console.log(`   ✓ Deleted ${result.deletedCount} documents from ${collectionName}`);
      totalDeleted += result.deletedCount;
    }

    console.log(`\n✅ Successfully deleted ${totalDeleted} documents from ${collections.length} collections`);
    console.log('✅ Database is now empty and ready for real data\n');

    // Reset counters (if you have any)
    console.log('🔢 Resetting counters...');
    await db.collection('counters').deleteMany({});
    console.log('✅ Counters reset\n');

    await mongoose.connection.close();
    console.log('👋 Disconnected from MongoDB');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error clearing database:', error);
    process.exit(1);
  }
};

// Run the script
clearDatabase();
