/* ==========================================================================
   PROFILE.JS
   ========================================================================== */

function requireLogin() {
  onAuthReady((user, profile) => {
    if (!user) {
      showToast('এই পেজ দেখতে সাইন ইন করুন', 'fa-lock');
      setTimeout(() => location.href = 'login.html?redirect=profile.html', 900);
    } else {
      initProfilePage(user, profile);
    }
  });
}

async function initProfilePage(user, profile) {
  document.getElementById('profileLoading').style.display = 'none';
  document.getElementById('profileContent').style.display = 'block';

  document.getElementById('avatarBig').src = user.photoURL || 'https://api.dicebear.com/7.x/initials/svg?seed=' + encodeURIComponent(profile?.name || user.email);
  document.getElementById('emailDisplay').textContent = user.email;

  if (typeof wireNotifToggle === 'function') wireNotifToggle(profile);

  const form = document.getElementById('profileForm');
  form.name.value     = profile?.name || user.displayName || '';
  form.username.value = profile?.username || '';
  form.sscGPA.value    = profile?.sscGPA ?? '';
  form.hscGPA.value    = profile?.hscGPA ?? '';
  form.sscMark.value   = profile?.sscMark ?? '';
  form.hscMark.value   = profile?.hscMark ?? '';

  if (new URLSearchParams(location.search).get('complete') === '1') {
    showToast('আপনার একাডেমিক তথ্য যোগ করে প্রোফাইল সম্পূর্ণ করুন', 'fa-circle-info');
  }

  const hintEl = document.getElementById('usernameHint');
  if (hintEl) wireUsernameAvailability(form.username, hintEl, profile?.username || null);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('saveBtn');
    const msgEl = document.getElementById('profileMsg');
    hideFormMsg(msgEl);

    const username = normalizeUsername(form.username.value);
    const oldUsername = profile?.username || null;
    if (username && (username.length < 3 || !/^[a-z0-9_]+$/.test(username))) {
      showFormMsg(msgEl, 'ইউজারনেম কমপক্ষে ৩ ক্যারেক্টার এবং শুধু ছোট হাতের অক্ষর/সংখ্যা/_ হতে হবে।', 'error'); return;
    }
    if (username && username !== oldUsername) {
      const taken = await isUsernameTaken(username, user.uid);
      if (taken) { showFormMsg(msgEl, 'এই ইউজারনেমটি আগে থেকে ব্যবহৃত হয়েছে।', 'error'); return; }
    }

    const data = {
      name: form.name.value.trim(),
      username,
      sscGPA: form.sscGPA.value ? parseFloat(form.sscGPA.value) : null,
      hscGPA: form.hscGPA.value ? parseFloat(form.hscGPA.value) : null,
      sscMark: form.sscMark.value ? parseFloat(form.sscMark.value) : null,
      hscMark: form.hscMark.value ? parseFloat(form.hscMark.value) : null,
    };
    data.profileComplete = !!(data.username && data.sscGPA && data.hscGPA);

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> সেভ হচ্ছে...';
    try {
      // Claim/verify the username reservation — cheap no-op if it's already
      // correctly reserved for this account (e.g. unchanged), and this is
      // also what backfills a missing reservation doc for accounts that
      // set a username before this reservation system existed.
      await claimUsername(user.uid, user.email, username, oldUsername);
      // set(..., {merge:true}) instead of update() — update() throws if the
      // Firestore doc doesn't exist yet (e.g. an older account created
      // before profile docs were auto-created), which silently broke saving
      // for some users. merge:true creates it if missing, updates otherwise.
      await db.collection('users').doc(user.uid).set(data, { merge: true });
      profile = { ...profile, ...data };
      currentProfile = profile;
      showFormMsg(msgEl, 'প্রোফাইল সফলভাবে আপডেট হয়েছে!', 'success');
      renderEligible(profile);
    } catch (err) {
      console.error(err);
      const msg = err.code === 'permission-denied'
        ? 'এই ইউজারনেমটি এই মুহূর্তে অন্য কেউ নিয়ে নিয়েছে, অন্যটি চেষ্টা করুন।'
        : 'সেভ করতে সমস্যা হয়েছে, আবার চেষ্টা করুন।';
      showFormMsg(msgEl, msg, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'পরিবর্তন সংরক্ষণ করুন';
    }
  });

  await loadUniversitiesForProfile();
  renderBookmarks(profile);
  renderEligible(profile);

  document.getElementById('deleteBookmarksHint')?.addEventListener('click', () => {
    document.getElementById('bookmarks').scrollIntoView({ behavior: 'smooth' });
  });
}

let profileUniversities = [];
async function loadUniversitiesForProfile() {
  const snap = await db.collection('universities').orderBy('order', 'asc').get();
  profileUniversities = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.active !== false);
}

function renderBookmarks(profile) {
  const wrap = document.getElementById('bookmarkList');
  const ids = new Set(profile?.bookmarks || []);
  const items = profileUniversities.filter(u => ids.has(u.id));
  if (!items.length) {
    wrap.innerHTML = `<div class="empty-state"><i class="fa-regular fa-bookmark"></i>এখনো কোনো বিশ্ববিদ্যালয় বুকমার্ক করা হয়নি।<br><a href="index.html" style="color:var(--primary-hi);font-weight:700;">ক্যালেন্ডার দেখুন →</a></div>`;
    return;
  }
  wrap.innerHTML = items.map(u => `
    <div class="uni-row">
      <div>
        <div class="uni-name">${esc(u.name)}</div>
        <div class="uni-sub">ডেডলাইনঃ ${esc(u.deadline) || '—'}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        ${u.applyLink && u.applyLink !== '#' ? `<a href="${esc(u.applyLink)}" target="_blank" class="badge-link">Apply</a>` : ''}
        <button class="btn-icon remove-bookmark" data-uni="${u.id}" title="বুকমার্ক সরান"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`).join('');

  wrap.querySelectorAll('.remove-bookmark').forEach(btn => {
    btn.addEventListener('click', async () => {
      await db.collection('users').doc(currentUser.uid).set({
        bookmarks: firebase.firestore.FieldValue.arrayRemove(btn.dataset.uni)
      }, { merge: true });
      currentProfile.bookmarks = (currentProfile.bookmarks || []).filter(x => x !== btn.dataset.uni);
      showToast('বুকমার্ক সরানো হয়েছে', 'fa-trash');
      renderBookmarks(currentProfile);
    });
  });
}

function renderEligible(profile) {
  const wrap = document.getElementById('eligibleList');
  const summary = document.getElementById('gpaSummary');
  const ssc = parseFloat(profile?.sscGPA);
  const hsc = parseFloat(profile?.hscGPA);

  if (!ssc || !hsc) {
    summary.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> যোগ্য বিশ্ববিদ্যালয় দেখতে উপরে আপনার SSC ও HSC জিপিএ যোগ করুন।`;
    wrap.innerHTML = '';
    return;
  }
  const combined = ssc + hsc;
  summary.innerHTML = `<i class="fa-solid fa-calculator"></i> আপনার সম্মিলিত জিপিএঃ <strong>${combined.toFixed(2)}</strong> (SSC ${ssc.toFixed(2)} + HSC ${hsc.toFixed(2)})`;

  const eligible = profileUniversities.filter(u => u.requiredGPA && combined >= u.requiredGPA);
  const notEligible = profileUniversities.filter(u => u.requiredGPA && combined < u.requiredGPA);

  if (!profileUniversities.some(u => u.requiredGPA)) {
    wrap.innerHTML = `<div class="empty-state"><i class="fa-solid fa-circle-info"></i>এডমিনের পক্ষ থেকে এখনো আবেদনের জিপিএ যোগ্যতা যোগ করা হয়নি।</div>`;
    return;
  }

  wrap.innerHTML = `
    ${eligible.length ? `<p class="section-label" style="margin-top:18px;color:var(--accent)"><i class="fa-solid fa-circle-check"></i> আবেদনযোগ্য (${eligible.length})</p>` : ''}
    ${eligible.map(u => `
      <div class="uni-row">
        <div><div class="uni-name">${esc(u.name)}</div><div class="uni-sub">প্রয়োজনীয় জিপিএঃ ${u.requiredGPA}</div></div>
        ${u.applyLink && u.applyLink !== '#' ? `<a href="${esc(u.applyLink)}" target="_blank" class="badge-link">Apply</a>` : '<span class="chip">লিংক নেই</span>'}
      </div>`).join('')}
    ${notEligible.length ? `<p class="section-label" style="margin-top:18px;"><i class="fa-solid fa-circle-xmark"></i> যোগ্যতা মিলছে না (${notEligible.length})</p>` : ''}
    ${notEligible.map(u => `
      <div class="uni-row" style="opacity:.6;">
        <div><div class="uni-name">${esc(u.name)}</div><div class="uni-sub">প্রয়োজনীয় জিপিএঃ ${u.requiredGPA}</div></div>
        <span class="chip off">অনুপযুক্ত</span>
      </div>`).join('')}
  `;
}

document.addEventListener('DOMContentLoaded', requireLogin);
