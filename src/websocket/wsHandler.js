const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

/**
 * Sends a JSON payload to a WebSocket client if the socket is open.
 * @param {import('ws')} ws
 * @param {object} payload
 */
const sendJson = (ws, payload) => {
  if (ws.readyState === 1 /* WebSocket.OPEN */) {
    ws.send(JSON.stringify(payload));
  }
};

/**
 * Broadcasts a payload to all members of a conversation who are currently connected,
 * optionally excluding the sender.
 *
 * @param {Map<string, import('ws')>} wsClients  - userId → WebSocket map
 * @param {string[]} memberIds
 * @param {object} payload
 * @param {string|null} excludeUserId
 */
const broadcastToMembers = (wsClients, memberIds, payload, excludeUserId = null) => {
  for (const memberId of memberIds) {
    const idStr = memberId.toString();
    if (excludeUserId && idStr === excludeUserId) continue;
    const ws = wsClients.get(idStr);
    if (ws) sendJson(ws, payload);
  }
};

/**
 * Retrieves all distinct conversation member IDs for a user.
 * Used when broadcasting presence (online/offline) events.
 *
 * @param {string} userId
 * @returns {Promise<string[]>}
 */
const getConversationMemberIds = async (userId) => {
  const conversations = await Conversation.find({ members: userId }).select('members').lean();
  const ids = new Set();
  for (const conv of conversations) {
    for (const memberId of conv.members) {
      const s = memberId.toString();
      if (s !== userId) ids.add(s);
    }
  }
  return Array.from(ids);
};

/**
 * Main WebSocket message handler.
 * Called once per incoming message from a connected client.
 *
 * @param {import('ws')} ws               - The sender's socket
 * @param {object} user                   - Authenticated user document
 * @param {Buffer|string} rawMessage      - Raw message from the client
 * @param {Map<string, import('ws')>} wsClients
 */
const handleMessage = async (ws, user, rawMessage, wsClients) => {
  let data;
  try {
    data = JSON.parse(rawMessage.toString());
  } catch {
    return sendJson(ws, { type: 'error', message: 'Invalid JSON' });
  }

  const { type, conversationId, upToMessageId } = data;

  switch (type) {
    case 'typing_start':
    case 'typing_stop': {
      if (!conversationId) {
        return sendJson(ws, { type: 'error', message: 'conversationId is required' });
      }

      // Verify the user is actually a member of this conversation
      const conv = await Conversation.findOne({
        _id: conversationId,
        members: user._id,
      }).select('members').lean();

      if (!conv) return; // silently ignore invalid conversationId

      broadcastToMembers(
        wsClients,
        conv.members,
        { type, conversationId, userId: user._id.toString() },
        user._id.toString()
      );
      break;
    }

    case 'read_receipt': {
      if (!conversationId) {
        return sendJson(ws, { type: 'error', message: 'conversationId is required' });
      }

      const conv = await Conversation.findOne({
        _id: conversationId,
        members: user._id,
      }).select('members').lean();

      if (!conv) return;

      // Update message statuses in DB
      const filter = {
        conversationId,
        senderId: { $ne: user._id },
        status: { $in: ['sent', 'delivered'] },
      };
      if (upToMessageId) {
        filter._id = { $lte: upToMessageId };
      }
      await Message.updateMany(filter, { $set: { status: 'read' } });

      // Broadcast read receipt to all other members
      broadcastToMembers(
        wsClients,
        conv.members,
        {
          type: 'message_read',
          conversationId,
          userId: user._id.toString(),
          upToMessageId: upToMessageId || null,
        },
        user._id.toString()
      );
      break;
    }

    default:
      sendJson(ws, { type: 'error', message: `Unknown event type: ${type}` });
  }
};

/**
 * Called when a client connects successfully.
 * Sets the user online and broadcasts user_online to all their contacts.
 *
 * @param {object} user
 * @param {Map<string, import('ws')>} wsClients
 */
const handleConnect = async (user, wsClients) => {
  try {
    await User.findByIdAndUpdate(user._id, {
      isOnline: true,
      lastSeenAt: null,
    });

    const memberIds = await getConversationMemberIds(user._id.toString());
    const payload = JSON.stringify({ type: 'user_online', userId: user._id.toString() });

    for (const memberId of memberIds) {
      const ws = wsClients.get(memberId);
      if (ws && ws.readyState === 1) ws.send(payload);
    }
  } catch (err) {
    console.error('[WS] handleConnect error:', err.message);
  }
};

/**
 * Called when a client disconnects.
 * Sets the user offline, records lastSeenAt, and broadcasts user_offline.
 *
 * @param {object} user
 * @param {Map<string, import('ws')>} wsClients
 */
const handleDisconnect = async (user, wsClients) => {
  try {
    const lastSeenAt = new Date();
    await User.findByIdAndUpdate(user._id, { isOnline: false, lastSeenAt });

    const memberIds = await getConversationMemberIds(user._id.toString());
    const payload = JSON.stringify({
      type: 'user_offline',
      userId: user._id.toString(),
      lastSeenAt: lastSeenAt.getTime(),
    });

    for (const memberId of memberIds) {
      const ws = wsClients.get(memberId);
      if (ws && ws.readyState === 1) ws.send(payload);
    }
  } catch (err) {
    console.error('[WS] handleDisconnect error:', err.message);
  }
};

module.exports = { handleMessage, handleConnect, handleDisconnect };
