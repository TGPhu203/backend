import { AppError } from './errorHandler.js';

/**
 * Middleware phân quyền
 * Ví dụ dùng:
 *   authorize("admin")
 *   authorize("admin", "manager")
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    // Chưa authenticate → lỗi
    if (!req.user) {
      return next(new AppError('Vui lòng đăng nhập để tiếp tục', 401));
    }

    // Kiểm tra role
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('Bạn không có quyền thực hiện hành động này', 403)
      );
    }

    next();
  };
};
