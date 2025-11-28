// validators/coupon.validator.js
import Joi from "joi";

export const createCouponSchema = Joi.object({
  code: Joi.string().trim().uppercase().required().messages({
    "string.empty": "Mã ưu đãi không được để trống",
    "any.required": "Mã ưu đãi là bắt buộc",
  }),
  type: Joi.string().valid("percent", "fixed").required().messages({
    "any.only": "Loại ưu đãi phải là percent hoặc fixed",
  }),
  value: Joi.number().min(0).required().messages({
    "number.base": "Giá trị ưu đãi phải là số",
    "number.min": "Giá trị ưu đãi không được âm",
  }),
  minOrderAmount: Joi.number().min(0).default(0),
  maxDiscount: Joi.number().min(0).default(0),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  usageLimit: Joi.number().integer().min(0).default(0),
  isActive: Joi.boolean().default(true),
  applicableTiers: Joi.array()
    .items(Joi.string().valid("none", "silver", "gold", "diamond"))
    .default([]),
  description: Joi.string().allow("").optional(),
});

export const updateCouponSchema = Joi.object({
  code: Joi.string().trim().uppercase().optional(),
  type: Joi.string().valid("percent", "fixed").optional(),
  value: Joi.number().min(0).optional(),
  minOrderAmount: Joi.number().min(0).optional(),
  maxDiscount: Joi.number().min(0).optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  usageLimit: Joi.number().integer().min(0).optional(),
  isActive: Joi.boolean().optional(),
  applicableTiers: Joi.array().items(
    Joi.string().valid("none", "silver", "gold", "diamond")
  ),
  description: Joi.string().allow("").optional(),
});
