const express = require('express');
const router = express.Router();

const {
  getMe,
  updateProfile,
  updateStatus,
  updateFcmToken,
  searchUsers,
  getUserById,
  blockUser,
  unblockUser,
  reportUser,
} = require('../controllers/userController');

const {
  updateProfileValidator,
  updateStatusValidator,
  updateFcmTokenValidator,
  searchUsersValidator,
  userIdParamValidator,
  reportUserValidator,
} = require('../validators/userValidators');

const { verifyToken } = require('../middleware/auth');

// All user routes require authentication
router.use(verifyToken);

// GET  /api/users/me
router.get('/me', getMe);

// PATCH /api/users/me
router.patch('/me', updateProfileValidator, updateProfile);

// PATCH /api/users/me/status
router.patch('/me/status', updateStatusValidator, updateStatus);

// PATCH /api/users/me/fcm-token
router.patch('/me/fcm-token', updateFcmTokenValidator, updateFcmToken);

// GET /api/users/search?q=&page=&pageSize=
router.get('/search', searchUsersValidator, searchUsers);

// GET /api/users/:id
router.get('/:id', userIdParamValidator, getUserById);

// POST /api/users/:id/block
router.post('/:id/block', userIdParamValidator, blockUser);

// DELETE /api/users/:id/block
router.delete('/:id/block', userIdParamValidator, unblockUser);

// POST /api/users/:id/report
router.post('/:id/report', reportUserValidator, reportUser);

module.exports = router;
