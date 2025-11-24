import mongoose from 'mongoose';
import logger from '../utils/logger.js';

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;

    // 💥 THÊM 2 DÒNG LOG TẠI ĐÂY
    console.log("👉 Loaded MONGO_URI =", process.env.MONGO_URI);
    console.log("👉 Type =", typeof process.env.MONGO_URI);

    if (!mongoURI) {
      throw new Error("❌ MONGO_URI is missing in .env");
    }

    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    const conn = await mongoose.connect(mongoURI, options);

    logger.info(`MongoDB Connected: ${conn.connection.host}`);
    logger.info(`Database: ${conn.connection.name}`);

    return conn;
  } catch (error) {
    logger.error("❌ Error connecting to MongoDB:", error);
    process.exit(1);
  }
};

export default connectDB;
