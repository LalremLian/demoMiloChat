const { body } = require('express-validator');

const registerValidator = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),

  body('displayName')
    .trim()
    .notEmpty().withMessage('Display name is required')
    .isLength({ max: 50 }).withMessage('Display name must not exceed 50 characters'),

  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 30 }).withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username may only contain letters, numbers, and underscores'),
];

const loginValidator = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required'),
];

const refreshTokenValidator = [
  body('refreshToken')
    .trim()
    .notEmpty().withMessage('Refresh token is required'),
];

const logoutValidator = [
  body('userId')
    .notEmpty().withMessage('userId is required')
    .isMongoId().withMessage('userId must be a valid ID'),
];

const forgotPasswordValidator = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
];

const verifyEmailValidator = [
  body('token')
    .trim()
    .notEmpty().withMessage('Verification token is required'),
];

module.exports = {
  registerValidator,
  loginValidator,
  refreshTokenValidator,
  logoutValidator,
  forgotPasswordValidator,
  verifyEmailValidator,
};
