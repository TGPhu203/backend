// middlewares/validateRequest.js
import { validationResult } from "express-validator";
import { AppError } from "./errorHandler.js";

/**
 * 1) Validate bằng JOI schema (nếu schema được truyền vào)
 */
export const validateRequest = (schema, type = "body") => {
  return (req, res, next) => {
    if (!schema) return next();

    const data = type === "params" ? req.params : req.body;

    const { error } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const message = error.details.map((d) => d.message).join(", ");
      return next(new AppError(message, 400));
    }

    next();
  };
};

/**
 * 2) Validate bằng express-validator rules
 */
export const validateExpressValidator = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((error) => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
    }));

    console.log("🔍 Validation Errors:", formattedErrors);
    console.log("📝 Request Body:", req.body);

    return res.status(400).json({
      status: "fail",
      message: "Validation error",
      errors: formattedErrors,
    });
  }

  next();
};

/**
 * 3) Validate địa chỉ cho createOrder (CHUẨN THEO BACKEND)
 */
export const validateOrderAddress = (req, res, next) => {
  const { shippingAddress, billingAddress } = req.body;
  const errors = [];

  // --- Validate shipping ---
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

  // --- Validate billing ---
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

/**
 * 4) Dành cho express-validator
 */
export const validate = (rules) => {
  return [...rules, validateExpressValidator];
};
