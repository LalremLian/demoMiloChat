const { body, query, param } = require('express-validator');

// ── Conversation validators ─────────────────────────────────────────────────

const conversationIdParamValidator = [
  param('id')
    .isMongoId().withMessage('Conversation id must be a valid ID'),
];

const createDirectConversationValidator = [
  body('targetUserId')
    .notEmpty().withMessage('targetUserId is required')
    .isMongoId().withMessage('targetUserId must be a valid user ID'),
];

const createGroupConversationValidator = [
  body('name')
    .trim()
    .notEmpty().withMessage('Group name is required')
    .isLength({ max: 100 }).withMessage('Group name must not exceed 100 characters'),

  body('memberIds')
    .isArray({ min: 2 }).withMessage('memberIds must be an array with at least 2 users'),

  body('memberIds.*')
    .isMongoId().withMessage('Each memberId must be a valid user ID'),
];

const paginationValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('page must be a positive integer')
    .toInt(),

  query('pageSize')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('pageSize must be between 1 and 100')
    .toInt(),
];

// ── Message validators ──────────────────────────────────────────────────────

const sendMessageValidator = [
  param('id')
    .isMongoId().withMessage('Conversation id must be a valid ID'),

  body('type')
    .optional()
    .isIn(['text', 'image', 'video', 'file', 'voice', 'system'])
    .withMessage('type must be one of: text, image, video, file, voice, system'),

  body('text')
    .optional()
    .trim()
    .isLength({ max: 4000 }).withMessage('Message text must not exceed 4000 characters'),

  body('attachmentUrl')
    .optional()
    .trim()
    .isURL().withMessage('attachmentUrl must be a valid URL'),

  body('replyToId')
    .optional()
    .isMongoId().withMessage('replyToId must be a valid message ID'),

  body('localId')
    .optional()
    .trim()
    .isUUID().withMessage('localId must be a valid UUID'),
];

const editMessageValidator = [
  param('id')
    .isMongoId().withMessage('Conversation id must be a valid ID'),

  param('msgId')
    .isMongoId().withMessage('Message id must be a valid ID'),

  body('text')
    .trim()
    .notEmpty().withMessage('text is required for editing')
    .isLength({ max: 4000 }).withMessage('Message text must not exceed 4000 characters'),
];

const messageIdParamValidator = [
  param('id')
    .isMongoId().withMessage('Conversation id must be a valid ID'),

  param('msgId')
    .isMongoId().withMessage('Message id must be a valid ID'),
];

const addReactionValidator = [
  param('id')
    .isMongoId().withMessage('Conversation id must be a valid ID'),

  param('msgId')
    .isMongoId().withMessage('Message id must be a valid ID'),

  body('emoji')
    .trim()
    .notEmpty().withMessage('emoji is required')
    .isLength({ max: 10 }).withMessage('emoji must not exceed 10 characters'),
];

const getMessagesValidator = [
  param('id')
    .isMongoId().withMessage('Conversation id must be a valid ID'),

  query('before')
    .optional()
    .isMongoId().withMessage('before must be a valid message ID'),

  query('pageSize')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('pageSize must be between 1 and 100')
    .toInt(),
];

// ── Call validators ─────────────────────────────────────────────────────────

const initiateCallValidator = [
  body('calleeId')
    .notEmpty().withMessage('calleeId is required')
    .isMongoId().withMessage('calleeId must be a valid user ID'),

  body('callType')
    .notEmpty().withMessage('callType is required')
    .isIn(['voice', 'video']).withMessage('callType must be voice or video'),
];

const callIdParamValidator = [
  param('id')
    .isMongoId().withMessage('Call id must be a valid ID'),
];

const agoraTokenQueryValidator = [
  query('channelId')
    .trim()
    .notEmpty().withMessage('channelId is required'),

  query('uid')
    .optional()
    .isInt({ min: 0 }).withMessage('uid must be a non-negative integer')
    .toInt(),
];

module.exports = {
  conversationIdParamValidator,
  createDirectConversationValidator,
  createGroupConversationValidator,
  paginationValidator,
  sendMessageValidator,
  editMessageValidator,
  messageIdParamValidator,
  addReactionValidator,
  getMessagesValidator,
  initiateCallValidator,
  callIdParamValidator,
  agoraTokenQueryValidator,
};
