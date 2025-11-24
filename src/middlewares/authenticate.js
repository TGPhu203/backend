import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { AppError } from './errorHandler.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(new AppError("Vui lòng đăng nhập để tiếp tục", 401));
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id); // <<< FIX
    if (!user) return next(new AppError("Người dùng không tồn tại", 401));

    if (!user.isActive)
      return next(new AppError("Tài khoản bị khoá", 401));
/*
    if (!user.isEmailVerified)
      return next(new AppError("Vui lòng xác thực email để tiếp tục", 401));
*/
    req.user = user;
    next();
  } catch (error) {
    return next(new AppError("Token hết hạn hoặc không hợp lệ", 401));
  }
};

export const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id); // <<< FIX
    if (!user) return next();

    req.user = user;
    next();
  } catch {
    return next();
  }
};
