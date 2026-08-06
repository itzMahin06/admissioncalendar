/* ==========================================================================
   ADMIN.JS — protected by ADMIN_EMAIL check
   ========================================================================== */

function guardAdmin() {
  onAuthReady((user) => {
    if (!user) {
      showToast('অ্যাডমিন প্যানেল দেখতে সাইন ইন করুন', 'fa-lock');
      setTimeout(() => location.href = 'login.html?redirect=admin.html', 900);
      return;
    }
    if (user.email !== ADMIN_EMAIL) {
      showToast('এই পেজে প্রবেশের অনুমতি নেই', 'fa-ban');
      setTimeout(() => location.href = 'index.html', 900);
      return;
    }
    document.getElementById('adminLoading').style.display = 'none';
    document.getElementById('adminContent').style.display = 'block';
    initAdmin();
  });
}

/* ── DATE HELPERS ──
   Formats a datetime-local value ("2026-08-15T23:59") into the short
   English display text used across the site ("Aug 15, 2026"), so admins
   don't have to type the same date twice in two different fields (the
   old #1 cause of countdown/deadline text mismatches or empty countdowns
   when one of the two fields was forgotten). */
function formatDisplayDate(isoLocal) {
  if (!isoLocal) return '';
  const d = new Date(isoLocal);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}
/* Wires a datetime-local input to auto-fill a text input with a formatted
   date, but only while the text field is still empty or was itself last
   auto-filled — so a manually customized display text (e.g. "শীঘ্রই ঘোষণা")
   never gets silently overwritten. */
function wireAutoFillDate(dtInput, textInput) {
  dtInput.addEventListener('change', () => {
    if (!textInput.value || textInput.dataset.autofilled === '1') {
      textInput.value = formatDisplayDate(dtInput.value);
      textInput.dataset.autofilled = '1';
    }
  });
  textInput.addEventListener('input', () => { textInput.dataset.autofilled = '0'; });
}

/* ── CACHE INVALIDATION ──
   Called after any write to a collection that assets/calendar.js caches
   client-side for visitors (see getCachedCollection() in common.js). This
   is what makes admin changes show up on the next page load for visitors
   instead of waiting out the full fallback TTL. */
async function bumpVersion(name) {
  try {
    await db.collection('meta').doc('versions').set({
      [name]: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.error(`bumpVersion(${name}) failed`, e);
  }
}

/* ── TAB SWITCH ── */
function wireAdminTabs() {
  document.querySelectorAll('.a-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.a-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('asec-' + btn.dataset.target).classList.add('active');
    });
  });
}

/* ==========================================================================
   UNIVERSITIES CRUD
   ========================================================================== */
let uniCache = [];

async function loadUniAdmin() {
  const snap = await db.collection('universities').orderBy('order', 'asc').get();
  uniCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderUniTable(uniCache);
  populateNotifDropdowns();
}

function renderUniTable(list) {
  const tbody = document.getElementById('uniTableBody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted);">কোনো বিশ্ববিদ্যালয় পাওয়া যায়নি।</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(u => {
    const units = Array.isArray(u.examUnits) ? u.examUnits : [];
    const examCell = units.length > 1
      ? `${toBn(units.length)}টি ইউনিট`
      : (units[0]?.examDate || u.examDate || '—');
    return `
    <tr>
      <td><strong>${esc(u.name)}</strong></td>
      <td>${esc(u.deadline) || '—'}</td>
      <td>${esc(examCell)}</td>
      <td>${u.requiredGPA || '—'}</td>
      <td>${u.active !== false ? '<span class="chip on">সক্রিয়</span>' : '<span class="chip off">নিষ্ক্রিয়</span>'}</td>
      <td style="display:flex;gap:6px;">
        <button class="btn btn-outline btn-sm edit-uni" data-id="${u.id}"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-danger btn-sm del-uni" data-id="${u.id}"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.edit-uni').forEach(b => b.addEventListener('click', () => openUniModal(b.dataset.id)));
  tbody.querySelectorAll('.del-uni').forEach(b => b.addEventListener('click', () => deleteUni(b.dataset.id)));
}

function wireUniFilter() {
  document.getElementById('uniSearch').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    renderUniTable(uniCache.filter(u => u.name.toLowerCase().includes(q)));
  });
  document.getElementById('addUniBtn').addEventListener('click', () => openUniModal(null));
}

/* ── EXAM UNITS (dynamic rows) ──
   A university can have one or more exam units/shifts, each with its own
   admit-card status, display date, and countdown datetime. Previously this
   required creating multiple separate university documents that shared the
   same name (grouped client-side) — confusing to manage and easy to get
   out of sync. Now they all live as one `examUnits` array on a single
   university document, edited here with add/remove rows. */
let unitRowSeq = 0;
function unitRowHtml(u) {
  const idx = unitRowSeq++;
  return `
    <div class="unit-row" data-idx="${idx}">
      <div class="unit-row-head"><span>ইউনিট #${idx + 1}</span><button type="button" class="remove-unit-btn" title="এই ইউনিট মুছুন"><i class="fa-solid fa-trash"></i></button></div>
      <div class="form-row">
        <div class="form-group"><label>ইউনিট নাম (ঐচ্ছিক)</label><input type="text" class="u-name" placeholder="যেমনঃ A ইউনিট" value="${esc(u?.unit || '')}"></div>
        <div class="form-group"><label>প্রবেশপত্র স্ট্যাটাস</label><input type="text" class="u-admit" value="${esc(u?.admitCard || '')}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>পরীক্ষার তারিখ ও সময় *</label><input type="datetime-local" class="u-at" value="${esc(u?.examCountdown || '')}"></div>
        <div class="form-group"><label>পরীক্ষার তারিখ (প্রদর্শিত টেক্সট)</label><input type="text" class="u-date" value="${esc(u?.examDate || '')}"></div>
      </div>
    </div>`;
}
function addUnitRow(u) {
  const wrap = document.getElementById('examUnitsWrap');
  wrap.insertAdjacentHTML('beforeend', unitRowHtml(u));
  const row = wrap.lastElementChild;
  row.querySelector('.remove-unit-btn').addEventListener('click', () => row.remove());
  const dt = row.querySelector('.u-at'), txt = row.querySelector('.u-date');
  wireAutoFillDate(dt, txt);
}
function renderUnitRows(units) {
  document.getElementById('examUnitsWrap').innerHTML = '';
  unitRowSeq = 0;
  (units.length ? units : [null]).forEach(addUnitRow);
}
function collectUnitRows() {
  return Array.from(document.querySelectorAll('#examUnitsWrap .unit-row')).map(row => ({
    unit: row.querySelector('.u-name').value.trim(),
    admitCard: row.querySelector('.u-admit').value.trim(),
    examCountdown: row.querySelector('.u-at').value.trim(),
    examDate: row.querySelector('.u-date').value.trim()
  })).filter(u => u.unit || u.admitCard || u.examCountdown || u.examDate);
}

function openUniModal(id) {
  const modal = document.getElementById('uniModal');
  const form = document.getElementById('uniForm');
  form.reset();
  const uni = id ? uniCache.find(u => u.id === id) : null;
  document.getElementById('uniModalTitle').textContent = uni ? `সম্পাদনা করুনঃ ${uni.name}` : 'নতুন বিশ্ববিদ্যালয় যোগ করুন';
  form.dataset.editId = id || '';

  form.name.value = uni?.name || '';
  form.applyLink.value = uni?.applyLink || '';
  form.applyLinkText.value = uni?.applyLinkText || 'Apply';
  form.deadline.value = uni?.deadline || '';
  form.deadlineCountdown.value = uni?.deadlineCountdown || '';
  form.negative.value = uni?.negative || '';
  form.calculator.checked = !!uni?.calculator;
  form.secondTime.checked = !!uni?.secondTime;
  form.circularLink.value = uni?.circularLink || '';
  form.resultDate.value = uni?.resultDate || '';
  form.resultLink.value = uni?.resultLink || '';
  form.requiredGPA.value = uni?.requiredGPA ?? '';
  form.active.checked = uni ? uni.active !== false : true;

  // Populate unit rows: prefer the new examUnits array; fall back to the
  // old flat single-unit fields (examUnit/admitCard/examDate/examCountdown)
  // so universities saved before this update still open and edit cleanly.
  const legacyUnit = (uni && (uni.examUnit || uni.admitCard || uni.examDate || uni.examCountdown))
    ? { unit: uni.examUnit || '', admitCard: uni.admitCard || '', examDate: uni.examDate || '', examCountdown: uni.examCountdown || '' }
    : null;
  const units = Array.isArray(uni?.examUnits) && uni.examUnits.length ? uni.examUnits : (legacyUnit ? [legacyUnit] : []);
  renderUnitRows(units);

  modal.classList.add('open');
}
function closeUniModal() { document.getElementById('uniModal').classList.remove('open'); }

async function saveUni(e) {
  e.preventDefault();
  const form = e.target;
  const btn = document.getElementById('uniSaveBtn');
  const editId = form.dataset.editId;

  const data = {
    name: form.name.value.trim(),
    applyLink: form.applyLink.value.trim() || '#',
    applyLinkText: form.applyLinkText.value.trim() || 'Apply',
    deadline: form.deadline.value.trim(),
    deadlineCountdown: form.deadlineCountdown.value.trim(),
    examUnits: collectUnitRows(),
    negative: form.negative.value.trim(),
    calculator: form.calculator.checked,
    secondTime: form.secondTime.checked,
    circularLink: form.circularLink.value.trim() || '#',
    resultDate: form.resultDate.value.trim(),
    resultLink: form.resultLink.value.trim() || '#',
    requiredGPA: form.requiredGPA.value ? parseFloat(form.requiredGPA.value) : 0,
    active: form.active.checked
  };
  if (!data.name) { showToast('নাম আবশ্যক', 'fa-triangle-exclamation'); return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> সেভ হচ্ছে...';
  try {
    if (editId) {
      // examUnits is now the single source of truth for exam info — clear
      // the old flat fields on save so the two can't drift out of sync.
      // (FieldValue.delete() is only valid on update(), so this only runs
      // for existing documents, not for a brand-new add() below.)
      data.examUnit = firebase.firestore.FieldValue.delete();
      data.admitCard = firebase.firestore.FieldValue.delete();
      data.examDate = firebase.firestore.FieldValue.delete();
      data.examCountdown = firebase.firestore.FieldValue.delete();
      await db.collection('universities').doc(editId).update(data);
      showToast('আপডেট করা হয়েছে', 'fa-circle-check');
    } else {
      data.order = uniCache.length;
      await db.collection('universities').add(data);
      showToast('যোগ করা হয়েছে', 'fa-circle-check');
    }
    closeUniModal();
    await bumpVersion('universities');
    await loadUniAdmin();
  } catch (err) {
    console.error(err);
    showToast('সেভ করতে সমস্যা হয়েছে', 'fa-triangle-exclamation');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'সংরক্ষণ করুন';
  }
}

async function deleteUni(id) {
  const uni = uniCache.find(u => u.id === id);
  if (!confirm(`"${uni?.name}" মুছে ফেলতে চান?`)) return;
  try {
    await db.collection('universities').doc(id).delete();
    showToast('মুছে ফেলা হয়েছে', 'fa-trash');
    await bumpVersion('universities');
    await loadUniAdmin();
  } catch (err) {
    console.error(err);
    showToast('মুছতে সমস্যা হয়েছে', 'fa-triangle-exclamation');
  }
}

/* ==========================================================================
   USERS MANAGEMENT
   ========================================================================== */
let userCache = [];

async function loadUsersAdmin() {
  const snap = await db.collection('users').get();
  userCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderUserStats(userCache);
  applyUserFilters();
}

function isProfileComplete(u) {
  return typeof u.profileComplete === 'boolean' ? u.profileComplete : !!(u.username && u.sscGPA && u.hscGPA);
}

function renderUserStats(list) {
  const total = list.length;
  const admins = list.filter(u => u.role === 'admin').length;
  const complete = list.filter(isProfileComplete).length;
  const notifOn = list.filter(u => !!u.fcmToken).length;

  document.getElementById('userStats').innerHTML = `
    <div class="user-stat-card accent"><span class="num">${toBn(total)}</span><span class="lbl">মোট ইউজার</span></div>
    <div class="user-stat-card"><span class="num">${toBn(admins)}</span><span class="lbl">অ্যাডমিন</span></div>
    <div class="user-stat-card"><span class="num">${toBn(complete)}</span><span class="lbl">প্রোফাইল সম্পূর্ণ</span></div>
    <div class="user-stat-card"><span class="num">${toBn(notifOn)}</span><span class="lbl">নোটিফিকেশন চালু</span></div>
  `;
}

function renderUserTable(list) {
  const tbody = document.getElementById('userTableBody');
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted);">কোনো ইউজার পাওয়া যায়নি।</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(u => {
    const initial = (u.name || u.email || '?').trim().charAt(0);
    const bmCount = (u.bookmarks || []).length;
    const notifOn = !!u.fcmToken;
    return `
    <tr>
      <td>
        <div class="u-cell">
          <div class="u-avatar">${esc(initial)}</div>
          <div>
            <div class="u-name">${esc(u.name || '—')}</div>
            <div class="u-sub">@${esc(u.username || '—')} · ${esc(u.email || '')}</div>
          </div>
        </div>
      </td>
      <td>
        <div class="gpa-badge"><span class="lbl">SSC</span> ${u.sscGPA ?? '—'} <span class="lbl">HSC</span> ${u.hscGPA ?? '—'}</div>
      </td>
      <td><span class="bookmark-pill ${bmCount ? 'has' : ''}"><i class="fa-solid fa-bookmark"></i> ${toBn(bmCount)}</span></td>
      <td><i class="fa-solid ${notifOn ? 'fa-bell notif-status on' : 'fa-bell-slash notif-status off'}" title="${notifOn ? 'চালু আছে' : 'বন্ধ আছে'}"></i></td>
      <td>${u.role === 'admin' ? '<span class="chip on">অ্যাডমিন</span>' : '<span class="chip">ইউজার</span>'}</td>
      <td style="display:flex;gap:6px;">
        <button class="btn btn-outline btn-sm edit-user" data-id="${u.id}"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-danger btn-sm del-user" data-id="${u.id}"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.edit-user').forEach(b => b.addEventListener('click', () => openUserModal(b.dataset.id)));
  tbody.querySelectorAll('.del-user').forEach(b => b.addEventListener('click', () => deleteUser(b.dataset.id)));
}

function applyUserFilters() {
  const q = document.getElementById('userSearch').value.trim().toLowerCase();
  const role = document.getElementById('userRoleFilter').value;
  const profileState = document.getElementById('userProfileFilter').value;
  const bookmarkState = document.getElementById('userBookmarkFilter').value;
  const notifState = document.getElementById('userNotifFilter').value;
  const sortBy = document.getElementById('userSort').value;

  let list = userCache.filter(u => {
    if (q && !(
      (u.name || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    )) return false;

    if (role === 'admin' && u.role !== 'admin') return false;
    if (role === 'user' && u.role === 'admin') return false;

    const complete = isProfileComplete(u);
    if (profileState === 'complete' && !complete) return false;
    if (profileState === 'incomplete' && complete) return false;

    const bmCount = (u.bookmarks || []).length;
    if (bookmarkState === 'has' && bmCount === 0) return false;
    if (bookmarkState === 'none' && bmCount > 0) return false;

    const notifOn = !!u.fcmToken;
    if (notifState === 'on' && !notifOn) return false;
    if (notifState === 'off' && notifOn) return false;

    return true;
  });

  if (sortBy === 'bookmarks') {
    list = list.slice().sort((a, b) => (b.bookmarks || []).length - (a.bookmarks || []).length);
  } else if (sortBy === 'gpa') {
    list = list.slice().sort((a, b) => (Number(b.sscGPA) || 0) + (Number(b.hscGPA) || 0) - ((Number(a.sscGPA) || 0) + (Number(a.hscGPA) || 0)));
  } else {
    list = list.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'bn'));
  }

  renderUserTable(list);
}

function wireUserFilter() {
  ['userSearch', 'userRoleFilter', 'userProfileFilter', 'userBookmarkFilter', 'userNotifFilter', 'userSort']
    .forEach(id => {
      const el = document.getElementById(id);
      el.addEventListener('input', applyUserFilters);
      el.addEventListener('change', applyUserFilters);
    });
  document.getElementById('addUserBtn').addEventListener('click', () => openUserModal(null));
}

function openUserModal(id) {
  const modal = document.getElementById('userModal');
  const form = document.getElementById('userForm');
  form.reset();
  const u = id ? userCache.find(x => x.id === id) : null;
  document.getElementById('userModalTitle').textContent = u ? `সম্পাদনা করুনঃ ${u.name || u.email}` : 'নতুন ইউজার প্রোফাইল যোগ করুন';
  form.dataset.editId = id || '';
  document.getElementById('userIdField').style.display = u ? 'none' : 'block';

  form.uid.value = '';
  form.name.value = u?.name || '';
  form.username.value = u?.username || '';
  form.email.value = u?.email || '';
  form.sscGPA.value = u?.sscGPA ?? '';
  form.hscGPA.value = u?.hscGPA ?? '';
  form.sscMark.value = u?.sscMark ?? '';
  form.hscMark.value = u?.hscMark ?? '';
  form.role.value = u?.role || 'user';

  modal.classList.add('open');
}
function closeUserModal() { document.getElementById('userModal').classList.remove('open'); }

async function saveUser(e) {
  e.preventDefault();
  const form = e.target;
  const btn = document.getElementById('userSaveBtn');
  const editId = form.dataset.editId;

  const data = {
    name: form.name.value.trim(),
    username: form.username.value.trim().toLowerCase(),
    email: form.email.value.trim(),
    sscGPA: form.sscGPA.value ? parseFloat(form.sscGPA.value) : null,
    hscGPA: form.hscGPA.value ? parseFloat(form.hscGPA.value) : null,
    sscMark: form.sscMark.value ? parseFloat(form.sscMark.value) : null,
    hscMark: form.hscMark.value ? parseFloat(form.hscMark.value) : null,
    role: form.role.value
  };

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> সেভ হচ্ছে...';
  try {
    if (editId) {
      await db.collection('users').doc(editId).update(data);
      showToast('ইউজার আপডেট হয়েছে', 'fa-circle-check');
    } else {
      const uid = form.uid.value.trim();
      if (!uid) { showToast('নতুন প্রোফাইল যোগ করতে ইউজারের Firebase UID দিন। (নতুন অ্যাকাউন্ট সাধারণত রেজিস্ট্রেশন পেজ থেকেই তৈরি হয়)', 'fa-triangle-exclamation'); btn.disabled = false; btn.innerHTML = 'সংরক্ষণ করুন'; return; }
      data.bookmarks = [];
      data.profileComplete = false;
      await db.collection('users').doc(uid).set(data, { merge: true });
      showToast('প্রোফাইল যোগ করা হয়েছে', 'fa-circle-check');
    }
    closeUserModal();
    await loadUsersAdmin();
  } catch (err) {
    console.error(err);
    showToast('সেভ করতে সমস্যা হয়েছে', 'fa-triangle-exclamation');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'সংরক্ষণ করুন';
  }
}

async function deleteUser(id) {
  const u = userCache.find(x => x.id === id);
  if (!confirm(`"${u?.name || u?.email}" এর প্রোফাইল ডাটা মুছে ফেলতে চান?\n(নোটঃ এটি শুধু প্রোফাইল ডাটা মুছবে, Firebase Authentication অ্যাকাউন্ট মুছতে হলে Cloud Function প্রয়োজন — README দেখুন)`)) return;
  try {
    await db.collection('users').doc(id).delete();
    showToast('প্রোফাইল মুছে ফেলা হয়েছে', 'fa-trash');
    await loadUsersAdmin();
  } catch (err) {
    console.error(err);
    showToast('মুছতে সমস্যা হয়েছে', 'fa-triangle-exclamation');
  }
}

/* ==========================================================================
   VIDEOS (Homepage "Latest Updates" section) CRUD
   ========================================================================== */
let videoCache = [];

/* Accepts any common YouTube URL shape (watch?v=, youtu.be/, /shorts/,
   /embed/) and returns just the 11-char video id, or null if not found. */
function extractYouTubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
/* Fetches the video's real title via YouTube's public oEmbed endpoint
   (no API key required, CORS-enabled). Falls back to a generic label if
   the request fails (e.g. offline, private video). */
async function fetchYouTubeTitle(url) {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    if (!res.ok) throw new Error('oEmbed failed');
    const data = await res.json();
    return data.title || '';
  } catch (e) {
    console.error('oEmbed fetch failed', e);
    return '';
  }
}

async function loadVideosAdmin() {
  const snap = await db.collection('videos').orderBy('order', 'asc').get();
  videoCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderVideoAdminList();
}

function renderVideoAdminList() {
  const wrap = document.getElementById('videoAdminList');
  if (!videoCache.length) {
    wrap.innerHTML = `<div class="empty-state"><i class="fa-brands fa-youtube"></i>এখনো কোনো ভিডিও যোগ করা হয়নি।</div>`;
    return;
  }
  wrap.innerHTML = videoCache.map(v => `
    <div class="video-admin-card">
      <img src="${esc(v.thumb)}" alt="">
      <div>
        <div class="v-title">${esc(v.title)}</div>
        <div class="v-url">${esc(v.url)}</div>
      </div>
      <div class="v-actions">
        <button class="btn btn-outline btn-sm edit-video" data-id="${v.id}"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-danger btn-sm del-video" data-id="${v.id}"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`).join('');
  wrap.querySelectorAll('.edit-video').forEach(b => b.addEventListener('click', () => openVideoModal(b.dataset.id)));
  wrap.querySelectorAll('.del-video').forEach(b => b.addEventListener('click', () => deleteVideo(b.dataset.id)));
}

async function addVideoFromInput() {
  const input = document.getElementById('videoUrlInput');
  const addBtn = document.getElementById('addVideoBtn');
  const url = input.value.trim();
  if (!url) { showToast('একটি YouTube লিংক দিন', 'fa-triangle-exclamation'); return; }
  const vid = extractYouTubeId(url);
  if (!vid) { showToast('সঠিক YouTube লিংক দিন', 'fa-triangle-exclamation'); return; }

  addBtn.disabled = true;
  addBtn.innerHTML = '<span class="spinner"></span>';
  try {
    const title = await fetchYouTubeTitle(url);
    await db.collection('videos').add({
      url,
      videoId: vid,
      title: title || 'ভিডিও দেখুন',
      thumb: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
      order: videoCache.length,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    input.value = '';
    showToast('ভিডিও যোগ করা হয়েছে', 'fa-circle-check');
    await bumpVersion('videos');
    await loadVideosAdmin();
  } catch (err) {
    console.error(err);
    showToast('যোগ করতে সমস্যা হয়েছে', 'fa-triangle-exclamation');
  } finally {
    addBtn.disabled = false;
    addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> যোগ করুন';
  }
}

function openVideoModal(id) {
  const v = videoCache.find(x => x.id === id);
  if (!v) return;
  const form = document.getElementById('videoForm');
  form.dataset.editId = id;
  document.getElementById('videoFormUrl').value = v.url || '';
  document.getElementById('videoFormTitle').value = v.title || '';
  document.getElementById('videoModal').classList.add('open');
}
function closeVideoModal() { document.getElementById('videoModal').classList.remove('open'); }

async function saveVideoEdit(e) {
  e.preventDefault();
  const form = e.target;
  const btn = document.getElementById('videoSaveBtn');
  const editId = form.dataset.editId;
  const url = document.getElementById('videoFormUrl').value.trim();
  const title = document.getElementById('videoFormTitle').value.trim();
  const vid = extractYouTubeId(url);
  if (!vid) { showToast('সঠিক YouTube লিংক দিন', 'fa-triangle-exclamation'); return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> সেভ হচ্ছে...';
  try {
    await db.collection('videos').doc(editId).update({
      url, title: title || 'ভিডিও দেখুন', videoId: vid, thumb: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`
    });
    showToast('আপডেট করা হয়েছে', 'fa-circle-check');
    closeVideoModal();
    await bumpVersion('videos');
    await loadVideosAdmin();
  } catch (err) {
    console.error(err);
    showToast('সেভ করতে সমস্যা হয়েছে', 'fa-triangle-exclamation');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'সংরক্ষণ করুন';
  }
}

async function deleteVideo(id) {
  const v = videoCache.find(x => x.id === id);
  if (!confirm(`"${v?.title || 'এই ভিডিও'}" মুছে ফেলতে চান?`)) return;
  try {
    await db.collection('videos').doc(id).delete();
    showToast('মুছে ফেলা হয়েছে', 'fa-trash');
    await bumpVersion('videos');
    await loadVideosAdmin();
  } catch (err) {
    console.error(err);
    showToast('মুছতে সমস্যা হয়েছে', 'fa-triangle-exclamation');
  }
}

/* ==========================================================================
   NOTIFICATIONS (apply reminder / exam reminder / custom broadcast)
   ========================================================================== */
function populateNotifDropdowns() {
  const applySelect = document.getElementById('applyNotifUni');
  const examSelect = document.getElementById('examNotifUni');
  if (!applySelect || !examSelect) return; // not on this page load yet

  const options = uniCache.map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join('');
  applySelect.innerHTML = options || '<option value="">কোনো বিশ্ববিদ্যালয় নেই</option>';
  examSelect.innerHTML = options || '<option value="">কোনো বিশ্ববিদ্যালয় নেই</option>';
  populateExamUnitDropdown();
}

function populateExamUnitDropdown() {
  const examSelect = document.getElementById('examNotifUni');
  const unitSelect = document.getElementById('examNotifUnit');
  if (!examSelect || !unitSelect) return;
  const uni = uniCache.find(u => u.id === examSelect.value);
  const units = uni && Array.isArray(uni.examUnits) ? uni.examUnits : [];
  unitSelect.innerHTML = units.length
    ? units.map((u, i) => `<option value="${i}">${esc(u.unit || `ইউনিট ${i + 1}`)}${u.examDate ? ' — ' + esc(u.examDate) : ''}</option>`).join('')
    : '<option value="">এই বিশ্ববিদ্যালয়ে কোনো ইউনিট নেই</option>';
}

/* Calls the protected admin endpoint with a fresh ID token — the server
   verifies this is really the admin account before sending anything. */
async function callAdminNotifyApi(payload) {
  const idToken = await auth.currentUser.getIdToken();
  const res = await fetch('/api/admin-send-notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, ...payload })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'সেন্ড করতে সমস্যা হয়েছে');
  return data;
}

function wireNotifPanel() {
  const applySelect = document.getElementById('applyNotifUni');
  const examSelect = document.getElementById('examNotifUni');
  if (!applySelect) return; // notif tab not present on this build

  examSelect.addEventListener('change', populateExamUnitDropdown);

  document.getElementById('sendApplyNotifBtn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const uniId = applySelect.value;
    if (!uniId) { showToast('একটি বিশ্ববিদ্যালয় বেছে নিন', 'fa-triangle-exclamation'); return; }
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> পাঠানো হচ্ছে...';
    try {
      const result = await callAdminNotifyApi({ type: 'apply', uniId });
      showToast(`${toBn(result.sent)} জনকে পাঠানো হয়েছে`, 'fa-circle-check');
    } catch (err) {
      console.error(err);
      showToast(err.message, 'fa-triangle-exclamation');
    } finally {
      btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> পাঠান';
    }
  });

  document.getElementById('sendExamNotifBtn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const uniId = examSelect.value;
    const unitIndex = document.getElementById('examNotifUnit').value;
    if (!uniId || unitIndex === '') { showToast('বিশ্ববিদ্যালয় ও ইউনিট বেছে নিন', 'fa-triangle-exclamation'); return; }
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> পাঠানো হচ্ছে...';
    try {
      const result = await callAdminNotifyApi({ type: 'exam', uniId, unitIndex });
      showToast(`${toBn(result.sent)} জনকে পাঠানো হয়েছে`, 'fa-circle-check');
    } catch (err) {
      console.error(err);
      showToast(err.message, 'fa-triangle-exclamation');
    } finally {
      btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> পাঠান';
    }
  });

  document.getElementById('sendCustomNotifBtn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const title = document.getElementById('customNotifTitle').value.trim();
    const message = document.getElementById('customNotifMsg').value.trim();
    if (!title || !message) { showToast('টাইটেল ও মেসেজ দুটোই দিন', 'fa-triangle-exclamation'); return; }
    if (!confirm('এই মেসেজ সাইট-এর সব ইউজার ও নন-ইউজার সাবস্ক্রাইবারকে পাঠানো হবে। নিশ্চিত?')) return;
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> পাঠানো হচ্ছে...';
    try {
      const result = await callAdminNotifyApi({ type: 'custom', title, message });
      showToast(`${toBn(result.sent)} জনকে পাঠানো হয়েছে`, 'fa-circle-check');
      document.getElementById('customNotifTitle').value = '';
      document.getElementById('customNotifMsg').value = '';
    } catch (err) {
      console.error(err);
      showToast(err.message, 'fa-triangle-exclamation');
    } finally {
      btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> সবাইকে পাঠান';
    }
  });
}

/* ==========================================================================
   INIT
   ========================================================================== */
function initAdmin() {
  wireAdminTabs();
  wireUniFilter();
  wireUserFilter();
  document.getElementById('uniForm').addEventListener('submit', saveUni);
  document.getElementById('userForm').addEventListener('submit', saveUser);
  document.getElementById('uniModalClose').addEventListener('click', closeUniModal);
  document.getElementById('userModalClose').addEventListener('click', closeUserModal);
  document.getElementById('addUnitBtn').addEventListener('click', () => addUnitRow(null));
  wireAutoFillDate(document.getElementById('deadlineCountdownInput'), document.getElementById('deadlineTextInput'));
  document.getElementById('addVideoBtn').addEventListener('click', addVideoFromInput);
  document.getElementById('videoForm').addEventListener('submit', saveVideoEdit);
  document.getElementById('videoModalClose').addEventListener('click', closeVideoModal);
  wireNotifPanel();
  loadUniAdmin();
  loadUsersAdmin();
  loadVideosAdmin();
}

document.addEventListener('DOMContentLoaded', guardAdmin);
