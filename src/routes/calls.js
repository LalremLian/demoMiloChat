const express = require('express');
const router = express.Router();

const {
  initiateCall,
  acceptCall,
  rejectCall,
  endCall,
  getAgoraToken,
  getCallHistory,
} = require('../controllers/callController');

const {
  initiateCallValidator,
  callIdParamValidator,
  agoraTokenQueryValidator,
  paginationValidator,
} = require('../validators/chatValidators');

const { verifyToken } = require('../middleware/auth');

// All call routes require authentication
router.use(verifyToken);

// GET  /api/calls/token?channelId=&uid=
// Declared before /:id routes to prevent "token" matching as an :id
router.get('/token', agoraTokenQueryValidator, getAgoraToken);

// GET  /api/calls/history?page=&pageSize=
router.get('/history', paginationValidator, getCallHistory);

// POST /api/calls/initiate
router.post('/initiate', initiateCallValidator, initiateCall);

// POST /api/calls/:id/accept
router.post('/:id/accept', callIdParamValidator, acceptCall);

// POST /api/calls/:id/reject
router.post('/:id/reject', callIdParamValidator, rejectCall);

// POST /api/calls/:id/end
router.post('/:id/end', callIdParamValidator, endCall);

module.exports = router;
