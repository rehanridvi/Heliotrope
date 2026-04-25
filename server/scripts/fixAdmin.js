import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

async function deleteAndRecreateAdmin() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/heliotrope';
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('✓ Connected to MongoDB');

    // Delete existing admin
    const result = await User.deleteOne({ email: 'admin@heliotrope.com' });
    console.log(`✓ Deleted ${result.deletedCount} existing admin user(s)`);

    // Create new admin with correct password
    const adminUser = await User.create({
      name: 'Admin',
      email: 'admin@heliotrope.com',
      password: 'AdminHeliotrope@123', // Plain password - model will hash it
      role: 'admin',
      isEmailVerified: true,
      phone: '+1234567890',
      isVerifiedSeller: false,
    });

    console.log('✓ Admin user created successfully with correct password!');
    console.log('\n📧 Admin Credentials:');
    console.log(`   Email:    admin@heliotrope.com`);
    console.log(`   Password: AdminHeliotrope@123`);

    await mongoose.connection.close();
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
}

deleteAndRecreateAdmin();
