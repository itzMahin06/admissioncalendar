/* ==========================================================================
   api/_lib/notify-helpers.js
   Shared by api/send-reminders.js (daily cron) and
   api/admin-send-notification.js (admin panel manual sends). Files inside
   an api/_lib folder are ignored by Vercel's routing (the leading
   underscore is a documented convention), so this never becomes its own
   accidental endpoint.
   ========================================================================== */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
  });
}
const db = admin.firestore();
const messaging = admin.messaging();

/* Same parsing rules as assets/calendar.js's parseCountdown() — handles
   both the current datetime-local format ("2026-08-15T23:59") and the
   legacy "DD-MM-YYYY HH:MM" text format from older entries. */
function parseCountdown(str) {
  if (!str) return null;
  let date;
  if (str.includes('T')) {
    date = new Date(str);
  } else {
    const [datePart, timePart] = str.split(' ');
    if (!datePart) return null;
    const parts = datePart.split('-').map(Number);
    if (parts.length !== 3) return null;
    const [d, m, y] = parts;
    let h = 0, mn = 0;
    if (timePart) {
      const t = timePart.split(':').map(Number);
      h = t[0] || 0; mn = t[1] || 0;
    }
    date = new Date(y, m - 1, d, h, mn, 0);
  }
  return isNaN(date.getTime()) ? null : date;
}

/* Whole calendar days between today and the target date. */
function daysUntil(date) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((startOfTarget - startOfToday) / 86400000);
}

/* Must match ADMIN_EMAIL in assets/firebase-config.js. Not sensitive (an
   email address, not a secret) — kept as a plain constant here too rather
   than requiring yet another environment variable just for this. */
const ADMIN_EMAIL = "info.itzmahin@gmail.com";

/* Verifies the request actually came from the signed-in admin — never
   trust a client-sent "I'm the admin" flag. Throws if invalid. */
async function requireAdmin(idToken) {
  if (!idToken) throw Object.assign(new Error('Missing ID token'), { statusCode: 401 });
  const decoded = await admin.auth().verifyIdToken(idToken);
  if (decoded.email !== ADMIN_EMAIL) {
    throw Object.assign(new Error('Not authorized'), { statusCode: 403 });
  }
  return decoded;
}

/* Sends one notification to many tokens, in chunks of 500 (FCM's per-call
   multicast limit), and cleans up any tokens that are no longer valid
   (uninstalled, notifications blocked, etc). Returns { sent, failed }. */
async function sendToTokens(tokens, title, body, url, onDeadToken) {
  const uniqueTokens = [...new Set(tokens)].filter(Boolean);
  let sent = 0, failed = 0;

  for (let i = 0; i < uniqueTokens.length; i += 500) {
    const chunk = uniqueTokens.slice(i, i + 500);
    const res = await messaging.sendEachForMulticast({
      tokens: chunk,
      notification: { title, body },
      webpush: { fcmOptions: { link: url || 'https://admissioncalendar.maahin.my.id/index.html' } }
    });
    sent += res.successCount;
    failed += res.failureCount;

    res.responses.forEach((r, idx) => {
      if (!r.success && r.error && r.error.code === 'messaging/registration-token-not-registered') {
        if (onDeadToken) onDeadToken(chunk[idx]);
      }
    });
  }
  return { sent, failed };
}

module.exports = { admin, db, messaging, parseCountdown, daysUntil, requireAdmin, sendToTokens };
