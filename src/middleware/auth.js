const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { error } = require('../helpers/response');

/**
 * Verifies the JWT Bearer token from the Authorization header.
 * Attaches the full user document (minus password) to req.user.
 * Rejects with 401 if the token is missing, invalid, or expired.
 */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return error(res, 'Authorization token is required', 401);
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return error(res, 'Token has expired', 401);
      }
      return error(res, 'Invalid token', 401);
    }

    const user = await User.findById(decoded.userId).select('-password -fcmToken -blockedUsers -refreshTokens -verificationToken -verificationTokenExpiresAt -passwordResetToken -passwordResetExpiresAt');
    if (!user) {
      return error(res, 'User not found', 401);
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Optionally verifies a JWT token. If present and valid, attaches req.user.
 * If absent or invalid, continues without setting req.user (no rejection).
 * Useful for endpoints that behave differently for authenticated users.
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return next();
    }

    const user = await User.findById(decoded.userId).select('-password -fcmToken -blockedUsers -refreshTokens -verificationToken -verificationTokenExpiresAt -passwordResetToken -passwordResetExpiresAt');
    if (user) {
      req.user = user;
    }
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { verifyToken, optionalAuth };
