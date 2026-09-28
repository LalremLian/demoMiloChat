const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');

/**
 * Generates a signed JWT access token (15 min TTL).
 * Token payload carries only the userId — never log the token itself.
 */
const generateAccessToken = (userId) => {
  return jwt.sign(
    { userId: userId.toString() },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
};

/**
 * Generates a signed JWT refresh token (30 day TTL).
 */
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId: userId.toString() },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );
};

/**
 * Generates a cryptographically random URL-safe token
 * for email verification / password reset flows.
 */
const generateSecureToken = () => crypto.randomBytes(32).toString('hex');

/**
 * Verifies a refresh token and returns the decoded payload.
 * Throws a JWT error if invalid or expired.
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

/**
 * Issues a new access + refresh token pair.
 * Saves the new refresh token on the user document (supports multiple devices).
 * Rotates: removes the old refresh token if provided.
 *
 * @param {import('../models/User')} user   - Mongoose User document
 * @param {string|null} oldRefreshToken     - Token to rotate out (optional)
 * @returns {{ accessToken: string, refreshToken: string }}
 */
const issueTokenPair = async (user, oldRefreshToken = null) => {
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  // Load current refresh tokens (field is select:false so we may need to reload)
  const freshUser = await User.findById(user._id).select('refreshTokens');
  let tokens = freshUser.refreshTokens || [];

  // Rotate out the old token if provided
  if (oldRefreshToken) {
    tokens = tokens.filter((t) => t !== oldRefreshToken);
  }

  // Cap stored tokens per user to avoid unbounded growth (max 10 devices)
  if (tokens.length >= 10) {
    tokens = tokens.slice(tokens.length - 9);
  }

  tokens.push(refreshToken);

  await User.findByIdAndUpdate(user._id, { refreshTokens: tokens });

  return { accessToken, refreshToken };
};

/**
 * Invalidates a specific refresh token (logout from one device).
 * If no token provided, clears ALL refresh tokens (logout from all devices).
 */
const revokeRefreshToken = async (userId, refreshToken = null) => {
  if (refreshToken) {
    await User.findByIdAndUpdate(userId, {
      $pull: { refreshTokens: refreshToken },
    });
  } else {
    await User.findByIdAndUpdate(userId, { refreshTokens: [] });
  }
};

/**
 * Validates a refresh token:
 *  1. Verifies the JWT signature / expiry.
 *  2. Confirms it exists in the user's stored list (prevents replay after logout).
 *
 * Returns the User document on success, throws on failure.
 */
const validateRefreshToken = async (token) => {
  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    const err = new Error('Invalid or expired refresh token');
    err.statusCode = 401;
    throw err;
  }

  const user = await User.findById(decoded.userId).select('refreshTokens email username displayName avatarUrl isOnline');
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 401;
    throw err;
  }

  if (!user.refreshTokens.includes(token)) {
    // Token was already used or revoked — clear all tokens (possible token theft)
    await User.findByIdAndUpdate(user._id, { refreshTokens: [] });
    const err = new Error('Refresh token reuse detected. Please log in again.');
    err.statusCode = 401;
    throw err;
  }

  return user;
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateSecureToken,
  verifyRefreshToken,
  issueTokenPair,
  revokeRefreshToken,
  validateRefreshToken,
};
