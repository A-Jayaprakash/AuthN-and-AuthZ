const Joi = require('joi');

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).message('Invalid category ID format');

const createProductSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  description: Joi.string().trim().max(1000).allow('', null),
  price: Joi.number().positive().required(),
  stock: Joi.number().integer().min(0).required(),
  category: objectId.required(),
  images: Joi.array().items(Joi.string().uri()).optional()
});

const updateProductSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  description: Joi.string().trim().max(1000).allow('', null),
  price: Joi.number().positive(),
  stock: Joi.number().integer().min(0),
  category: objectId,
  images: Joi.array().items(Joi.string().uri())
});

module.exports = { createProductSchema, updateProductSchema };