const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Call = require('../models/Call');
const User = require('../models/User');
const { success, paginated, error } = require('../helpers/response');
const { generateChannelId, generateCallerToken, generateCalleeToken, generateOnDemandToken } = require('../services/agoraService');
const { sendIncomingCallNotification, sendMissedCallNotification } = require('../services/notificationService');

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    error(res, errors.array()[0].msg, 400);
    return false;
  }
  return true;
};

/**
 * Sends a WebSocket event to a specific user if they are online.
 */
const sendToUser = (req, userId, event) => {
  const wsClients = req.app.get('wsClients');
  if (!wsClients) return;
  const ws = wsClients.get(userId.toString());
  if (ws && ws.readyState === 1 /* OPEN */) {
    ws.send(JSON.stringify(event));
  }
};

// POST /api/calls/initiate
const initiateCall = async (req, res, next) => {
  try {
    if (!validate(req, res)) return;

    const { calleeId, callType } = req.body;
    const callerId = req.user._id;

    if (calleeId === callerId.toString()) {
      return error(res, 'You cannot call yourself', 400);
    }

    const callee = await User.findById(calleeId).select('fcmToken displayName avatarUrl blockedUsers');
    if (!callee) return error(res, 'Callee not found', 404);

    // Block check
    const isBlocked = (callee.blockedUsers || []).map(String).includes(callerId.toString());
    if (isBlocked) return error(res, 'Unable to initiate call', 403);

    const channelId = generateChannelId();
    const uid = 0; // Agora will assign; for a real app track UIDs per user

    const { token, expiresAt } = generateCallerToken(channelId, uid);

    const call = await Call.create({
      callType,
      callerId,
      calleeId: new mongoose.Types.ObjectId(calleeId),
      channelId,
      status: 'ringing',
    });

    // Notify callee via WebSocket (if online)
    sendToUser(req, calleeId, {
      type: 'incoming_call',
      callId: call._id.toString(),
      channelId,
      callerId: callerId.toString(),
      callerName: req.user.displayName,
      callerAvatar: req.user.avatarUrl || '',
      callType,
    });

    // Notify callee via FCM (if backgrounded)
    sendIncomingCallNotification(calleeId, {
      callId: call._id.toString(),
      channelId,
      callerId: callerId.toString(),
      callerName: req.user.displayName,
      callerAvatar: req.user.avatarUrl || '',
      callType,
    }).catch(() => {});

    return success(
      res,
      {
        callId: call._id.toString(),
        channelId,
        token,
        uid,
        expiresAt,
      },
      201
    );
  } catch (err) {
    next(err);
  }
};

// POST /api/calls/:id/accept
const acceptCall = async (req, res, next) => {
  try {
    if (!validate(req, res)) return;

    const call = await Call.findById(req.params.id);
    if (!call) return error(res, 'Call not found', 404);

    if (call.calleeId.toString() !== req.user._id.toString()) {
      return error(res, 'Forbidden', 403);
    }

    if (call.status !== 'ringing') {
      return error(res, 'Call is no longer available', 400);
    }

    call.status = 'completed'; // will remain until ended
    call.startedAt = new Date();
    await call.save();

    const { token, uid, expiresAt } = generateCalleeToken(call.channelId, 0);

    // Notify the caller that the call was accepted
    sendToUser(req, call.callerId, {
      type: 'call_accepted',
      callId: call._id.toString(),
    });

    return success(res, { token, uid, expiresAt });
  } catch (err) {
    next(err);
  }
};

// POST /api/calls/:id/reject
const rejectCall = async (req, res, next) => {
  try {
    if (!validate(req, res)) return;

    const call = await Call.findById(req.params.id);
    if (!call) return error(res, 'Call not found', 404);

    if (call.calleeId.toString() !== req.user._id.toString()) {
      return error(res, 'Forbidden', 403);
    }

    if (call.status !== 'ringing') {
      return error(res, 'Call is no longer available', 400);
    }

    call.status = 'declined';
    call.endedAt = new Date();
    await call.save();

    sendToUser(req, call.callerId, {
      type: 'call_rejected',
      callId: call._id.toString(),
    });

    // Send missed call push to callee (actually the caller missed the callee declining — send to caller instead)
    const caller = await User.findById(call.callerId).select('displayName');
    sendMissedCallNotification(call.calleeId, {
      callId: call._id.toString(),
      callerName: caller ? caller.displayName : 'Someone',
      callType: call.callType,
    }).catch(() => {});

    return success(res, {});
  } catch (err) {
    next(err);
  }
};

// POST /api/calls/:id/end
const endCall = async (req, res, next) => {
  try {
    if (!validate(req, res)) return;

    const call = await Call.findById(req.params.id);
    if (!call) return error(res, 'Call not found', 404);

    const isParticipant =
      call.callerId.toString() === req.user._id.toString() ||
      call.calleeId.toString() === req.user._id.toString();

    if (!isParticipant) return error(res, 'Forbidden', 403);

    call.endedAt = new Date();

    if (call.status === 'ringing') {
      // Caller hung up before callee answered
      call.status = 'missed';
      sendMissedCallNotification(call.calleeId, {
        callId: call._id.toString(),
        callerName: req.user.displayName,
        callType: call.callType,
      }).catch(() => {});
    } else {
      call.status = 'completed';
      if (call.startedAt) {
        call.duration = Math.floor((call.endedAt - call.startedAt) / 1000);
      }
    }

    await call.save();

    // Notify the other party
    const otherId =
      call.callerId.toString() === req.user._id.toString()
        ? call.calleeId
        : call.callerId;

    sendToUser(req, otherId, {
      type: 'call_ended',
      callId: call._id.toString(),
    });

    return success(res, {
      callId: call._id.toString(),
      status: call.status,
      duration: call.duration,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/calls/token?channelId=&uid=
const getAgoraToken = async (req, res, next) => {
  try {
    if (!validate(req, res)) return;

    const { channelId, uid = 0 } = req.query;

    const { token, expiresAt } = generateOnDemandToken(channelId, parseInt(uid, 10));

    return success(res, { token, uid: parseInt(uid, 10), expiresAt });
  } catch (err) {
    next(err);
  }
};

// GET /api/calls/history?page=&pageSize=
const getCallHistory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const skip = (page - 1) * pageSize;
    const myId = req.user._id;

    const filter = { $or: [{ callerId: myId }, { calleeId: myId }] };

    const [calls, total] = await Promise.all([
      Call.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .populate('callerId', User.publicFields)
        .populate('calleeId', User.publicFields)
        .lean(),
      Call.countDocuments(filter),
    ]);

    return paginated(res, calls, { page, pageSize, total });
  } catch (err) {
    next(err);
  }
};

module.exports = { initiateCall, acceptCall, rejectCall, endCall, getAgoraToken, getCallHistory };
