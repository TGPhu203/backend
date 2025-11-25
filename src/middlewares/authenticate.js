import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
import { AppError } from "./errorHandler.js";

export const authenticate = async (req, res, next) => {
  try {
    let token = null;

    // 1) Ưu tiên lấy token từ Cookie (FE đang dùng credentials: include)
    if (req.cookies?.token) {
      token = req.cookies.token;
    }

    // 2) Nếu không có → thử lấy từ header Authorization
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      }
    }

    // 3) Nếu vẫn không có token → báo lỗi
    if (!token) {
      return next(new AppError("Vui lòng đăng nhập để tiếp tục", 401));
    }

    // 4) Decode token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 5) Lấy user
    const user = await User.findById(decoded.id);
    if (!user) return next(new AppError("Người dùng không tồn tại", 401));

    if (!user.isActive)
      return next(new AppError("Tài khoản bị khóa", 401));

    // 6) Gắn user vào req
    req.user = user;
    next();
  } catch (error) {
    return next(new AppError("Token không hợp lệ hoặc đã hết hạn", 401));
  }
};

export const optionalAuthenticate = async (req, res, next) => {
  try {
    let token = req.cookies?.token;

    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      }
    }

    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return next();

    req.user = user;
    next();
  } catch {
    return next();
  }
};
