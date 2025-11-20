import User from '../src/models/User.js';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const seedCustomerUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    console.log('🔄 Creating customer users...\n');

    // User 1: Wasim (8581808501) - Full Access
    const wasimExists = await User.findOne({ phone: '8581808501' });
    let wasimUser;
    
    if (wasimExists) {
      console.log('ℹ️  Wasim user already exists, updating...');
      wasimUser = wasimExists;
    } else {
      const hashedPassword = await bcrypt.hash('wasim8581', 10);
      wasimUser = new User({
        name: 'Wasim',
        phone: '8581808501',
        email: 'wasim@hindmarble.com',
        passwordHash: hashedPassword,
        role: 'staff',
        permissions: {
          canViewStock: true,
          canViewSales: true,
          canViewCustomers: true,
          canViewReports: true,
          canViewPayments: true,
        },
        isActive: true,
      });
      await wasimUser.save();
    }

    // User 2: Nawab - Stock Only Access
    const nawabExists = await User.findOne({ email: 'nawab@hindmarble.com' });
    let nawabUser;
    
    if (nawabExists) {
      console.log('ℹ️  Nawab user already exists, updating...');
      nawabUser = nawabExists;
    } else {
      const hashedPassword = await bcrypt.hash('htm-nawab', 10);
      nawabUser = new User({
        name: 'Nawab',
        email: 'nawab@hindmarble.com',
        phone: '9999999999',
        passwordHash: hashedPassword,
        role: 'stock-viewer',
        permissions: {
          canViewStock: true,
          canViewSales: false,
          canViewCustomers: false,
          canViewReports: false,
          canViewPayments: false,
        },
        isActive: true,
      });
      await nawabUser.save();
    }

    console.log('\n✅ Customer users created/updated successfully!\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('\n📱 USER 1: WASIM (Full Access - All Sections)');
    console.log('───────────────────────────────────────────────────────');
    console.log('Username/Phone: 8581808501');
    console.log('Email: wasim@hindmarble.com');
    console.log('Password: wasim8581');
    console.log('Access: Stock, Sales, Customers, Payments, Reports');
    
    console.log('\n👤 USER 2: NAWAB (Stock Only Access)');
    console.log('───────────────────────────────────────────────────────');
    console.log('Username/Email: nawab@hindmarble.com');
    console.log('Phone: 9999999999');
    console.log('Password: htm-nawab');
    console.log('Access: Stock section ONLY');
    
    console.log('\n═══════════════════════════════════════════════════════\n');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding customer users:', err);
    process.exit(1);
  }
};

seedCustomerUsers();
