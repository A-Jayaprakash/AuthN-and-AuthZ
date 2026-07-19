const Joi = require('joi');

const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).message('Invalid product ID format');

const addItemSchema = Joi.object({
  productId: objectId.required(),
  quantity: Joi.number().integer().min(1).required()
});

const updateItemSchema = Joi.object({
  productId: objectId.required(),
  quantity: Joi.number().integer().min(1).required()
});

module.exports = { addItemSchema, updateItemSchema };