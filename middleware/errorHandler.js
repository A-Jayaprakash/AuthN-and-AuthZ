const logger = require('../utils/logger');
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Mongoose validation errors (e.g. required field missing)
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map(val => val.message).join(', ');
  }

  // MongoDB duplicate key error (unique constraint violation)
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message = `${field} already exists`;
  }

  // Mongoose invalid ObjectId (e.g. malformed :id in route params)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // If any other unexpected error occurs, we don't want to expose internal details to the client. Instead, we send a generic message.
  if(err.isOperational){
    logger.warn(err.message, {statusCode: err.statusCode});
  }
  
  else{
    logger.error(err.message, {stack: err.stack, statusCode: err.statusCode});
  }

  res.status(statusCode).json({
    success: false,
    message
  });
};

module.exports = errorHandler;