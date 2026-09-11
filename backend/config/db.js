import mongoose from 'mongoose';

let isConnected = false;

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/safeher';

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000, // 10 second timeout for cloud Atlas connections
    });

    isConnected = true;
    console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return true;
  } catch (error) {
    isConnected = false;
    console.warn(`⚠️  MongoDB Connection Warning: ${error.message}`);
    console.warn(`👉 To use MongoDB, ensure mongod is running locally or set MONGODB_URI in environment variables.`);
    console.warn(`👉 The SafeHer backend server will continue running in in-memory fallback mode.`);
    return false;
  }
};

export const isDbConnected = () => isConnected;
