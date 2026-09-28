const express = require('express');
const router = express.Router();

const {
  getConversations,
  getConversation,
  createDirectConversation,
  createGroupConversation,
  markAsRead,
} = require('../controllers/conversationController');

const {
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  addReaction,
} = require('../controllers/messageController');

const {
  conversationIdParamValidator,
  createDirectConversationValidator,
  createGroupConversationValidator,
  paginationValidator,
  sendMessageValidator,
  editMessageValidator,
  messageIdParamValidator,
  addReactionValidator,
  getMessagesValidator,
} = require('../validators/chatValidators');

const { verifyToken } = require('../middleware/auth');

// All conversation routes require authentication
router.use(verifyToken);

// ── Conversations ───────────────────────────────────────────────────────────

// GET  /api/conversations?page=&pageSize=
router.get('/', paginationValidator, getConversations);

// POST /api/conversations/direct
// Must be declared BEFORE /:id to prevent "direct" being treated as an :id
router.post('/direct', createDirectConversationValidator, createDirectConversation);

// POST /api/conversations/group
router.post('/group', createGroupConversationValidator, createGroupConversation);

// GET  /api/conversations/:id
router.get('/:id', conversationIdParamValidator, getConversation);

// POST /api/conversations/:id/read
router.post('/:id/read', conversationIdParamValidator, markAsRead);

// ── Messages ────────────────────────────────────────────────────────────────

// GET  /api/conversations/:id/messages?before=&pageSize=
router.get('/:id/messages', getMessagesValidator, getMessages);

// POST /api/conversations/:id/messages
router.post('/:id/messages', sendMessageValidator, sendMessage);

// PATCH /api/conversations/:id/messages/:msgId
router.patch('/:id/messages/:msgId', editMessageValidator, editMessage);

// DELETE /api/conversations/:id/messages/:msgId
router.delete('/:id/messages/:msgId', messageIdParamValidator, deleteMessage);

// POST /api/conversations/:id/messages/:msgId/reactions
router.post('/:id/messages/:msgId/reactions', addReactionValidator, addReaction);

module.exports = router;
