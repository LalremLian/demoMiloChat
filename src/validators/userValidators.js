const { body, query, param } = require('express-validator');

const updateProfileValidator = [
  body('displayName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 }).withMessage('Display name must be between 1 and 50 characters'),

  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 }).withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username may only contain letters, numbers, and underscores'),

  body('bio')
    .optional()
    .trim()
    .isLength({ max: 160 }).withMessage('Bio must not exceed 160 characters'),

  body('avatarUrl')
    .optional()
    .trim()
    .isURL().withMessage('avatarUrl must be a valid URL'),
];

const updateStatusValidator = [
  body('isOnline')
    .notEmpty().withMessage('isOnline is required')
    .isBoolean().withMessage('isOnline must be a boolean'),
];

const updateFcmTokenValidator = [
  body('fcmToken')
    .trim()
    .notEmpty().withMessage('fcmToken is required'),
];

const searchUsersValidator = [
  query('q')
    .trim()
    .notEmpty().withMessage('Search query is required')
    .isLength({ min: 1, max: 100 }).withMessage('Search query must not exceed 100 characters'),

  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('page must be a positive integer')
    .toInt(),

  query('pageSize')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('pageSize must be between 1 and 50')
    .toInt(),
];

const userIdParamValidator = [
  param('id')
    .isMongoId().withMessage('id must be a valid user ID'),
];

const reportUserValidator = [
  param('id')
    .isMongoId().withMessage('id must be a valid user ID'),

  body('reason')
    .trim()
    .notEmpty().withMessage('Report reason is required')
    .isLength({ max: 500 }).withMessage('Reason must not exceed 500 characters'),
];

module.exports = {
  updateProfileValidator,
  updateStatusValidator,
  updateFcmTokenValidator,
  searchUsersValidator,
  userIdParamValidator,
  reportUserValidator,
};
