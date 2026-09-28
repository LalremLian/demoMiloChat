const jwt = require('jsonwebtoken');
const url = require('url');
const User = require('../models/User');

/**
 * Authenticates an incoming WebSocket upgrade request.
 *
 * Token is accepted from either:
 *   1. Query parameter:  ws://host/ws?token=<jwt>
 *   2. Authorization header: Bearer <jwt>  (useful for native clients)
 *
 * Returns the authenticated User document on success.
 * Throws an error with a descriptive message on failure — the caller
 * is responsible for rejecting the socket with the appropriate HTTP status.
 *
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<import('../models/User')>}
 */
const authenticateWsConnection = async (req) => {
  // Extract token from query string or Authorization header
  const parsedUrl = url.parse(req.url, true);
  const queryToken = parsedUrl.query.token;
  const headerToken =
    req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : null;

  const token = queryToken || headerToken;

  if (!token) {
    const err = new Error('Authentication token is required');
    err.statusCode = 401;
    throw err;
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (jwtErr) {
    const err = new Error(
      jwtErr.name === 'TokenExpiredError' ? 'Token has expired' : 'Invalid token'
    );
    err.statusCode = 401;
    throw err;
  }

  const user = await User.findById(decoded.userId).select(
    'username displayName avatarUrl isOnline'
  );

  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 401;
    throw err;
  }

  return user;
};

module.exports = { authenticateWsConnection };
