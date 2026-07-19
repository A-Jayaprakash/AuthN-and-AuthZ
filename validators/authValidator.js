const Joi = require('joi');
const addressSchema = require('../validators/addressValidator');

const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).required(),
  email: Joi.string().trim().email().required(),
  password: Joi.string().min(8).required(),
  address: addressSchema.optional()
});

const loginSchema = Joi.object({
  email: Joi.string().trim().email().required(),
  password: Joi.string().required()
});

module.exports = { registerSchema, loginSchema };