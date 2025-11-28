import Joi from 'joi';

const objectIdPattern = /^[0-9a-fA-F]{24}$/; // Mongo ObjectId

// Create/Update category validation schema
export const categorySchema = Joi.object({
  name: Joi.string().trim().required().messages({
    'string.empty': 'Tên danh mục không được để trống',
    'any.required': 'Tên danh mục là trường bắt buộc',
  }),

  description: Joi.string().allow('').optional(),
  image: Joi.string().allow('').optional(),

  // DÙNG ObjectId, KHÔNG dùng uuid
  parentId: Joi.string()
    .pattern(objectIdPattern)
    .allow(null, '')        // cho phép null hoặc chuỗi rỗng (khi không chọn)
    .optional(),

  isActive: Joi.boolean().default(true),

  // Nếu backend đang dùng displayOrder (theo controller mới)
  displayOrder: Joi.number().integer().default(0),

  // Nếu vẫn còn chỗ dùng sortOrder thì giữ thêm (tuỳ bạn)
  sortOrder: Joi.number().integer().optional(),
});
