/* ==========================================================================
   NOTIFICATIONS — client-side opt-in
   Two ways this gets used:
     1) Statically included on profile.html, wired to the "ডেডলাইন
        রিমাইন্ডার" toggle button there (signed-in users only).
     2) Dynamically loaded by the site-wide banner in common.js when
        ANY visitor — signed in or not — clicks "চালু করুন". That's what
        makes the admin's "custom" broadcast able to reach non-account
        visitors too.

   Every enabled token is saved to the public `subscribers` collection
   (doc ID = the token itself) regardless of login state — that's what the
   admin's custom broadcast sends to. Signed-in users ALSO get the token
   saved on their own profile (users/{uid}.fcmToken) — that's what the
   automatic 7/3/1-day bookmark reminders and the admin's per-university
   "apply"/"exam" sends target.

   Requires firebase-messaging-compat.js to be loaded before this file.
   ========================================================================== */

/* TODO: Firebase Console → Project settings → Cloud Messaging →
   "Web Push certificates" → generate/copy your VAPID key pair's public
   key and paste it here. This is a public key, safe to ship client-side.
   Until this is a real key, every "চালু করুন" click will fail — see the
   explicit check in getFcmToken() below, which turns that into a clear
   error message instead of the button silently doing nothing. */
const FCM_VAPID_KEY = "BMXlcpETyQxs8HdCp-grmSL2g0igu07c3UuP3JlEL38RgJPQJvxfBlhF92iJRG4nxIU60Kk-SqTeqVdSVmCwMlw";

async function getFcmToken() {
  // The #1 reason this silently "doesn't work" is this key never having
  // been replaced with a real one — fail loudly and specifically instead
  // of letting Firebase throw an opaque low-level error later.
  if (!FCM_VAPID_KEY || FCM_VAPID_KEY === 'YOUR_VAPID_KEY') {
    throw new Error('VAPID key এখনো সেট করা হয়নি (assets/notifications.js)');
  }
  if (!location.protocol.startsWith('https') && location.hostname !== 'localhost') {
    throw new Error('Push notification শুধু HTTPS-এ কাজ করে');
  }
  if (typeof firebase === 'undefined' || !firebase.messaging) {
    throw new Error('Firebase Messaging লোড হয়নি');
  }
  if (firebase.messaging.isSupported && !(await firebase.messaging.isSupported())) {
    throw new Error('এই ব্রাউজার push notification সাপোর্ট করে না');
  }

  // Once a browser has recorded "denied" for this site, JS can NEVER
  // re-trigger the permission popup — requestPermission() just silently
  // returns "denied" again with no dialog at all. Only the person can fix
  // this, manually, from the browser's own site settings. Detecting this
  // up front turns what looked like "the button does nothing" into a
  // specific, actionable message instead.
  if (Notification.permission === 'denied') {
    throw new Error('নোটিফিকেশন আগে ব্লক করা হয়েছে — ব্রাউজারের ঠিকানা বারে 🔒/ⓘ আইকনে ক্লিক করে সাইট সেটিংসে গিয়ে Notifications আবার "Allow" করুন, তারপর আবার চেষ্টা করুন');
  }

  console.log('[notif] requesting permission, current:', Notification.permission);
  let permission = Notification.permission;
  if (permission !== 'granted') {
    permission = await Notification.requestPermission();
  }
  console.log('[notif] permission result:', permission);
  if (permission !== 'granted') return null;

  console.log('[notif] registering service worker...');
  const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  console.log('[notif] service worker registered, requesting token...');
  const messaging = firebase.messaging();
  const token = await messaging.getToken({ vapidKey: FCM_VAPID_KEY, serviceWorkerRegistration: reg });
  console.log('[notif] token received:', token ? token.slice(0, 12) + '…' : null);
  return token || null;
}

async function enableReminderNotifications(btn) {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    showToast('আপনার ব্রাউজার নোটিফিকেশন সাপোর্ট করে না', 'fa-triangle-exclamation');
    return false;
  }
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> চালু হচ্ছে...'; }

  let token;
  try {
    token = await getFcmToken();
  } catch (err) {
    console.error('getFcmToken failed', err);
    const reason = err && err.message ? `: ${err.message}` : '';
    showToast(`নোটিফিকেশন চালু করতে সমস্যা হয়েছে${reason}`, 'fa-triangle-exclamation');
    if (btn) btn.disabled = false;
    return false;
  }
  if (!token) {
    showToast('নোটিফিকেশন পারমিশন দেওয়া হয়নি', 'fa-bell-slash');
    if (btn) btn.disabled = false;
    return false;
  }

  const isLoggedIn = typeof currentUser !== 'undefined' && !!currentUser;

  // These two writes are now independent — a failure in one (e.g. the
  // "subscribers" collection's rules not being published yet) no longer
  // wrongly fails a signed-in user's own reminder, which only needs the
  // users/{uid} write to succeed.
  //
  // BUG FIX: this used to write to a single shared subscribers/anonymous
  // document as an array field, which never matched firestore.rules (which
  // expects one document PER token, with the token as the document ID) —
  // that mismatch made Firestore reject the anonymous-visitor write every
  // time, which is exactly what showed up as "approve করার পরেও সমস্যা"
  // for people using the site-wide banner without an account.
  let subscribersOk = true, userDocOk = true;

  try {
    await db.collection('subscribers').doc(token).set({
      token,
      uid: isLoggedIn ? currentUser.uid : null,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    subscribersOk = false;
    console.error('subscribers write failed — is the latest firestore.rules published?', err);
  }

  if (isLoggedIn) {
    try {
      await db.collection('users').doc(currentUser.uid).set({
        fcmToken: token,
        notifEnabledAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (err) {
      userDocOk = false;
      console.error('users.fcmToken write failed', err);
    }
  }

  try {
    localStorage.setItem('notifToken', token);
    localStorage.setItem('notifEnabled', '1');
  } catch (e) {}

  if (btn) btn.disabled = false;

  // A signed-in person's own reminders depend only on userDocOk; an
  // anonymous visitor's depend only on subscribersOk.
  const succeeded = isLoggedIn ? userDocOk : subscribersOk;
  if (succeeded) {
    showToast('রিমাইন্ডার চালু হয়েছে ✓', 'fa-solid fa-bell');
    updateNotifButtonState(true);
    return true;
  }
  showToast('সেভ করতে সমস্যা হয়েছে — firestore.rules Firebase Console-এ পাবলিশ করা আছে কিনা চেক করুন', 'fa-triangle-exclamation');
  return false;
}

async function disableReminderNotifications(btn) {
  if (btn) btn.disabled = true;
  try {
    if (typeof currentUser !== 'undefined' && currentUser) {
      await db.collection('users').doc(currentUser.uid).set({
        fcmToken: firebase.firestore.FieldValue.delete()
      }, { merge: true });
    }
    // Note: clients can't delete their own subscribers/{token} doc (rules
    // block client-side delete on purpose, so no one can guess/delete
    // someone else's token doc either). This stops targeting from this
    // device going forward; the token naturally gets pruned server-side
    // the next time a send to it fails (uninstalled app, revoked
    // permission, etc).
    try { localStorage.removeItem('notifEnabled'); } catch (e) {}

    showToast('রিমাইন্ডার বন্ধ করা হয়েছে', 'fa-bell-slash');
    updateNotifButtonState(false);
  } catch (err) {
    console.error(err);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function updateNotifButtonState(enabled) {
  const btn = document.getElementById('notifToggleBtn');
  if (!btn) return;
  btn.dataset.enabled = enabled ? '1' : '0';
  btn.innerHTML = enabled
    ? '<i class="fa-solid fa-bell"></i> রিমাইন্ডার চালু আছে'
    : '<i class="fa-regular fa-bell"></i> ডেডলাইন রিমাইন্ডার চালু করুন';
  btn.classList.toggle('notif-on', enabled);
}

function wireNotifToggle(profile) {
  const btn = document.getElementById('notifToggleBtn');
  if (!btn) return;
  if (btn.dataset.wired === '1') { updateNotifButtonState(!!(profile && profile.fcmToken)); return; }
  btn.dataset.wired = '1';
  updateNotifButtonState(!!(profile && profile.fcmToken));
  btn.addEventListener('click', () => {
    try {
      if (btn.dataset.enabled === '1') disableReminderNotifications(btn);
      else enableReminderNotifications(btn);
    } catch (err) {
      // Belt-and-suspenders: enableReminderNotifications/disable... already
      // catch their own errors, but if something throws synchronously
      // before even reaching their try block, this guarantees the person
      // sees *something* instead of the button just appearing dead.
      console.error('notif toggle click failed', err);
      showToast('একটি সমস্যা হয়েছে: ' + (err.message || err), 'fa-triangle-exclamation');
    }
  });
}

// Safety net: wire the button as soon as the DOM is ready, independent of
// profile.js remembering to call wireNotifToggle(profile). This means the
// button will always at least be clickable (falling back to showing the
// "not yet enabled" label) even if that call is ever skipped for any
// reason — wireNotifToggle() is written to be a no-op the second time, so
// there's no conflict when profile.js's own (state-aware) call also runs.
document.addEventListener('DOMContentLoaded', () => wireNotifToggle(null));

// Foreground messages (site already open in this tab) — shown as an
// in-page toast, since some browsers suppress OS notifications while the
// tab is focused. Wired as soon as this file loads, whether that's
// statically (profile.html) or dynamically (the site-wide banner).
try {
  if (typeof firebase !== 'undefined' && firebase.messaging) {
    firebase.messaging().onMessage((payload) => {
      const { title, body } = payload.notification || {};
      if (typeof showToast === 'function') showToast(`${title || ''}${body ? ' — ' + body : ''}`, 'fa-solid fa-bell');
    });
  }
} catch (e) { /* messaging not supported in this browser */ }
