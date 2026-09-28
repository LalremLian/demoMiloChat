const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const { success, paginated, error } = require('../helpers/response');

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    error(res, errors.array()[0].msg, 400);
    return false;
  }
  return true;
};

/**
 * Checks whether targetUserId has blocked the requesting user.
 */
const isBlockedBy = async (targetUserId, requestingUserId) => {
  const target = await User.findById(targetUserId).select('blockedUsers');
  if (!target) return false;
  return (target.blockedUsers || []).map(String).includes(requestingUserId.toString());
};

// GET /api/conversations?page=&pageSize=
const getConversations = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const skip = (page - 1) * pageSize;

    const [conversations, total] = await Promise.all([
      Conversation.find({ members: req.user._id })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .populate('members', User.publicFields)
        .populate({
          path: 'lastMessage',
          select: 'text type senderId status createdAt attachment',
        })
        .lean(),
      Conversation.countDocuments({ members: req.user._id }),
    ]);

    return paginated(res, conversations, { page, pageSize, total });
  } catch (err) {
    next(err);
  }
};

// GET /api/conversations/:id
const getConversation = async (req, res, next) => {
  try {
    if (!validate(req, res)) return;

    const conversation = await Conversation.findOne({
      _id: req.params.id,
      members: req.user._id,
    })
      .populate('members', User.publicFields)
      .populate('lastMessage')
      .lean();

    if (!conversation) return error(res, 'Conversation not found', 404);

    return success(res, { conversation });
  } catch (err) {
    next(err);
  }
};

// POST /api/conversations/direct
const createDirectConversation = async (req, res, next) => {
  try {
    if (!validate(req, res)) return;

    const { targetUserId } = req.body;
    const myId = req.user._id;

    if (targetUserId === myId.toString()) {
      return error(res, 'You cannot start a conversation with yourself', 400);
    }

    const target = await User.findById(targetUserId);
    if (!target) return error(res, 'Target user not found', 404);

    // Check if target has blocked me
    if (await isBlockedBy(targetUserId, myId)) {
      return error(res, 'Unable to start conversation', 403);
    }

    // Return existing direct conversation if one already exists
    const existing = await Conversation.findOne({
      type: 'direct',
      members: { $all: [myId, new mongoose.Types.ObjectId(targetUserId)], $size: 2 },
    })
      .populate('members', User.publicFields)
      .populate('lastMessage');

    if (existing) return success(res, { conversation: existing });

    const conversation = await Conversation.create({
      type: 'direct',
      members: [myId, new mongoose.Types.ObjectId(targetUserId)],
    });

    const populated = await Conversation.findById(conversation._id)
      .populate('members', User.publicFields)
      .lean();

    return success(res, { conversation: populated }, 201);
  } catch (err) {
    next(err);
  }
};

// POST /api/conversations/group
const createGroupConversation = async (req, res, next) => {
  try {
    if (!validate(req, res)) return;

    const { name, memberIds } = req.body;
    const myId = req.user._id;

    // Deduplicate and include self
    const uniqueIds = [...new Set([myId.toString(), ...memberIds])];
    if (uniqueIds.length < 2) {
      return error(res, 'Group must have at least 2 members', 400);
    }

    // Verify all members exist
    const memberObjectIds = uniqueIds.map((id) => new mongoose.Types.ObjectId(id));
    const foundCount = await User.countDocuments({ _id: { $in: memberObjectIds } });
    if (foundCount !== memberObjectIds.length) {
      return error(res, 'One or more member users not found', 404);
    }

    const conversation = await Conversation.create({
      type: 'group',
      name,
      members: memberObjectIds,
    });

    const populated = await Conversation.findById(conversation._id)
      .populate('members', User.publicFields)
      .lean();

    return success(res, { conversation: populated }, 201);
  } catch (err) {
    next(err);
  }
};

// POST /api/conversations/:id/read
const markAsRead = async (req, res, next) => {
  try {
    if (!validate(req, res)) return;

    const conversation = await Conversation.findOne({
      _id: req.params.id,
      members: req.user._id,
    });
    if (!conversation) return error(res, 'Conversation not found', 404);

    // Mark all delivered messages in this conversation as read
    await Message.updateMany(
      {
        conversationId: conversation._id,
        senderId: { $ne: req.user._id },
        status: { $in: ['sent', 'delivered'] },
      },
      { $set: { status: 'read' } }
    );

    return success(res, {});
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getConversations,
  getConversation,
  createDirectConversation,
  createGroupConversation,
  markAsRead,
};
