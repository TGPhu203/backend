import Joi from 'joi';

// helper ObjectId schema
const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .message("ID không hợp lệ");

// Add to cart validation schema
export const addToCartSchema = Joi.object({
  productId: objectId.required(),
  variantId: objectId.allow(null).optional(),
  quantity: Joi.number().integer().min(1).default(1),
});

// Update cart item validation schema
export const updateCartItemSchema = Joi.object({
  quantity: Joi.number().integer().min(1).required(),
});

// Cart item schema for sync
const cartItemSchema = Joi.object({
  productId: objectId.required(),
  variantId: objectId.allow(null).optional(),
  quantity: Joi.number().integer().min(1).required(),
  name: Joi.string().optional(),
  price: Joi.number().optional(),
  image: Joi.string().optional(),
  attributes: Joi.object().optional(),
});

// Sync cart validation schema
export const syncCartSchema = Joi.object({
  items: Joi.array().items(cartItemSchema).required(),
});
export const applyCouponSchema = Joi.object({
  code: Joi.string().trim().required().messages({
    'string.empty': 'Vui lòng nhập mã khuyến mãi',
    'any.required': 'Mã khuyến mãi là bắt buộc',
  }),
});