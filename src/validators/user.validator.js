// validators/user.validator.js
import Joi from "joi";

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  phone: Joi.string().allow("").optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(6).required(),
  confirmPassword: Joi.string()
    .valid(Joi.ref("password"))
    .required()
    .messages({ "any.only": "Mật khẩu xác nhận không khớp" }),
});

const emailSchema = Joi.object({
  email: Joi.string().email().required(),
});

const verifyEmailSchema = Joi.object({
  token: Joi.string().required(),
});

export {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  emailSchema,
  verifyEmailSchema,
};
