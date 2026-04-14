const { NODE_ENV } = require('../config/env');

function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Internal server error';

  const response = {
    success: false,
    message,
  };

  if (NODE_ENV === 'development' && !err.isOperational) {
    response.stack = err.stack;
  }

  if (NODE_ENV === 'development') {
    console.error(err);
  }

  res.status(statusCode).json(response);
}

module.exports = errorHandler;
