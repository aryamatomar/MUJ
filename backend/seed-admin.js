import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './models/User.js';

dotenv.config();

const seedAdmin = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/safeher';
  const adminUsername = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@safeher.internal').trim().toLowerCase();
  const adminName = process.env.ADMIN_NAME || 'SafeHer Administrator';

  console.log('🚀 Connecting to database to seed admin user...');
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log('✅ Connected to MongoDB.');

    // Check if admin user already exists
    let existingAdmin = await User.findOne({
      $or: [{ username: adminUsername }, { email: adminEmail }],
    });

    if (existingAdmin) {
      console.log(`ℹ️  Admin user already exists: ${existingAdmin.username} (${existingAdmin.email}) with role: ${existingAdmin.role}`);
      if (existingAdmin.role !== 'ADMIN') {
        existingAdmin.role = 'ADMIN';
        await existingAdmin.save();
        console.log(`🛡️  Elevated user "${existingAdmin.username}" to role ADMIN.`);
      }
    } else {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(adminPassword, salt);

      const newAdmin = await User.create({
        name: adminName,
        username: adminUsername,
        email: adminEmail,
        passwordHash,
        role: 'ADMIN',
        deviceId: 'SAFEHER-ADMIN-01',
      });

      console.log(`
🎉 Admin user seeded successfully!
=============================================
Username: ${newAdmin.username}
Role:     ${newAdmin.role}
Email:    ${newAdmin.email}
Password: (as configured in ADMIN_PASSWORD / default)
=============================================
      `);
    }

    await mongoose.disconnect();
    console.log('🔌 Database disconnected.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed admin:', error.message);
    process.exit(1);
  }
};

seedAdmin();
