import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const ADMIN_EMAIL = 'admin@heliotrope.com';
const ADMIN_PASSWORD = 'AdminHeliotrope@123';
const ADMIN_NAME = 'Admin';

async function createAdminUser() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/heliotrope';
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('✓ Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: ADMIN_EMAIL });
    if (existingAdmin) {
      console.log('✗ Admin user already exists!');
      console.log(`Email: ${ADMIN_EMAIL}`);
      if (existingAdmin.role === 'admin') {
        console.log('Role: admin');
      }
      await mongoose.connection.close();
      return;
    }

    // Create admin user
    // DO NOT hash manually - the User model's pre-save hook will hash it
    const adminUser = await User.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD, // Pass plain password, model will hash it
      role: 'admin',
      isEmailVerified: true, // Admin doesn't need email verification
      phone: '+1234567890',
      isVerifiedSeller: false,
    });

    console.log('✓ Admin user created successfully!');
    console.log('\n📧 Admin Credentials:');
    console.log(`   Email:    ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log('\n📍 Login Instructions:');
    console.log('   1. Go to the Auth page');
    console.log('   2. Click "Login"');
    console.log('   3. Enter the email and password above');
    console.log('   4. You will be redirected to /admin/dashboard');

    await mongoose.connection.close();
  } catch (error) {
    console.error('✗ Error creating admin user:', error.message);
    process.exit(1);
  }
}

createAdminUser();
