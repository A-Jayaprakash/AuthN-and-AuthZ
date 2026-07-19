const Joi = require('joi');
const addressSchema = require('../validators/addressValidator');

const createOrderSchema = Joi.object({
  shippingAddress: addressSchema.optional()
});

const updateOrderStatusSchema = Joi.object({
  status: Joi.string()
    .valid('pending', 'processing', 'shipped', 'delivered', 'cancelled')
    .required()
});

const updateOrderAddressSchema = Joi.object({
  shippingAddress: addressSchema.required()
});

module.exports = { createOrderSchema, updateOrderStatusSchema, updateOrderAddressSchema };