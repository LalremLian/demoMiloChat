const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let firebaseInitialized = false;

const initFirebase = () => {
  if (firebaseInitialized) return;
  const serviceAccountPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
  if (!fs.existsSync(serviceAccountPath)) {
    console.warn('Firebase service account file not found — push notifications disabled');
    return;
  }
  try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    firebaseInitialized = true;
    console.log('Firebase initialized');
  } catch (err) {
    console.warn('Firebase init failed:', err.message);
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
    console.warn('Push notification failed:', err.message);
  }
};

module.exports = { initFirebase, sendPushNotification };
