const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
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

// GET /api/users/me
const getMe = async (req, res, next) => {
  try {
    return success(res, { user: req.user });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/users/me
const updateProfile = async (req, res, next) => {
  try {
    if (!validate(req, res)) return;

    const { displayName, username, bio, avatarUrl } = req.body;

    // Check username uniqueness if being changed
    if (username && username !== req.user.username) {
      const taken = await User.findOne({ username, _id: { $ne: req.user._id } });
      if (taken) return error(res, 'username is already taken', 409);
    }

    const allowedUpdates = {};
    if (displayName !== undefined) allowedUpdates.displayName = displayName;
    if (username !== undefined) allowedUpdates.username = username;
    if (bio !== undefined) allowedUpdates.bio = bio;
    if (avatarUrl !== undefined) allowedUpdates.avatarUrl = avatarUrl;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: allowedUpdates },
      { new: true, runValidators: true }
    ).select('-password -fcmToken -blockedUsers -refreshTokens -verificationToken -verificationTokenExpiresAt -passwordResetToken -passwordResetExpiresAt');

    return success(res, { user });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/users/me/status
const updateStatus = async (req, res, next) => {
  try {
    if (!validate(req, res)) return;

    const { isOnline } = req.body;

    const update = { isOnline };
    if (!isOnline) update.lastSeenAt = new Date();

    await User.findByIdAndUpdate(req.user._id, { $set: update });

    return success(res, { isOnline });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/users/me/fcm-token
const updateFcmToken = async (req, res, next) => {
  try {
    if (!validate(req, res)) return;

    const { fcmToken } = req.body;

    await User.findByIdAndUpdate(req.user._id, { $set: { fcmToken } });

    return success(res, { message: 'FCM token updated' });
  } catch (err) {
    next(err);
  }
};

// GET /api/users/search?q=&page=&pageSize=
const searchUsers = async (req, res, next) => {
  try {
    if (!validate(req, res)) return;

    const q = req.query.q;
    const page = req.query.page || 1;
    const pageSize = req.query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const blockedByMe = await User.findById(req.user._id).select('blockedUsers');
    const excludeIds = [
      req.user._id,
      ...((blockedByMe && blockedByMe.blockedUsers) || []),
    ];

    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const filter = {
      _id: { $nin: excludeIds },
      $or: [{ username: regex }, { displayName: regex }],
    };

    const [users, total] = await Promise.all([
      User.find(filter)
        .select(User.publicFields)
        .skip(skip)
        .limit(pageSize)
        .lean(),
      User.countDocuments(filter),
    ]);

    return paginated(res, users, { page, pageSize, total });
  } catch (err) {
    next(err);
  }
};

// GET /api/users/:id
const getUserById = async (req, res, next) => {
  try {
    if (!validate(req, res)) return;

    const { id } = req.params;

    // Check if the requesting user is blocked by the target user
    const targetUser = await User.findById(id)
      .select(`${User.publicFields} blockedUsers`)
      .lean();

    if (!targetUser) return error(res, 'User not found', 404);

    const isBlocked = (targetUser.blockedUsers || [])
      .map(String)
      .includes(req.user._id.toString());

    if (isBlocked) return error(res, 'User not found', 404);

    const { blockedUsers: _blocked, ...publicUser } = targetUser;

    return success(res, { user: publicUser });
  } catch (err) {
    next(err);
  }
};

// POST /api/users/:id/block
const blockUser = async (req, res, next) => {
  try {
    if (!validate(req, res)) return;

    const targetId = req.params.id;

    if (targetId === req.user._id.toString()) {
      return error(res, 'You cannot block yourself', 400);
    }

    const target = await User.findById(targetId);
    if (!target) return error(res, 'User not found', 404);

    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { blockedUsers: new mongoose.Types.ObjectId(targetId) },
    });

    return success(res, {});
  } catch (err) {
    next(err);
  }
};

// DELETE /api/users/:id/block
const unblockUser = async (req, res, next) => {
  try {
    if (!validate(req, res)) return;

    const targetId = req.params.id;

    await User.findByIdAndUpdate(req.user._id, {
      $pull: { blockedUsers: new mongoose.Types.ObjectId(targetId) },
    });

    return success(res, {});
  } catch (err) {
    next(err);
  }
};

// POST /api/users/:id/report
const reportUser = async (req, res, next) => {
  try {
    if (!validate(req, res)) return;

    const { id } = req.params;
    const { reason } = req.body;

    const target = await User.findById(id);
    if (!target) return error(res, 'User not found', 404);

    // In a production system this would persist to a Reports collection
    // and potentially alert moderators. Logged here for audit purposes.
    console.log(`[REPORT] User ${req.user._id} reported ${id}: ${reason}`);

    return success(res, {});
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMe,
  updateProfile,
  updateStatus,
  updateFcmToken,
  searchUsers,
  getUserById,
  blockUser,
  unblockUser,
  reportUser,
};
