import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { AppError } from './errorHandler.js';

/**
 * Middleware xác thực dành riêng cho admin
 */
export const adminAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('Cần token xác thực để truy cập admin panel', 401));
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user (MONGOOSE)
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new AppError('Người dùng không tồn tại', 401));
    }

    // Check role
    if (!['admin', 'manager'].includes(user.role)) {
      return next(new AppError('Bạn không có quyền truy cập admin panel', 403));
    }
/*
    // Check verified email (nếu cần)
    if (!user.isEmailVerified) {
      return next(new AppError('Vui lòng xác thực email trước khi truy cập admin panel', 401));
    }
*/
    req.user = user;
    next();
  } catch (error) {
    console.error("ADMIN AUTH ERROR:", error);

    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new AppError('Token không hợp lệ hoặc đã hết hạn', 401));
    }

    next(error);
  }
};

/**
 * Middleware yêu cầu quyền admin cao nhất
 */
export const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Vui lòng đăng nhập để tiếp tục', 401));
  }

  if (req.user.role !== 'admin') {
    return next(new AppError('Chỉ Super Admin mới có thể thực hiện hành động này', 403));
  }

  next();
};
