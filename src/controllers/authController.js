const { validationResult } = require('express-validator');
const crypto = require('crypto');
const User = require('../models/User');
const { success, error } = require('../helpers/response');
const {
  issueTokenPair,
  validateRefreshToken,
  revokeRefreshToken,
  generateSecureToken,
} = require('../services/authService');

/** Helper — returns first validation error or null */
const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    error(res, errors.array()[0].msg, 400);
    return false;
  }
  return true;
};

/** Returns the access token TTL in seconds (parsed from JWT_EXPIRES_IN env var) */
const getExpiresIn = () => {
  const raw = process.env.JWT_EXPIRES_IN || '15m';
  const match = raw.match(/^(\d+)(m|h|d|s)?$/);
  if (!match) return 900;
  const n = parseInt(match[1], 10);
  const unit = match[2] || 's';
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return n * (multipliers[unit] || 1);
};

// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    if (!validate(req, res)) return;

    const { email, password, displayName, username } = req.body;

    const existing = await User.findOne({ $or: [{ email }, { username }] }).select('_id email username');
    if (existing) {
      const field = existing.email === email ? 'email' : 'username';
      return error(res, `${field} is already taken`, 409);
    }

    const verificationToken = generateSecureToken();
    const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const user = await User.create({
      email,
      password,
      displayName,
      username,
      verificationToken,
      verificationTokenExpiresAt,
    });

    const { accessToken, refreshToken } = await issueTokenPair(user);

    return success(
      res,
      {
        user: {
          id: user._id.toString(),
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          bio: user.bio || '',
          avatarUrl: user.avatarUrl || '',
          isOnline: user.isOnline,
          lastSeenAt: user.lastSeenAt ? user.lastSeenAt.getTime() : null,
          isVerified: user.isVerified,
          createdAt: user.createdAt.getTime(),
        },
        accessToken,
        refreshToken,
        expiresIn: getExpiresIn(),
        verificationToken: process.env.NODE_ENV === 'development' ? verificationToken : undefined,
      },
      201
    );
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    if (!validate(req, res)) return;

    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password +refreshTokens');
    if (!user) {
      return error(res, 'Invalid email or password', 401);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return error(res, 'Invalid email or password', 401);
    }

    const { accessToken, refreshToken } = await issueTokenPair(user);

    return success(res, {
      user: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        bio: user.bio || '',
        avatarUrl: user.avatarUrl || '',
        isOnline: user.isOnline,
        lastSeenAt: user.lastSeenAt ? user.lastSeenAt.getTime() : null,
        isVerified: user.isVerified,
        createdAt: user.createdAt.getTime(),
      },
      accessToken,
      refreshToken,
      expiresIn: getExpiresIn(),
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/refresh
const refreshToken = async (req, res, next) => {
  try {
    if (!validate(req, res)) return;

    const { refreshToken: token } = req.body;

    const user = await validateRefreshToken(token);
    const { accessToken, refreshToken: newRefreshToken } = await issueTokenPair(user, token);

    return success(res, {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: getExpiresIn(),
    });
  } catch (err) {
    if (err.statusCode) {
      return error(res, err.message, err.statusCode);
    }
    next(err);
  }
};

// POST /api/auth/logout
const logout = async (req, res, next) => {
  try {
    if (!validate(req, res)) return;

    const { userId } = req.body;
    const token = req.body.refreshToken || null;

    await revokeRefreshToken(userId, token);

    return success(res, {});
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res, next) => {
  try {
    if (!validate(req, res)) return;

    const { email } = req.body;

    const user = await User.findOne({ email });

    // Always return success — never reveal whether an email exists
    if (!user) {
      return success(res, {});
    }

    const resetToken = generateSecureToken();
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.passwordResetToken = hashedToken;
    user.passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h
    await user.save({ validateBeforeSave: false });

    // In production: send resetToken via email
    // Exposed here only in development for testing
    return success(res, {
      ...(process.env.NODE_ENV === 'development' && { resetToken }),
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/verify
const verifyEmail = async (req, res, next) => {
  try {
    if (!validate(req, res)) return;

    const { token } = req.body;

    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpiresAt: { $gt: new Date() },
    }).select('+verificationToken +verificationTokenExpiresAt');

    if (!user) {
      return error(res, 'Invalid or expired verification token', 400);
    }

    user.isVerified = true;
    user.verificationToken = null;
    user.verificationTokenExpiresAt = null;
    await user.save({ validateBeforeSave: false });

    return success(res, {});
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, refreshToken, logout, forgotPassword, verifyEmail };
