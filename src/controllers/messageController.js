const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const { success, error } = require('../helpers/response');
const { sendNewMessageNotification } = require('../services/notificationService');

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    error(res, errors.array()[0].msg, 400);
    return false;
  }
  return true;
};

/**
 * Broadcasts a WebSocket event to all conversation members who are online.
 * The wsClients map is attached to the app by wsServer.js.
 */
const broadcastToConversation = (req, members, event) => {
  const wsClients = req.app.get('wsClients');
  if (!wsClients) return;

  const payload = JSON.stringify(event);
  for (const memberId of members) {
    const ws = wsClients.get(memberId.toString());
    if (ws && ws.readyState === 1 /* OPEN */) {
      ws.send(payload);
    }
  }
};

// GET /api/conversations/:id/messages?before=&pageSize=
const getMessages = async (req, res, next) => {
  try {
    if (!validate(req, res)) return;

    const conversation = await Conversation.findOne({
      _id: req.params.id,
      members: req.user._id,
    });
    if (!conversation) return error(res, 'Conversation not found', 404);

    const pageSize = parseInt(req.query.pageSize) || 30;
    const before = req.query.before;

    const filter = {
      conversationId: conversation._id,
      status: { $ne: 'deleted' },
    };
    if (before && mongoose.Types.ObjectId.isValid(before)) {
      filter._id = { $lt: new mongoose.Types.ObjectId(before) };
    }

    const messages = await Message.find(filter)
      .sort({ _id: -1 })
      .limit(pageSize)
      .populate('senderId', User.publicFields)
      .populate('replyTo', 'text type senderId attachment')
      .lean();

    return success(res, { messages: messages.reverse(), hasMore: messages.length === pageSize });
  } catch (err) {
    next(err);
  }
};

// POST /api/conversations/:id/messages
const sendMessage = async (req, res, next) => {
  try {
    if (!validate(req, res)) return;

    const { type = 'text', text, attachmentUrl, replyToId, localId } = req.body;

    const conversation = await Conversation.findOne({
      _id: req.params.id,
      members: req.user._id,
    });
    if (!conversation) return error(res, 'Conversation not found', 404);

    // Block check — prevent blocked users from sending messages
    for (const memberId of conversation.members) {
      if (memberId.toString() === req.user._id.toString()) continue;
      const member = await User.findById(memberId).select('blockedUsers');
      if ((member.blockedUsers || []).map(String).includes(req.user._id.toString())) {
        return error(res, 'You cannot send messages to this user', 403);
      }
    }

    // Deduplication — if localId already exists in this conversation, return existing message
    if (localId) {
      const duplicate = await Message.findOne({ localId, conversationId: conversation._id })
        .populate('senderId', User.publicFields)
        .lean();
      if (duplicate) return success(res, { message: duplicate });
    }

    if (type === 'text' && !text) {
      return error(res, 'text is required for text messages', 400);
    }

    const messageData = {
      conversationId: conversation._id,
      senderId: req.user._id,
      type,
      text: text || '',
      localId: localId || null,
    };

    if (attachmentUrl) {
      messageData.attachment = { url: attachmentUrl };
    }

    if (replyToId && mongoose.Types.ObjectId.isValid(replyToId)) {
      const replied = await Message.findById(replyToId);
      if (replied) messageData.replyTo = replied._id;
    }

    const message = await Message.create(messageData);

    // Update conversation's lastMessage pointer and updatedAt
    await Conversation.findByIdAndUpdate(conversation._id, {
      lastMessage: message._id,
      updatedAt: new Date(),
    });

    const populated = await Message.findById(message._id)
      .populate('senderId', User.publicFields)
      .populate('replyTo', 'text type senderId attachment')
      .lean();

    // Broadcast new_message to all online conversation members
    broadcastToConversation(req, conversation.members, {
      type: 'new_message',
      data: populated,
    });

    // Mark as delivered for online members (everyone except sender)
    await Message.findByIdAndUpdate(message._id, { status: 'delivered' });

    // Send push notifications to offline members
    const offlineMembers = conversation.members.filter(
      (id) => id.toString() !== req.user._id.toString()
    );
    for (const memberId of offlineMembers) {
      sendNewMessageNotification(memberId, {
        senderName: req.user.displayName,
        text: text || '',
        conversationId: conversation._id.toString(),
        messageId: message._id.toString(),
      }).catch(() => {}); // fire-and-forget, never block response
    }

    return success(res, { message: populated }, 201);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/conversations/:id/messages/:msgId
const editMessage = async (req, res, next) => {
  try {
    if (!validate(req, res)) return;

    const { text } = req.body;
    const { id: conversationId, msgId } = req.params;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      members: req.user._id,
    });
    if (!conversation) return error(res, 'Conversation not found', 404);

    const message = await Message.findOne({
      _id: msgId,
      conversationId: conversation._id,
      senderId: req.user._id,
      status: { $ne: 'deleted' },
    });

    if (!message) return error(res, 'Message not found', 404);
    if (message.type !== 'text') return error(res, 'Only text messages can be edited', 400);

    message.text = text;
    message.isEdited = true;
    await message.save();

    broadcastToConversation(req, conversation.members, {
      type: 'message_edited',
      messageId: message._id.toString(),
      conversationId: conversation._id.toString(),
      text: message.text,
      updatedAt: message.updatedAt.getTime(),
    });

    return success(res, { message });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/conversations/:id/messages/:msgId
const deleteMessage = async (req, res, next) => {
  try {
    if (!validate(req, res)) return;

    const { id: conversationId, msgId } = req.params;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      members: req.user._id,
    });
    if (!conversation) return error(res, 'Conversation not found', 404);

    const message = await Message.findOne({
      _id: msgId,
      conversationId: conversation._id,
      senderId: req.user._id,
    });

    if (!message) return error(res, 'Message not found', 404);

    // Soft delete — preserve the record but hide content
    message.status = 'deleted';
    message.text = '';
    message.attachment = null;
    await message.save();

    broadcastToConversation(req, conversation.members, {
      type: 'message_deleted',
      messageId: message._id.toString(),
      conversationId: conversation._id.toString(),
    });

    return success(res, { message: 'Message deleted' });
  } catch (err) {
    next(err);
  }
};

// POST /api/conversations/:id/messages/:msgId/reactions
const addReaction = async (req, res, next) => {
  try {
    if (!validate(req, res)) return;

    const { emoji } = req.body;
    const { id: conversationId, msgId } = req.params;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      members: req.user._id,
    });
    if (!conversation) return error(res, 'Conversation not found', 404);

    const message = await Message.findOne({
      _id: msgId,
      conversationId: conversation._id,
      status: { $ne: 'deleted' },
    });
    if (!message) return error(res, 'Message not found', 404);

    const existing = message.reactions.find(
      (r) => r.emoji === emoji && r.userId.toString() === req.user._id.toString()
    );

    if (existing) {
      // Toggle off — remove the reaction
      message.reactions = message.reactions.filter(
        (r) => !(r.emoji === emoji && r.userId.toString() === req.user._id.toString())
      );
    } else {
      message.reactions.push({ emoji, userId: req.user._id, count: 1 });
    }

    await message.save();

    return success(res, {});
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  addReaction,
};
