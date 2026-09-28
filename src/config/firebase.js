const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let firebaseInitialized = false;

/**
 * Initialises Firebase Admin SDK.
 *
 * Credential resolution order:
 *  1. FIREBASE_SERVICE_ACCOUNT_JSON env var — full JSON string (Render / Fly.io)
 *  2. FIREBASE_SERVICE_ACCOUNT_PATH env var — path to local JSON file (local dev)
 *
 * Fails gracefully if neither is set — push notifications are simply disabled.
 */
const initFirebase = () => {
  if (firebaseInitialized) return;

  try {
    let serviceAccount;

    // Option 1: JSON content as an env var (preferred for cloud deployments)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    }
    // Option 2: Path to a local JSON file (local dev)
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const filePath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
      if (!fs.existsSync(filePath)) {
        console.warn('[Firebase] Service account file not found — push notifications disabled');
        return;
      }
      serviceAccount = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    // Option 3: Neither set — skip silently
    else {
      console.warn('[Firebase] No credentials configured — push notifications disabled');
      return;
    }

    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    firebaseInitialized = true;
    console.log('[Firebase] Initialized');
  } catch (err) {
    console.warn('[Firebase] Init failed:', err.message);
  }
};

/**
 * Sends a push notification to a device token.
 * Fails silently so a missing FCM token never breaks the call flow.
 */
const sendPushNotification = async ({ token, title, body, data = {} }) => {
  if (!firebaseInitialized || !token) return;
  try {
    await admin.messaging().send({
      token,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      android: { priority: 'high' },
      apns: { payload: { aps: { contentAvailable: true, sound: 'default' } } },
    });
  } catch (err) {
    console.warn('[Firebase] Push notification failed:', err.message);
  }
};

module.exports = { initFirebase, sendPushNotification };
