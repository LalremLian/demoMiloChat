/**
 * normalize.js
 *
 * Converts Mongoose lean() documents into the shape the mobile app expects:
 *   - _id (ObjectId) → id (string)
 *   - Date fields → epoch milliseconds (Long in Kotlin)
 *
 * WHY: .lean() skips toJSON transforms for performance. These helpers
 * apply the same normalization manually before sending the response.
 */

const toMs = (d) => (d instanceof Date ? d.getTime() : d || null);

/**
 * Normalize a user lean document.
 */
const normalizeUser = (u) => {
  if (!u) return null;
  return {
    id: u._id?.toString() ?? u.id,
    email: u.email,
    username: u.username,
    displayName: u.displayName,
    bio: u.bio || '',
    avatarUrl: u.avatarUrl || '',
    isOnline: u.isOnline ?? false,
    lastSeenAt: toMs(u.lastSeenAt),
    isVerified: u.isVerified ?? false,
    createdAt: toMs(u.createdAt),
  };
};

/**
 * Normalize a message lean document.
 */
const normalizeMessage = (m) => {
  if (!m) return null;
  return {
    id: m._id?.toString() ?? m.id,
    conversationId: m.conversationId?.toString(),
    senderId: m.senderId?.toString(),
    type: m.type,
    text: m.text || null,
    attachment: m.attachment || null,
    replyToId: m.replyTo?.toString() ?? null,
    reactions: (m.reactions || []).map((r) => ({
      emoji: r.emoji,
      userId: r.userId?.toString(),
      count: r.count,
    })),
    status: m.status,
    isEdited: m.isEdited ?? false,
    localId: m.localId ?? m._id?.toString(),
    createdAt: toMs(m.createdAt),
    updatedAt: toMs(m.updatedAt),
  };
};

/**
 * Normalize a conversation lean document.
 * Members should already be populated user objects.
 */
const normalizeConversation = (c) => {
  if (!c) return null;
  return {
    id: c._id?.toString() ?? c.id,
    type: c.type,
    name: c.name || null,
    avatarUrl: c.avatarUrl || null,
    members: (c.members || []).map(normalizeUser),
    lastMessage: c.lastMessage ? normalizeMessage(c.lastMessage) : null,
    unreadCount: c.unreadCount ?? 0,
    createdAt: toMs(c.createdAt),
    updatedAt: toMs(c.updatedAt),
  };
};

/**
 * Normalize a call lean or mongoose document.
 */
const normalizeCall = (c) => {
  if (!c) return null;
  return {
    id: c._id?.toString() ?? c.id,
    callType: c.callType,
    status: c.status,
    caller: c.caller ? normalizeUser(c.caller) : c.callerId?.toString(),
    callee: c.callee ? normalizeUser(c.callee) : c.calleeId?.toString(),
    duration: c.duration ?? null,
    startedAt: toMs(c.startedAt),
    endedAt: toMs(c.endedAt),
    createdAt: toMs(c.createdAt),
    updatedAt: toMs(c.updatedAt),
  };
};

module.exports = { normalizeUser, normalizeMessage, normalizeConversation, normalizeCall };
