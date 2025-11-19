import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const existingUser = await User.findOne({ email: 'admin@hindmarble.com' });
    if (existingUser) {
      console.log('Admin user already exists');
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash('admin123', 10);
    const admin = new User({
      name: 'Admin User',
      email: 'admin@hindmarble.com',
      phone: '9876543210',
      passwordHash: hashedPassword,
      role: 'admin',
      isActive: true,
    });

    await admin.save();
    console.log('✅ Admin user created successfully');
    console.log('Email: admin@hindmarble.com');
    console.log('Password: admin123');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding admin:', err);
    process.exit(1);
  }
};

seedAdmin();
