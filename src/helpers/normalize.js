/**
 * Normalize helpers — strip internal fields before sending to clients.
 */

const normalizeConversation = (conv) => {
  if (!conv) return conv;
  const { __v, ...rest } = conv;
  return rest;
};

const normalizeMessage = (msg) => {
  if (!msg) return msg;
  const { __v, ...rest } = msg;
  return rest;
};

module.exports = { normalizeConversation, normalizeMessage };
