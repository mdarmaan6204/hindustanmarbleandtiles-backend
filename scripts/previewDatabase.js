import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Preview what data will be deleted
 * Safe to run - only shows counts, doesn't delete anything
 */

const previewDeletion = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hindustan-tiles');
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;

    // Get all collections
    const collections = await db.listCollections().toArray();
    
    console.log('📊 DATABASE PREVIEW - Current Data Count:\n');
    console.log('═══════════════════════════════════════════');

    let totalDocuments = 0;
    const collectionData = [];

    for (const collection of collections) {
      const collectionName = collection.name;
      
      // Skip system collections
      if (collectionName.startsWith('system.')) continue;

      const count = await db.collection(collectionName).countDocuments();
      totalDocuments += count;
      
      collectionData.push({
        name: collectionName,
        count: count
      });
    }

    // Sort by count descending
    collectionData.sort((a, b) => b.count - a.count);

    // Display results
    collectionData.forEach(col => {
      const emoji = col.count > 0 ? '📦' : '📭';
      console.log(`${emoji} ${col.name.padEnd(20)} : ${col.count} documents`);
    });

    console.log('═══════════════════════════════════════════');
    console.log(`📊 TOTAL: ${totalDocuments} documents across ${collectionData.length} collections\n`);

    if (totalDocuments > 0) {
      console.log('💡 To delete all this data, run:');
      console.log('   node backend/scripts/clearDatabase.js\n');
    } else {
      console.log('✅ Database is already empty!\n');
    }

    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

// Run the script
previewDeletion();
