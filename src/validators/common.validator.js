import Joi from "joi";

// ObjectId validator
export const objectIdParam = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .message("ID không hợp lệ")
    .required(),
});
