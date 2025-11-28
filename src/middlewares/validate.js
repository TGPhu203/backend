// middlewares/validate.js
import { AppError } from "./errorHandler.js";

/**
 * Middleware validate body bằng Joi schema
 * Dùng: router.post("/", validate(productSchema), controller.createProduct)
 */
export const validate = (schema) => {
  return (req, res, next) => {
    if (!schema || typeof schema.validate !== "function") {
      // Nếu truyền nhầm không phải Joi schema thì bỏ qua, tránh lỗi .validate is not a function
      return next();
    }

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path[0],
        message: detail.message,
      }));

      return next(new AppError("Validation error", 400, { errors }));
    }

    // gán lại body đã stripUnknown / apply default
    req.body = value;
    next();
  };
};
