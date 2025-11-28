// middlewares/validateRequest.js
import { validationResult } from "express-validator";
import { AppError } from "./errorHandler.js";

/**
 * validateRequest:
 * - Nếu truyền vào Joi schema (có hàm .validate)  -> validate bằng Joi
 * - Nếu truyền vào mảng / function express-validator -> chạy rules + check validationResult
 * - Nếu không truyền gì hợp lệ -> next()
 */
export const validateRequest = (schemaOrRules, type = "body") => {
  // ===== Trường hợp Joi schema =====
  if (schemaOrRules && typeof schemaOrRules.validate === "function") {
    return (req, res, next) => {
      const data = type === "params" ? req.params : req.body;

      const { value, error } = schemaOrRules.validate(data, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        const message = error.details.map((d) => d.message).join(", ");
        return next(new AppError(message, 400));
      }

      // Gắn lại data đã stripUnknown
      if (type === "params") {
        req.params = value;
      } else {
        req.body = value;
      }

      next();
    };
  }

  // ===== Trường hợp express-validator rules =====
  if (Array.isArray(schemaOrRules) || typeof schemaOrRules === "function") {
    const rules = Array.isArray(schemaOrRules)
      ? schemaOrRules
      : [schemaOrRules];

    // Trả về 1 mảng middleware: [...rules, check lỗi]
    return [
      ...rules,
      (req, res, next) => {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
          const formattedErrors = errors.array().map((error) => ({
            field: error.path || error.param,
            message: error.msg,
            value: error.value,
          }));

          return res.status(400).json({
            status: "fail",
            message: "Validation error",
            errors: formattedErrors,
          });
        }

        next();
      },
    ];
  }

  // ===== Không có schema hoặc loại không hỗ trợ =====
  return (req, res, next) => next();
};

// Giữ nguyên nếu bạn đang dùng ở chỗ khác
export const validateExpressValidator = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((error) => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
    }));

    return res.status(400).json({
      status: "fail",
      message: "Validation error",
      errors: formattedErrors,
    });
  }

  next();
};

export const validateOrderAddress = (req, res, next) => {
  const { shippingAddress, billingAddress } = req.body;
  const errors = [];

  if (!shippingAddress) {
    errors.push("Thiếu thông tin giao hàng");
  } else {
    if (!shippingAddress.fullName) errors.push("Tên người nhận là trường bắt buộc");
    if (!shippingAddress.addressLine1) errors.push("Địa chỉ giao hàng là trường bắt buộc");
    if (!shippingAddress.city) errors.push("Thành phố giao hàng là trường bắt buộc");
    if (!shippingAddress.state) errors.push("Tỉnh/Thành phố giao hàng là trường bắt buộc");
    if (!shippingAddress.postalCode) errors.push("Mã bưu điện giao hàng là trường bắt buộc");
    if (!shippingAddress.country) errors.push("Quốc gia giao hàng là trường bắt buộc");
    if (!shippingAddress.phone) errors.push("Số điện thoại giao hàng là trường bắt buộc");
  }

  if (!billingAddress) {
    errors.push("Thiếu thông tin thanh toán");
  } else {
    if (!billingAddress.fullName) errors.push("Tên người thanh toán là trường bắt buộc");
    if (!billingAddress.addressLine1) errors.push("Địa chỉ thanh toán là trường bắt buộc");
    if (!billingAddress.city) errors.push("Thành phố thanh toán là trường bắt buộc");
    if (!billingAddress.state) errors.push("Tỉnh/Thành phố thanh toán là trường bắt buộc");
    if (!billingAddress.postalCode) errors.push("Mã bưu điện thanh toán là trường bắt buộc");
    if (!billingAddress.country) errors.push("Quốc gia thanh toán là trường bắt buộc");
    if (!billingAddress.phone) errors.push("Số điện thoại thanh toán là trường bắt buộc");
  }

  if (errors.length > 0) {
    return next(new AppError(errors.join(", "), 400));
  }

  next();
};

// Helper cho express-validator nếu bạn vẫn muốn dùng kiểu cũ
export const validate = (rules) => {
  return [...rules, validateExpressValidator];
};
