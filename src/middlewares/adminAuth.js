import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { AppError } from './errorHandler.js';

export const adminAuthenticate = async (req, res, next) => {
  try {
    let token;

    // 1) Ưu tiên lấy token từ cookie (HttpOnly)
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    // 2) Fallback: nếu có Authorization: Bearer xxx thì dùng
    else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(
        new AppError('Cần token xác thực để truy cập admin panel', 401)
      );
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new AppError('Người dùng không tồn tại', 401));
    }

    // Check role
    if (!['admin', 'manager'].includes(user.role)) {
      return next(
        new AppError('Bạn không có quyền truy cập admin panel', 403)
      );
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('ADMIN AUTH ERROR:', error);

    if (
      error.name === 'JsonWebTokenError' ||
      error.name === 'TokenExpiredError'
    ) {
      return next(
        new AppError('Token không hợp lệ hoặc đã hết hạn', 401)
      );
    }

    next(error);
  }
};

export const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Vui lòng đăng nhập để tiếp tục', 401));
  }

  if (req.user.role !== 'admin') {
    return next(
      new AppError(
        'Chỉ Super Admin mới có thể thực hiện hành động này',
        403
      )
    );
  }

  next();
};
