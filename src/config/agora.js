const { RtcTokenBuilder, RtcRole } = require('agora-access-token');

/**
 * Generates a short-lived Agora RTC token for a channel.
 * The App Certificate is kept server-side only — never sent to clients.
 *
 * @param {string} channelName  - Agora channel name
 * @param {number} uid          - Numeric UID for the user (0 = server assigns)
 * @param {'publisher'|'subscriber'} role
 * @returns {{ token: string, expiresAt: number }}
 */
const generateRtcToken = (channelName, uid = 0, role = 'publisher') => {
  const appId = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;
  const expirySeconds = parseInt(process.env.AGORA_TOKEN_EXPIRY || '3600', 10);

  if (!appId || !appCertificate) {
    throw new Error('AGORA_APP_ID and AGORA_APP_CERTIFICATE must be set in environment variables');
  }

  const rtcRole = role === 'subscriber' ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpireTime = currentTimestamp + expirySeconds;

  const token = RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    uid,
    rtcRole,
    privilegeExpireTime
  );

  return { token, expiresAt: privilegeExpireTime };
};

module.exports = { generateRtcToken };
