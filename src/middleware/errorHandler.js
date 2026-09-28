const mongoose = require('mongoose');

/**
 * Centralized Express error handler.
 * Must be mounted LAST — after all routes.
 *
 * Handles:
 *  - Mongoose ValidationError    → 400
 *  - Mongoose duplicate key      → 409 with the conflicting field
 *  - JWT TokenExpiredError       → 401
 *  - JWT JsonWebTokenError       → 401
 *  - Everything else             → 500 (stack only in development)
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const isDev = process.env.NODE_ENV === 'development';

  // Mongoose field-level validation errors
  if (err instanceof mongoose.Error.ValidationError) {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: messages.join(', '),
      code: 400,
    });
  }

  // Mongoose duplicate key (e.g. unique email/username)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      message: `${field} is already taken`,
      code: 409,
    });
  }

  // JWT token expired
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token has expired',
      code: 401,
    });
  }

  // JWT invalid token
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
      code: 401,
    });
  }

  // Mongoose CastError (invalid ObjectId in params)
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({
      success: false,
      message: `Invalid value for field: ${err.path}`,
      code: 400,
    });
  }

  // Multer file size limit
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: `File exceeds the maximum allowed size of ${process.env.MAX_FILE_SIZE_MB || 10} MB`,
      code: 400,
    });
  }

  // Known operational errors propagated with a status code
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.statusCode,
    });
  }

  // Fallback — unexpected server error
  console.error('[ErrorHandler]', err);

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
    code: 500,
    ...(isDev && { stack: err.stack }),
  });
};

module.exports = errorHandler;
