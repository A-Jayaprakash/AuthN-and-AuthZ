const Joi = require('joi');
const addressSchema = require('../validators/addressValidator');

const updateUserSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50),  
  address: addressSchema
});

module.exports = updateUserSchema;