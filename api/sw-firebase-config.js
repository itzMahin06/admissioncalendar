// Vercel Serverless Function
// ---------------------------------------------------------------------------
// Same Firebase web config as /api/firebase-config.js, reading from the same
// Vercel Environment Variables — but returned as plain JSON instead of a
// `window.firebaseConfig = ...` script. Service workers have no `window`,
// so firebase-messaging-sw.js fetch()es this endpoint instead of loading
// /api/firebase-config.js as a <script> tag the way normal pages do.
//
// Uses the exact same environment variables you've already set for
// /api/firebase-config.js — nothing new to configure here.
// ---------------------------------------------------------------------------

module.exports = (req, res) => {
  const config = {
    apiKey: process.env.FIREBASE_API_KEY || "",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.FIREBASE_APP_ID || "",
  };

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  res.status(200).json(config);
};
