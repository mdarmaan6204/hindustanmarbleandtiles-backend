/**
 * Data Fix Script - Normalize Invalid Pieces
 * Fixes products where pieces >= piecesPerBox
 */

import mongoose from 'mongoose';
import Product from '../models/Product.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const fixInvalidPieces = async () => {
  try {
    console.log('🔧 Connecting to MongoDB...');
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI not found in environment variables');
    }
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const products = await Product.find({ isActive: true });
    console.log(`📦 Found ${products.length} active products`);

    let fixedCount = 0;
    const fixes = [];

    for (const product of products) {
      const piecesPerBox = product.piecesPerBox || 4;
      let needsUpdate = false;
      const changes = [];

      // Check stock
      if (product.stock && product.stock.pieces >= piecesPerBox) {
        const extraBoxes = Math.floor(product.stock.pieces / piecesPerBox);
        const remainingPieces = product.stock.pieces % piecesPerBox;
        const oldValue = `${product.stock.boxes} bx, ${product.stock.pieces} pc`;
        product.stock.boxes += extraBoxes;
        product.stock.pieces = remainingPieces;
        const newValue = `${product.stock.boxes} bx, ${product.stock.pieces} pc`;
        changes.push(`Stock: ${oldValue} → ${newValue}`);
        needsUpdate = true;
      }

      // Check sales
      if (product.sales && product.sales.pieces >= piecesPerBox) {
        const extraBoxes = Math.floor(product.sales.pieces / piecesPerBox);
        const remainingPieces = product.sales.pieces % piecesPerBox;
        const oldValue = `${product.sales.boxes} bx, ${product.sales.pieces} pc`;
        product.sales.boxes += extraBoxes;
        product.sales.pieces = remainingPieces;
        const newValue = `${product.sales.boxes} bx, ${product.sales.pieces} pc`;
        changes.push(`Sales: ${oldValue} → ${newValue}`);
        needsUpdate = true;
      }

      // Check damage
      if (product.damage && product.damage.pieces >= piecesPerBox) {
        const extraBoxes = Math.floor(product.damage.pieces / piecesPerBox);
        const remainingPieces = product.damage.pieces % piecesPerBox;
        const oldValue = `${product.damage.boxes} bx, ${product.damage.pieces} pc`;
        product.damage.boxes += extraBoxes;
        product.damage.pieces = remainingPieces;
        const newValue = `${product.damage.boxes} bx, ${product.damage.pieces} pc`;
        changes.push(`Damage: ${oldValue} → ${newValue}`);
        needsUpdate = true;
      }

      // Check returns
      if (product.returns && product.returns.pieces >= piecesPerBox) {
        const extraBoxes = Math.floor(product.returns.pieces / piecesPerBox);
        const remainingPieces = product.returns.pieces % piecesPerBox;
        const oldValue = `${product.returns.boxes} bx, ${product.returns.pieces} pc`;
        product.returns.boxes += extraBoxes;
        product.returns.pieces = remainingPieces;
        const newValue = `${product.returns.boxes} bx, ${product.returns.pieces} pc`;
        changes.push(`Returns: ${oldValue} → ${newValue}`);
        needsUpdate = true;
      }

      if (needsUpdate) {
        await product.save();
        fixedCount++;
        fixes.push({
          product: product.productName,
          id: product._id,
          changes
        });
        console.log(`✅ Fixed: ${product.productName}`);
        changes.forEach(change => console.log(`   - ${change}`));
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   Total products checked: ${products.length}`);
    console.log(`   Products fixed: ${fixedCount}`);
    
    if (fixedCount > 0) {
      console.log('\n🔧 Fixed Products:');
      fixes.forEach((fix, idx) => {
        console.log(`\n${idx + 1}. ${fix.product} (${fix.id})`);
        fix.changes.forEach(change => console.log(`   ${change}`));
      });
    }

    await mongoose.disconnect();
    console.log('\n✅ Script completed successfully');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

fixInvalidPieces();
