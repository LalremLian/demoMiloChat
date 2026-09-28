const { sendPushNotification } = require('../config/firebase');
const User = require('../models/User');

/**
 * Fetches a user's FCM token. Returns null if none stored.
 */
const getFcmToken = async (userId) => {
  const user = await User.findById(userId).select('fcmToken');
  return user ? user.fcmToken : null;
};

/**
 * Sends an incoming call push notification to the callee.
 * High-priority so the OS wakes the app even when backgrounded.
 *
 * @param {string} calleeId   - MongoDB ObjectId of the recipient
 * @param {object} callData   - { callId, channelId, callerId, callerName, callerAvatar, callType }
 */
const sendIncomingCallNotification = async (calleeId, callData) => {
  const fcmToken = await getFcmToken(calleeId);
  if (!fcmToken) return;

  await sendPushNotification({
    token: fcmToken,
    title: callData.callerName || 'Incoming call',
    body: callData.callType === 'video' ? 'Incoming video call' : 'Incoming voice call',
    data: {
      type: 'incoming_call',
      callId: callData.callId,
      channelId: callData.channelId,
      callerId: callData.callerId,
      callerName: callData.callerName || '',
      callerAvatar: callData.callerAvatar || '',
      callType: callData.callType,
    },
  });
};

/**
 * Sends a new-message push notification when the recipient is offline.
 *
 * @param {string} recipientId  - MongoDB ObjectId
 * @param {object} messageData  - { senderName, text, conversationId, messageId }
 */
const sendNewMessageNotification = async (recipientId, messageData) => {
  const fcmToken = await getFcmToken(recipientId);
  if (!fcmToken) return;

  const body = messageData.text
    ? messageData.text.slice(0, 100)
    : 'Sent you a message';

  await sendPushNotification({
    token: fcmToken,
    title: messageData.senderName || 'New message',
    body,
    data: {
      type: 'new_message',
      conversationId: messageData.conversationId,
      messageId: messageData.messageId,
      senderName: messageData.senderName || '',
    },
  });
};

/**
 * Sends a missed call notification.
 *
 * @param {string} calleeId
 * @param {object} callData  - { callId, callerName, callType }
 */
const sendMissedCallNotification = async (calleeId, callData) => {
  const fcmToken = await getFcmToken(calleeId);
  if (!fcmToken) return;

  await sendPushNotification({
    token: fcmToken,
    title: 'Missed call',
    body: `You missed a ${callData.callType} call from ${callData.callerName || 'someone'}`,
    data: {
      type: 'missed_call',
      callId: callData.callId,
      callerName: callData.callerName || '',
      callType: callData.callType,
    },
  });
};

module.exports = {
  getFcmToken,
  sendIncomingCallNotification,
  sendNewMessageNotification,
  sendMissedCallNotification,
};
