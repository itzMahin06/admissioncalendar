/* ==========================================================================
   FIREBASE INIT
   --------------------------------------------------------------------------
   The firebaseConfig values now come from Vercel Environment Variables,
   injected at request time by /api/firebase-config.js (loaded as a <script>
   tag right before this file on every page). You do NOT need to hardcode
   your Firebase keys in this file anymore — set them in:
   Vercel Dashboard → Project → Settings → Environment Variables

     FIREBASE_API_KEY
     FIREBASE_AUTH_DOMAIN
     FIREBASE_PROJECT_ID
     FIREBASE_STORAGE_BUCKET
     FIREBASE_MESSAGING_SENDER_ID
     FIREBASE_APP_ID

   (For local development without Vercel, you can temporarily hardcode
   window.firebaseConfig = { apiKey: "...", ... } above this script tag,
   or run `vercel dev` which serves /api routes locally too.)
   ========================================================================== */
firebase.initializeApp(window.firebaseConfig);

const auth = firebase.auth();
const db   = firebase.firestore();

/* Admin email — only this account can access admin.html */
const ADMIN_EMAIL = "info.itzmahin@gmail.com";
