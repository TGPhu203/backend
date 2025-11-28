// validators/product.validator.js
import Joi from "joi";

// Mongo ObjectId
const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .message("ID không hợp lệ (phải là ObjectId 24 ký tự)");

// Schema CREATE (tạo mới)
export const productSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    "string.empty": "Tên sản phẩm không được để trống",
    "any.required": "Tên sản phẩm là trường bắt buộc",
  }),

  description: Joi.string().required().messages({
    "string.empty": "Mô tả không được để trống",
    "any.required": "Mô tả là trường bắt buộc",
  }),

  shortDescription: Joi.string().required().messages({
    "string.empty": "Mô tả ngắn không được để trống",
    "any.required": "Mô tả ngắn là trường bắt buộc",
  }),

  price: Joi.number().min(0).required().messages({
    "number.base": "Giá phải là số",
    "number.min": "Giá không được nhỏ hơn 0",
    "any.required": "Giá là trường bắt buộc",
  }),

  compareAtPrice: Joi.number().min(0).allow(null).optional(),

  images: Joi.array().items(Joi.string()).default([]),
  thumbnail: Joi.string().allow("").optional(),

  // TRÙNG VỚI FRONTEND: gửi categories: [selectedCategory]
  categories: Joi.array().items(objectId).min(1).required().messages({
    "array.min": "Phải chọn ít nhất một danh mục",
    "any.required": "Danh mục là trường bắt buộc",
  }),

  inStock: Joi.boolean().default(true),
  stockQuantity: Joi.number().integer().min(0).default(0),

  featured: Joi.boolean().default(false),

  status: Joi.string()
    .valid("active", "inactive")
    .default("active"),

  searchKeywords: Joi.array().items(Joi.string()).default([]),

  seoTitle: Joi.string().allow("").optional(),
  seoDescription: Joi.string().allow("").optional(),
  seoKeywords: Joi.array().items(Joi.string()).default([]),

  brand: Joi.string().allow("").optional(),
  model: Joi.string().allow("").optional(),
  condition: Joi.string()
    .valid("new", "like-new", "used", "refurbished")
    .default("new"),
  warrantyMonths: Joi.number().integer().min(0).max(120).default(12),
  specifications: Joi.object().default({}),

  attributes: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        values: Joi.array().items(Joi.string()).required(),
      })
    )
    .optional(),

  variants: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        sku: Joi.string().allow("").optional(),
        attributes: Joi.object().pattern(Joi.string(), Joi.string()).required(),
        price: Joi.number().min(0).required(),
        stockQuantity: Joi.number().integer().min(0).default(0),
        images: Joi.array().items(Joi.string()).default([]),
        displayName: Joi.string().allow("").optional(),
        sortOrder: Joi.number().integer().min(0).default(0),
        isDefault: Joi.boolean().default(false),
        isAvailable: Joi.boolean().default(true),
      })
    )
    .optional(),

  warrantyPackageIds: Joi.array().items(objectId).optional(),
});

// Schema UPDATE: cho phép gửi thiếu field, dùng để PUT
export const productUpdateSchema = productSchema.fork(
  [
    "name",
    "description",
    "shortDescription",
    "price",
    "categories",
  ],
  (schema) => schema.optional()
);
