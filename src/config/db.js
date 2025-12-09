// src/config/db.js (hoặc file connectDB bạn đang dùng)
import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log("===== MongoDB Connected =====");
    console.log("Host     :", conn.connection.host);
    console.log("Database :", conn.connection.name);
    console.log("URI      :", process.env.MONGO_URI);
    console.log("================================");

    console.log("liên kết thành công!");
  } catch (error) {
    console.error("Lỗi khi kết nối CSDL:", error);
    process.exit(1);
  }
};

export default connectDB;
