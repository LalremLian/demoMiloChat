const { generateRtcToken } = require('../config/agora');
const { v4: uuidv4 } = require('uuid');

/**
 * Generates a unique Agora channel name (UUID-based).
 * Channel names are collision-resistant and opaque to clients.
 */
const generateChannelId = () => `mc_${uuidv4().replace(/-/g, '')}`;

/**
 * Generates an Agora RTC publisher token for a caller (initiating a call).
 *
 * @param {string} channelId  - Agora channel name
 * @param {number} uid        - Numeric UID (0 = server assigns)
 * @returns {{ token: string, uid: number, expiresAt: number, channelId: string }}
 */
const generateCallerToken = (channelId, uid = 0) => {
  const { token, expiresAt } = generateRtcToken(channelId, uid, 'publisher');
  return { token, uid, expiresAt, channelId };
};

/**
 * Generates an Agora RTC publisher token for a callee (accepting a call).
 *
 * @param {string} channelId
 * @param {number} uid
 * @returns {{ token: string, uid: number, expiresAt: number }}
 */
const generateCalleeToken = (channelId, uid = 0) => {
  const { token, expiresAt } = generateRtcToken(channelId, uid, 'publisher');
  return { token, uid, expiresAt };
};

/**
 * Generates an on-demand Agora token for a given channel and uid.
 * Used by GET /api/calls/token for token refresh scenarios.
 *
 * @param {string} channelId
 * @param {number} uid
 * @returns {{ token: string, uid: number, expiresAt: number }}
 */
const generateOnDemandToken = (channelId, uid = 0) => {
  const { token, expiresAt } = generateRtcToken(channelId, uid, 'publisher');
  return { token, uid, expiresAt };
};

module.exports = {
  generateChannelId,
  generateCallerToken,
  generateCalleeToken,
  generateOnDemandToken,
};
