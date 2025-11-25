// validators/review.validator.js
import Joi from "joi";

// Schema ObjectId dùng lại cho nhiều chỗ nếu cần
const objectIdSchema = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .required()
  .messages({
    "string.pattern.base": "ID sản phẩm không hợp lệ",
    "any.required": "ID sản phẩm là trường bắt buộc",
  });

// Review validation schema
export const reviewSchema = Joi.object({
  productId: objectIdSchema, // 👈 dùng ObjectId, KHÔNG dùng uuid nữa

  rating: Joi.number().integer().min(1).max(5).required().messages({
    "number.base": "Đánh giá phải là số",
    "number.integer": "Đánh giá phải là số nguyên",
    "number.min": "Đánh giá phải từ 1 đến 5",
    "number.max": "Đánh giá phải từ 1 đến 5",
    "any.required": "Đánh giá là trường bắt buộc",
  }),

  // Cho phép tiêu đề rỗng hoặc không gửi (đúng với UI hiện tại)
  title: Joi.string().allow("", null).messages({
    "string.base": "Tiêu đề không hợp lệ",
  }),

  comment: Joi.string().min(1).required().messages({
    "string.empty": "Nội dung đánh giá không được để trống",
    "any.required": "Nội dung đánh giá là trường bắt buộc",
  }),

  // Cho phép mảng ảnh là path string, không bắt buộc phải là URL đầy đủ
  images: Joi.array().items(Joi.string()).optional(),
});

// Review helpful validation schema
export const reviewHelpfulSchema = Joi.object({
  helpful: Joi.boolean().required().messages({
    "boolean.base": "Giá trị helpful phải là boolean",
    "any.required": "Giá trị helpful là trường bắt buộc",
  }),
});
