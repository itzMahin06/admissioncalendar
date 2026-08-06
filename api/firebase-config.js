// Vercel Serverless Function
// ---------------------------------------------------------------------------
// Reads the Firebase web config from Vercel Environment Variables (set in
// Project Settings → Environment Variables) and returns it as a small JS
// snippet that sets `window.firebaseConfig`. The HTML pages load this route
// ( /api/firebase-config.js ) *before* assets/firebase-config.js, so none of
// the actual keys ever need to be committed to the repository.
//
// Required environment variables (set these in Vercel):
//   FIREBASE_API_KEY
//   FIREBASE_AUTH_DOMAIN
//   FIREBASE_PROJECT_ID
//   FIREBASE_STORAGE_BUCKET
//   FIREBASE_MESSAGING_SENDER_ID
//   FIREBASE_APP_ID
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

  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  // Cache at the edge for 5 minutes; browsers/CDN can reuse it without
  // hitting the function on every page load.
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  res.status(200).send(`window.firebaseConfig = ${JSON.stringify(config)};`);
};
