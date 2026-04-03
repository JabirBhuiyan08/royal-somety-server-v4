// server/config/db.js
import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/khanbari-somity');
    console.log(`✅ MongoDB সংযুক্ত: ${conn.connection.host}`);
  } catch (err) {
    console.error('❌ MongoDB সংযোগ ব্যর্থ:', err.message);
    process.exit(1);
  }
};
