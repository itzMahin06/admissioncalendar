/* ==========================================================================
   FIREBASE MESSAGING SERVICE WORKER
   Must live at the SITE ROOT (not inside /assets) — that's what gives it
   permission to receive push notifications for the whole site.

   Handles notifications that arrive while the site is NOT open in a tab
   (background push). Foreground handling (site open) is in
   assets/notifications.js instead.

   No Firebase keys are hardcoded here — they're fetched from
   /api/sw-firebase-config, which reads the exact same Vercel Environment
   Variables (FIREBASE_API_KEY, FIREBASE_PROJECT_ID, etc.) that
   /api/firebase-config.js already provides to the rest of the site.
   A service worker can't load that endpoint as a <script> tag the way a
   normal page does (no `window` object here), so this fetches it as JSON
   instead and initializes Firebase once it arrives.
   ========================================================================== */

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

fetch('/api/sw-firebase-config')
  .then((res) => res.json())
  .then((config) => {
    firebase.initializeApp(config);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      const { title, body } = payload.notification || {};
      const url = (payload.data && payload.data.url) || '/index.html';
      self.registration.showNotification(title || 'Admission Calendar', {
        body: body || '',
        icon: '/apple-touch-icon.png',
        badge: '/apple-touch-icon.png',
        data: { url }
      });
    });
  })
  .catch((err) => console.error('firebase-messaging-sw: failed to load config', err));

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/index.html';
  event.waitUntil(clients.openWindow(url));
});
