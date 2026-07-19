const Joi = require('joi');

const addressSchema = Joi.object({
        street: Joi.string().trim().allow('', null),
        city: Joi.string().trim().allow('', null),
        state: Joi.string().trim().allow('', null),
        zip: Joi.string().trim().allow('', null),
        country: Joi.string().trim().allow('', null)
      });

module.exports = addressSchema;