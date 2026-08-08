/* ==========================================================================
   COMMON.JS — loaded on every page (after firebase-config.js)
   Renders header/footer, handles theme, mobile nav, toast, auth-aware UI.
   ========================================================================== */

const LOGO_URL = "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhCYY5WgDdWc6kowVbEWCCFwuZZgfxhKnwtZK_6YSWXFTVUjRA18HeB-xuL7aG6FVFoF-nSKmoIzaq22GzbBM4550-bE86WcxKL39hfKLTvZR0FgDW_fIvR8fMxOR9xzu30fFIve7xHIrFcbi0rLbMwEE3Zv8ZQDXx0F9pWLydZG7nPP0Rg24EptFpTEl7f/s1600/%E0%A6%8F%E0%A6%A1%E0%A6%AE%E0%A6%BF%E0%A6%B6%E0%A6%A8%20%E0%A6%95%E0%A7%8D%E0%A6%AF%E0%A6%BE%E0%A6%B2%E0%A7%87%E0%A6%A8%E0%A7%8D%E0%A6%A1%E0%A6%BE%E0%A6%B0_20251220_022531_0000.png";

const NAV_LINKS = [
  { href: "index.html",   label: "ক্যালেন্ডার", icon: "fa-solid fa-calendar-days" },
  { href: "videos.html",  label: "ভিডিও", icon: "fa-brands fa-youtube" },
  { href: "about.html",   label: "আমাদের সম্পর্কে", icon: "fa-solid fa-circle-info" },
  { href: "privacy.html", label: "প্রাইভেসি", icon: "fa-solid fa-shield-halved" },
  { href: "contact.html", label: "যোগাযোগ", icon: "fa-solid fa-envelope" }
];

/* ── RENDER HEADER + FOOTER ── */
function renderChrome() {
  const path = location.pathname.split('/').pop() || 'index.html';

  document.getElementById('site-header').innerHTML = `
    <header>
      <a href="index.html" class="brand-link" title="Admission Calendar">
        <img src="${LOGO_URL}" alt="Logo">
        <span>Admission Calendar</span>
      </a>
      <nav class="main-nav">
        ${NAV_LINKS.map(l => `<a href="${l.href}" class="${path === l.href ? 'active' : ''}"><i class="${l.icon}"></i> ${l.label}</a>`).join('')}
      </nav>
      <div class="header-right">
        <button class="btn-icon" id="themeToggle" title="থিম পরিবর্তন" aria-label="Toggle theme">
          <i class="fa-solid fa-moon" id="themeIcon"></i>
        </button>
        <a class="btn-icon" href="profile.html#bookmarks" id="bookmarkIcon" title="বুকমার্ক">
          <i class="fa-regular fa-bookmark"></i>
        </a>
        <div class="header-menu-wrap">
          <button class="btn-icon" id="profileBtn" title="প্রোফাইল"><i class="fa-regular fa-user"></i></button>
          <div class="header-dropdown" id="profileDropdown"></div>
        </div>
        <button class="btn-icon hamburger" id="hamburgerBtn" title="মেনু"><i class="fa-solid fa-bars"></i></button>
      </div>
    </header>
    <div class="mobile-nav" id="mobileNav">
      ${NAV_LINKS.map(l => `<a href="${l.href}"><i class="${l.icon}"></i> ${l.label}</a>`).join('')}
    </div>
  `;

  document.getElementById('site-footer').innerHTML = `
    <footer>
      <div class="foot-links">
        <a href="about.html">আমাদের সম্পর্কে</a>
        <a href="privacy.html">প্রাইভেসি পলিসি</a>
        <a href="contact.html">যোগাযোগ</a>
      </div>
      © <span id="year"></span> <a href="https://www.youtube.com/@itzMahin" target="_blank">Mahin's Classroom</a>. All rights reserved.
    </footer>
  `;
  document.getElementById('year').textContent = new Date().getFullYear();

  wireTheme();
  wireMobileNav();
  wireProfileDropdown();

  /* Always reflect the real auth state on the header, no matter whether
     Firebase's auth check finished before or after this render. */
  onAuthReady((user, profile) => {
    user ? renderUserMenu(user, profile) : renderGuestMenu();
  });
}

/* ── THEME TOGGLE ── */
function wireTheme() {
  const html = document.documentElement;
  const icon = document.getElementById('themeIcon');
  let theme = localStorage.getItem('theme') || 'light';
  apply(theme); // instant — no .theme-anim class here, so no fade on page load
  document.getElementById('themeToggle').addEventListener('click', () => {
    html.classList.add('theme-anim');
    theme = theme === 'dark' ? 'light' : 'dark';
    apply(theme);
    localStorage.setItem('theme', theme);
    setTimeout(() => html.classList.remove('theme-anim'), 350);
  });
  function apply(t) {
    html.setAttribute('data-theme', t);
    icon.className = t === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }
}

/* ── MOBILE NAV ── */
function wireMobileNav() {
  const btn = document.getElementById('hamburgerBtn');
  const nav = document.getElementById('mobileNav');
  btn.addEventListener('click', () => {
    nav.classList.toggle('open');
    btn.innerHTML = nav.classList.contains('open') ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
  });
}

/* ── PROFILE DROPDOWN ──
   One single click handler, not two. Previously wireProfileDropdown()
   always attached a toggle-the-dropdown listener via addEventListener,
   and renderGuestMenu() *separately* set btn.onclick to redirect to
   login — both fired on the same click (an empty dropdown box would
   flash open first, then the login redirect happened 500ms later),
   which looked broken/unresponsive. Now there's exactly one listener
   that checks the live auth state at click-time. */
function wireProfileDropdown() {
  const btn = document.getElementById('profileBtn');
  const dd = document.getElementById('profileDropdown');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!currentUser) {
      showAuthToast();
      const here = location.pathname.split('/').pop() || 'index.html';
      setTimeout(() => { location.href = 'login.html?redirect=' + encodeURIComponent(here); }, 500);
      return;
    }
    dd.classList.toggle('open');
  });
  document.addEventListener('click', () => dd.classList.remove('open'));
}

function renderGuestMenu() {
  const btn = document.getElementById('profileBtn');
  btn.innerHTML = '<i class="fa-regular fa-user"></i>';
  btn.title = 'সাইন ইন করুন';
  document.getElementById('profileDropdown').innerHTML = '';
  document.getElementById('profileDropdown').classList.remove('open');
}

function renderUserMenu(user, profile) {
  const btn = document.getElementById('profileBtn');
  btn.title = 'প্রোফাইল';
  if (user.photoURL) {
    btn.innerHTML = `<img class="avatar-icon" src="${user.photoURL}" alt="avatar">`;
  } else {
    btn.innerHTML = `<i class="fa-solid fa-user"></i>`;
  }
  const isAdmin = user.email === ADMIN_EMAIL;
  document.getElementById('profileDropdown').innerHTML = `
    <div style="padding:8px 10px 4px;font-size:.8rem;font-weight:700;">${(profile && (profile.name || profile.username)) || user.displayName || 'ইউজার'}</div>
    <div style="padding:0 10px 8px;font-size:.72rem;color:var(--text-muted);">${user.email}</div>
    <hr>
    <a href="profile.html"><i class="fa-regular fa-id-card"></i> প্রোফাইল</a>
    <a href="profile.html#bookmarks"><i class="fa-solid fa-bookmark"></i> বুকমার্ক</a>
    ${isAdmin ? '<a href="admin.html"><i class="fa-solid fa-user-shield"></i> অ্যাডমিন প্যানেল</a>' : ''}
    <hr>
    <button id="logoutBtn"><i class="fa-solid fa-right-from-bracket"></i> লগ আউট</button>
  `;
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await auth.signOut();
    showToast('আপনি লগ আউট হয়েছেন', 'fa-circle-check');
    setTimeout(() => location.href = 'index.html', 700);
  });
}

/* ── TOAST ── */
function ensureToastStack() {
  if (!document.getElementById('toast-stack')) {
    const d = document.createElement('div');
    d.id = 'toast-stack';
    document.body.appendChild(d);
  }
  return document.getElementById('toast-stack');
}
function showToast(msg, icon = 'fa-circle-info') {
  const stack = ensureToastStack();
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<i class="fa-solid ${icon}"></i><span>${msg}</span>`;
  stack.appendChild(t);
  setTimeout(() => {
    t.classList.add('leaving');
    setTimeout(() => t.remove(), 300);
  }, 3400);
}
function showAuthToast() {
  showToast('ফুল অ্যাক্সেস ও প্রিমিয়াম ফিচারের জন্য সাইন ইন/সাইন আপ করুন', 'fa-lock');
}

/* ── AUTH STATE (global) ── */
let currentUser = null;
let currentProfile = null;
let authStateResolved = false;
const authReadyCallbacks = [];

/* Safe way to react to auth state: fires immediately with the current
   (already-resolved) user/profile if Firebase already finished checking,
   otherwise queues the callback for the moment it does. This avoids the
   race where `document.addEventListener('authReady', ...)` gets added
   AFTER the 'authReady' event already fired once and was missed. */
function onAuthReady(cb) {
  if (authStateResolved) cb(currentUser, currentProfile);
  else authReadyCallbacks.push(cb);
}

auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  currentProfile = null;
  if (user) {
    try {
      const snap = await db.collection('users').doc(user.uid).get();
      currentProfile = snap.exists ? snap.data() : null;
    } catch (e) { console.error('profile fetch error', e); }
  }
  if (document.getElementById('profileBtn')) {
    user ? renderUserMenu(user, currentProfile) : renderGuestMenu();
  }
  authStateResolved = true;
  authReadyCallbacks.splice(0).forEach(cb => cb(currentUser, currentProfile));
  document.dispatchEvent(new CustomEvent('authReady', { detail: { user, profile: currentProfile } }));
});

/* ── HELPERS ── */
/* ── FIRESTORE READ CACHE ──
   Cuts Firestore read usage way down for public, frequently-viewed
   collections (universities, videos). Without this, every single page
   navigation on this multi-page site re-fetches the WHOLE collection
   from scratch — e.g. 50 universities viewed by 1,000 visitors browsing
   3 pages each is 150,000 reads for data that barely changes.

   Strategy: keep one tiny shared doc (meta/versions) with a timestamp per
   collection, bumped by admin.js only when that collection actually
   changes. On page load, we check ONLY that tiny doc first (1 cheap
   read) — if its timestamp matches what we last cached locally, we reuse
   the local copy and skip the big read entirely. If it doesn't match (or
   we've never cached it), we fetch the real collection and store the new
   timestamp alongside it. A short fallback TTL covers the rare case where
   even the version check itself fails (e.g. a network hiccup). */
const CACHE_FALLBACK_TTL_MS = 30 * 60 * 1000; // 30 min safety net

function versionToMillis(v) {
  if (v == null) return null;
  if (typeof v.toMillis === 'function') return v.toMillis(); // Firestore Timestamp
  return v;
}

// Multiple getCachedCollection() calls on the same page (e.g. index.html
// loads both "universities" and "videos") share ONE fetch of the tiny
// version doc instead of each fetching it separately.
let _versionsDocPromise = null;
function getVersionsDoc() {
  if (!_versionsDocPromise) {
    _versionsDocPromise = db.collection('meta').doc('versions').get()
      .then(doc => (doc.exists ? doc.data() : {}))
      .catch(e => { console.error('meta/versions fetch failed, falling back to TTL', e); return null; });
  }
  return _versionsDocPromise;
}

async function getCachedCollection(name, fetchFn) {
  const dataKey = `fscache_${name}`;
  const verKey = `fscache_${name}_v`;

  const versions = await getVersionsDoc();
  const serverVersion = versions ? versionToMillis(versions[name]) : null;

  try {
    const cachedRaw = localStorage.getItem(dataKey);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw);
      const cachedVer = localStorage.getItem(verKey);
      const versionMatches = serverVersion !== null && String(serverVersion) === cachedVer;
      const withinFallbackTtl = Date.now() - (cached.ts || 0) < CACHE_FALLBACK_TTL_MS;
      // Best case: the version doc confirms nothing changed — reuse the
      // cache regardless of age. Fallback case: the version check itself
      // failed, so only trust the cache if it's still reasonably fresh.
      if (versionMatches || (serverVersion === null && withinFallbackTtl)) {
        return cached.data;
      }
    }
  } catch (e) { /* corrupt cache — ignore, fetch fresh below */ }

  const data = await fetchFn();
  try {
    localStorage.setItem(dataKey, JSON.stringify({ data, ts: Date.now() }));
    if (serverVersion !== null) localStorage.setItem(verKey, String(serverVersion));
  } catch (e) { /* storage full/unavailable — not fatal, just skip caching this time */ }
  return data;
}

function toBn(n) { return String(n).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]); }

/* Shared by register/login/profile — the single canonical way a raw
   username input gets normalized before checking availability or saving,
   so the same string always maps to the same usernames/{id} doc. */
function normalizeUsername(u) { return (u || '').trim().toLowerCase().replace(/\s+/g, ''); }

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}

/* ── SITE-WIDE "TURN ON NOTIFICATIONS" BANNER ──
   Shown on every page (signed in or not) so anonymous visitors can opt in
   too — that's what lets the admin's custom broadcast reach people without
   an account. Doesn't load the Firebase Messaging SDK or
   assets/notifications.js at all unless the person actually clicks
   "চালু করুন", so pages that never touch this stay just as light as before. */
function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}
async function loadNotifModule() {
  await loadScriptOnce('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
  await loadScriptOnce('assets/notifications.js');
}

function initNotifBanner() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
  if (Notification.permission === 'granted' || Notification.permission === 'denied') return;
  // profile.html has its own dedicated "ডেডলাইন রিমাইন্ডার" toggle already
  // — showing this generic banner there too is redundant and risks the
  // person clicking the wrong one and thinking nothing happened.
  if ((location.pathname.split('/').pop() || 'index.html') === 'profile.html') return;

  try {
    const dismissedAt = localStorage.getItem('notifBannerDismissed');
    if (dismissedAt && (Date.now() - Number(dismissedAt)) / 3600000 < 72) return; // 3-day cooldown after dismiss
  } catch (e) {}

  setTimeout(() => {
    const bar = document.createElement('div');
    bar.className = 'notif-banner';
    bar.id = 'notifBanner';
    bar.innerHTML = `
      <i class="fa-solid fa-bell notif-banner-icon"></i>
      <span class="notif-banner-text">সব ভর্তি সংক্রান্ত রিমাইন্ডার পেতে নোটিফিকেশন চালু করুন</span>
      <button class="notif-banner-btn" id="notifBannerEnable" type="button">চালু করুন</button>
      <button class="notif-banner-close" id="notifBannerClose" type="button" aria-label="বন্ধ করুন"><i class="fa-solid fa-xmark"></i></button>`;
    document.body.appendChild(bar);
    requestAnimationFrame(() => bar.classList.add('open'));

    const dismiss = () => {
      bar.classList.remove('open');
      try { localStorage.setItem('notifBannerDismissed', String(Date.now())); } catch (e) {}
      setTimeout(() => bar.remove(), 300);
    };
    document.getElementById('notifBannerClose').addEventListener('click', dismiss);
    document.getElementById('notifBannerEnable').addEventListener('click', async () => {
      const enableBtn = document.getElementById('notifBannerEnable');
      if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        showToast('আপনার ব্রাউজার নোটিফিকেশন সাপোর্ট করে না', 'fa-triangle-exclamation');
        return;
      }
      enableBtn.disabled = true;
      enableBtn.textContent = '...';
      try {
        // Ask for permission FIRST, before loading anything else. Some
        // browsers only honor Notification.requestPermission() while it's
        // still clearly tied to the click that triggered it — loading the
        // Firebase SDK over the network first (as this used to do) could
        // eat into that window and cause the prompt to silently fail,
        // which is exactly what non-account visitors were hitting here.
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          showToast('নোটিফিকেশন পারমিশন দেওয়া হয়নি', 'fa-bell-slash');
          enableBtn.disabled = false; enableBtn.textContent = 'চালু করুন';
          return;
        }
        await loadNotifModule();
        const ok = await window.enableReminderNotifications();
        if (ok) dismiss();
        else { enableBtn.disabled = false; enableBtn.textContent = 'চালু করুন'; }
      } catch (err) {
        console.error(err);
        showToast('নোটিফিকেশন চালু করতে সমস্যা হয়েছে: ' + (err.message || ''), 'fa-triangle-exclamation');
        enableBtn.disabled = false;
        enableBtn.textContent = 'চালু করুন';
      }
    });
  }, 2500);
}

document.addEventListener('DOMContentLoaded', () => {
  renderChrome();
  initNotifBanner();
});

/* ── SHARED TOP BANNER STACK ──
   Both the install-app banner and the notification banner live here now
   (top of screen, stacked in normal flow) instead of being independent
   fixed-bottom bars — this is what moves the notification prompt to the
   top, and lets both banners coexist without overlapping each other. */
function getTopBannerStack() {
  let stack = document.getElementById('topBannerStack');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'topBannerStack';
    document.body.prepend(stack);
  }
  return stack;
}

/* ── INSTALL APP BANNER (index.html + calendar-only.html only) ── */
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
});
window.addEventListener('appinstalled', () => {
  try { localStorage.setItem('appInstalled', '1'); } catch (e) {}
  const bar = document.getElementById('installBanner');
  if (bar) bar.remove();
});

function isStandaloneApp() {
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
         window.navigator.standalone === true;
}

function initInstallBanner() {
  try {
    if (localStorage.getItem('appInstalled') === '1') return;
  } catch (e) {}
  if (isStandaloneApp()) return;

  try {
    const dismissedAt = localStorage.getItem('installBannerDismissed');
    // Re-show every 1 hour if they haven't installed, as requested —
    // shorter than the notification banner's cooldown on purpose, since
    // installing is a much lower-commitment ask than granting a
    // permission, so re-prompting sooner is reasonable here.
    if (dismissedAt && (Date.now() - Number(dismissedAt)) / 3600000 < 1) return;
  } catch (e) {}

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (!isIOS && !deferredInstallPrompt) {
    // The browser's install-eligibility event may not have fired yet at
    // this exact moment — give it a couple seconds and check again once,
    // rather than giving up immediately.
    setTimeout(() => { if (deferredInstallPrompt) showInstallBanner(isIOS); }, 2000);
    return;
  }
  showInstallBanner(isIOS);
}

function showInstallBanner(isIOS) {
  if (document.getElementById('installBanner')) return;
  const bar = document.createElement('div');
  bar.className = 'install-banner';
  bar.id = 'installBanner';
  bar.innerHTML = `
    <img src="apple-touch-icon.png" alt="Admission Calendar" class="install-banner-logo">
    <div class="install-banner-text">
      <strong>Admission Calendar অ্যাপ ইনস্টল করুন</strong>
      <span>${isIOS ? 'Share বাটনে ট্যাপ করে "Add to Home Screen" বেছে নিন' : 'দ্রুত অ্যাক্সেসের জন্য হোম স্ক্রিনে যোগ করুন'}</span>
    </div>
    ${isIOS ? '' : '<button class="install-banner-btn" id="installBannerBtn" type="button">ইনস্টল করুন</button>'}
    <button class="install-banner-close" id="installBannerClose" type="button" aria-label="বন্ধ করুন"><i class="fa-solid fa-xmark"></i></button>
  `;
  getTopBannerStack().appendChild(bar);
  requestAnimationFrame(() => bar.classList.add('open'));

  function dismiss() {
    bar.classList.remove('open');
    try { localStorage.setItem('installBannerDismissed', String(Date.now())); } catch (e) {}
    setTimeout(() => bar.remove(), 300);
  }
  document.getElementById('installBannerClose').addEventListener('click', dismiss);
  const installBtn = document.getElementById('installBannerBtn');
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) { dismiss(); return; }
      installBtn.disabled = true;
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      if (outcome === 'accepted') {
        try { localStorage.setItem('appInstalled', '1'); } catch (e) {}
      }
      dismiss();
    });
  }
}

