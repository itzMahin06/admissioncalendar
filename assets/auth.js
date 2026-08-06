/* ==========================================================================
   AUTH.JS — shared by login.html & register.html
   ========================================================================== */

function showFormMsg(el, msg, type) {
  el.textContent = msg;
  el.className = `form-msg show ${type}`;
}
function hideFormMsg(el) {
  el.className = 'form-msg';
}

function friendlyAuthError(code) {
  const map = {
    'auth/email-already-in-use': 'এই ইমেইলটি ইতিমধ্যে ব্যবহৃত হয়েছে।',
    'auth/invalid-email': 'ইমেইল ঠিকানা সঠিক নয়।',
    'auth/weak-password': 'পাসওয়ার্ড কমপক্ষে ৬ ক্যারেক্টার হতে হবে।',
    'auth/user-not-found': 'এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি।',
    'auth/wrong-password': 'পাসওয়ার্ড সঠিক নয়।',
    'auth/invalid-credential': 'ইমেইল বা পাসওয়ার্ড সঠিক নয়।',
    'auth/too-many-requests': 'অনেকবার চেষ্টা করা হয়েছে, কিছুক্ষণ পর আবার চেষ্টা করুন।',
    'auth/popup-closed-by-user': 'পপআপ বন্ধ করে দেওয়া হয়েছে।'
  };
  return map[code] || 'কিছু একটা সমস্যা হয়েছে, আবার চেষ্টা করুন।';
}

/* Create the Firestore user doc if it doesn't already exist */
async function ensureUserDoc(user, extra = {}) {
  const ref = db.collection('users').doc(user.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      name: extra.name || user.displayName || '',
      username: extra.username || '',
      email: user.email || '',
      photoURL: user.photoURL || '',
      sscGPA: extra.sscGPA ?? null,
      hscGPA: extra.hscGPA ?? null,
      sscMark: extra.sscMark ?? null,
      hscMark: extra.hscMark ?? null,
      bookmarks: [],
      role: user.email === ADMIN_EMAIL ? 'admin' : 'user',
      profileComplete: !!(extra.sscGPA && extra.hscGPA && extra.username),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true; // newly created
  }
  return false;
}

async function isUsernameTaken(username, excludeUid = null) {
  if (!username) return false;
  try {
    const doc = await db.collection('usernames').doc(username).get();
    if (!doc.exists) return false;
    if (excludeUid && doc.data().uid === excludeUid) return false; // it's the user's own current username
    return true;
  } catch (e) {
    // A real permission error here (not just "not found") means something
    // is misconfigured — fail closed on the UI hint but don't block save;
    // the actual claimUsername() write is what authoritatively enforces
    // uniqueness via Firestore rules, so a false negative here is safe.
    console.error('username availability check failed', e);
    return false;
  }
}

/* Reserves `newUsername` for this uid (and frees `oldUsername` if it was
   different). Safe to call even when nothing changed — e.g. for accounts
   that already had a `username` field saved before this reservation system
   existed, this transparently backfills their missing reservation doc on
   their next profile save. Firestore rules are still the real source of
   truth for uniqueness (a `create` on an existing doc is rejected), the
   ownership check here just avoids a wasted/rejected write for the common
   "nothing actually changed" case. */
async function claimUsername(uid, email, newUsername, oldUsername) {
  if (newUsername) {
    const ref = db.collection('usernames').doc(newUsername);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({ uid, email, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    } else if (snap.data().uid !== uid) {
      const err = new Error('username already reserved by another account');
      err.code = 'permission-denied';
      throw err;
    }
    // else: already reserved by this same user — nothing to do
  }
  if (oldUsername && oldUsername !== newUsername) {
    await db.collection('usernames').doc(oldUsername).delete().catch(() => {});
  }
}

/* Live "available / taken" hint under a username <input>, debounced.
   currentUsername (if any) is treated as always-available for that user. */
function wireUsernameAvailability(input, hintEl, currentUsername) {
  let timer = null;
  input.addEventListener('input', () => {
    const val = normalizeUsername(input.value);
    clearTimeout(timer);
    if (!val) { hintEl.textContent = ''; hintEl.className = 'field-hint'; return; }
    if (val.length < 3) { hintEl.textContent = 'কমপক্ষে ৩ ক্যারেক্টার'; hintEl.className = 'field-hint taken'; return; }
    if (!/^[a-z0-9_]+$/.test(val)) { hintEl.textContent = 'শুধু ছোট হাতের অক্ষর, সংখ্যা ও _ ব্যবহার করুন'; hintEl.className = 'field-hint taken'; return; }
    if (val === currentUsername) { hintEl.textContent = 'এটি আপনার বর্তমান ইউজারনেম'; hintEl.className = 'field-hint ok'; return; }
    hintEl.textContent = 'চেক করা হচ্ছে...'; hintEl.className = 'field-hint checking';
    timer = setTimeout(async () => {
      const taken = await isUsernameTaken(val, null);
      if (normalizeUsername(input.value) !== val) return; // input changed meanwhile
      if (taken) { hintEl.textContent = 'দুঃখিত, এই ইউজারনেমটি ব্যবহৃত হয়ে গেছে'; hintEl.className = 'field-hint taken'; }
      else { hintEl.textContent = 'ইউজারনেমটি খালি আছে ✓'; hintEl.className = 'field-hint ok'; }
    }, 450);
  });
}

/* Turns a login-page "email or username" identifier into an email address
   Firebase Auth can sign in with. */
async function resolveLoginEmail(identifier) {
  const id = identifier.trim();
  if (id.includes('@')) return id;
  const doc = await db.collection('usernames').doc(normalizeUsername(id)).get();
  if (!doc.exists) { const e = new Error('user not found'); e.code = 'auth/user-not-found'; throw e; }
  return doc.data().email;
}

/* ── REGISTER FORM ── */
function wireRegisterForm() {
  const form = document.getElementById('registerForm');
  if (!form) return;
  const msgEl = document.getElementById('formMsg');
  const submitBtn = document.getElementById('registerBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideFormMsg(msgEl);

    const name     = form.name.value.trim();
    const username = normalizeUsername(form.username.value);
    const sscGPA   = parseFloat(form.sscGPA.value);
    const hscGPA   = parseFloat(form.hscGPA.value);
    const email    = form.email.value.trim();
    const password = form.password.value;

    if (!name || !username || !email || !password) {
      showFormMsg(msgEl, 'সকল ঘর পূরণ করুন।', 'error'); return;
    }
    if (password.length < 6) {
      showFormMsg(msgEl, 'পাসওয়ার্ড কমপক্ষে ৬ ক্যারেক্টার হতে হবে।', 'error'); return;
    }
    if (username.length < 3 || !/^[a-z0-9_]+$/.test(username)) {
      showFormMsg(msgEl, 'ইউজারনেম কমপক্ষে ৩ ক্যারেক্টার এবং শুধু ছোট হাতের অক্ষর/সংখ্যা/_ হতে হবে।', 'error'); return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> প্রসেস হচ্ছে...';

    try {
      if (await isUsernameTaken(username)) {
        showFormMsg(msgEl, 'এই ইউজারনেমটি আগে থেকে ব্যবহৃত হয়েছে, অন্যটি চেষ্টা করুন।', 'error');
        return;
      }
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      await cred.user.updateProfile({ displayName: name });
      await ensureUserDoc(cred.user, { name, username, sscGPA, hscGPA });
      try {
        await claimUsername(cred.user.uid, cred.user.email, username, null);
      } catch (claimErr) {
        // Extremely rare race (someone else grabbed it between the check
        // above and now) — the account still exists, just without the
        // username reserved. Let them pick a different one from Profile.
        console.error('username claim failed', claimErr);
        showFormMsg(msgEl, 'অ্যাকাউন্ট তৈরি হয়েছে, তবে ইউজারনেমটি এই মুহূর্তে অন্য কেউ নিয়ে নিয়েছে — প্রোফাইল থেকে নতুন একটি ইউজারনেম বেছে নিন।', 'success');
        setTimeout(() => location.href = 'profile.html', 1400);
        return;
      }
      showFormMsg(msgEl, 'অ্যাকাউন্ট তৈরি হয়েছে! রিডাইরেক্ট করা হচ্ছে...', 'success');
      setTimeout(() => location.href = 'profile.html', 900);
    } catch (err) {
      console.error(err);
      showFormMsg(msgEl, friendlyAuthError(err.code), 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'রেজিস্টার করুন';
    }
  });

  const hintEl = document.getElementById('usernameHint');
  if (hintEl) wireUsernameAvailability(form.username, hintEl, null);

  const gBtn = document.getElementById('googleBtn');
  if (gBtn) gBtn.addEventListener('click', () => googleSignIn(msgEl));
}

/* ── LOGIN FORM ── */
function wireLoginForm() {
  const form = document.getElementById('loginForm');
  if (!form) return;
  const msgEl = document.getElementById('formMsg');
  const submitBtn = document.getElementById('loginBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideFormMsg(msgEl);
    const identifier = form.identifier.value.trim();
    const password = form.password.value;

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> সাইন ইন হচ্ছে...';
    try {
      const email = await resolveLoginEmail(identifier);
      await auth.signInWithEmailAndPassword(email, password);
      showFormMsg(msgEl, 'সফলভাবে সাইন ইন হয়েছে! রিডাইরেক্ট করা হচ্ছে...', 'success');
      const redirect = new URLSearchParams(location.search).get('redirect') || 'index.html';
      setTimeout(() => location.href = redirect, 700);
    } catch (err) {
      console.error(err);
      showFormMsg(msgEl, friendlyAuthError(err.code), 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'সাইন ইন করুন';
    }
  });

  const gBtn = document.getElementById('googleBtn');
  if (gBtn) gBtn.addEventListener('click', () => googleSignIn(msgEl));
}

async function googleSignIn(msgEl) {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await auth.signInWithPopup(provider);
    const isNew = await ensureUserDoc(result.user);
    if (msgEl) showFormMsg(msgEl, 'সফলভাবে সাইন ইন হয়েছে! রিডাইরেক্ট করা হচ্ছে...', 'success');
    setTimeout(() => location.href = isNew ? 'profile.html?complete=1' : (new URLSearchParams(location.search).get('redirect') || 'index.html'), 700);
  } catch (err) {
    console.error(err);
    if (msgEl) showFormMsg(msgEl, friendlyAuthError(err.code), 'error');
  }
}

/* Redirect away from login/register if already signed in */
onAuthReady((user) => {
  if (user && (document.getElementById('loginForm') || document.getElementById('registerForm'))) {
    location.href = 'profile.html';
  }
});

document.addEventListener('DOMContentLoaded', () => {
  wireLoginForm();
  wireRegisterForm();
});
