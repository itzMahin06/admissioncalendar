/* ==========================================================================
   CALENDAR (index.html) LOGIC
   ========================================================================== */

/* ── TABS ── */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.getElementById('panel-' + target);
      panel.classList.add('active');
      panel.style.animation = 'none'; panel.offsetHeight; panel.style.animation = '';
    });
  });
});

/* ── COUNTDOWN ──
   Supports two formats so both new and previously-saved data work:
   1) datetime-local ISO strings from the admin picker, e.g. "2026-08-15T23:59"
   2) legacy free-typed "DD-MM-YYYY" or "DD-MM-YYYY HH:MM" text
   Always returns null for anything that doesn't produce a valid date, so the
   UI can show a safe fallback instead of "NaN". */
function parseCountdown(str) {
  if (!str) return null;
  str = str.trim();
  let date;
  if (str.includes('T')) {
    // datetime-local value, e.g. 2026-08-15T23:59
    date = new Date(str);
  } else {
    const [datePart, timePart] = str.split(' ');
    const parts = (datePart || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    const [d, m, y] = parts;
    const [h, mn] = (timePart || '23:59').split(':').map(Number);
    date = new Date(y, m - 1, d, h || 0, mn || 0, 0);
  }
  return isNaN(date.getTime()) ? null : date;
}
function formatCountdown(target) {
  const diff = target - Date.now();
  if (diff <= 0) return { text: 'সময় শেষ', cls: 'expired' };
  const totalMins = Math.floor(diff / 60000);
  const totalHrs  = Math.floor(diff / 3600000);
  const days      = Math.floor(diff / 86400000);
  const hours     = Math.floor((diff % 86400000) / 3600000);
  const mins      = Math.floor((diff % 3600000) / 60000);
  if (totalHrs < 2) {
    const text = totalMins < 60 ? `${toBn(totalMins)}মিঃ` : `${toBn(hours)}ঘঃ ${toBn(mins)}মিঃ`;
    return { text, cls: 'critical' };
  }
  if (days < 3) {
    const text = days > 0 ? `${toBn(days)}দিন ${toBn(hours)}ঘঃ` : `${toBn(hours)}ঘঃ ${toBn(mins)}মিঃ`;
    return { text, cls: 'soon' };
  }
  return { text: `${toBn(days)}দিন ${toBn(hours)}ঘঃ`, cls: 'ok' };
}
const countdownEls = [];
function registerCountdown(el, str) {
  const target = parseCountdown(str);
  if (!target) { el.textContent = '—'; return; }
  countdownEls.push({ el, target });
  updateOne(el, target);
}
function updateOne(el, target) {
  const { text, cls } = formatCountdown(target);
  el.textContent = text;
  el.className = `countdown ${cls}`;
}
setInterval(() => countdownEls.forEach(({ el, target }) => updateOne(el, target)), 1000);

/* ── BOOKMARKS ── */
let bookmarkSet = new Set();
async function loadBookmarks() {
  bookmarkSet = new Set();
  if (currentUser && currentProfile) {
    bookmarkSet = new Set(currentProfile.bookmarks || []);
  }
}
async function toggleBookmark(uniId, btn) {
  if (!currentUser) { showAuthToast(); return; }
  const ref = db.collection('users').doc(currentUser.uid);
  const isOn = bookmarkSet.has(uniId);
  try {
    if (isOn) {
      bookmarkSet.delete(uniId);
      await ref.set({ bookmarks: firebase.firestore.FieldValue.arrayRemove(uniId) }, { merge: true });
      showToast('বুকমার্ক থেকে সরানো হয়েছে', 'fa-bookmark');
    } else {
      bookmarkSet.add(uniId);
      await ref.set({ bookmarks: firebase.firestore.FieldValue.arrayUnion(uniId) }, { merge: true });
      showToast('বুকমার্ক করা হয়েছে', 'fa-solid fa-bookmark');
    }
    if (currentProfile) currentProfile.bookmarks = Array.from(bookmarkSet);
    btn.classList.toggle('active', bookmarkSet.has(uniId));
    btn.innerHTML = bookmarkSet.has(uniId) ? '<i class="fa-solid fa-bookmark"></i>' : '<i class="fa-regular fa-bookmark"></i>';
  } catch (e) {
    console.error(e);
    showToast('সমস্যা হয়েছে, আবার চেষ্টা করুন', 'fa-triangle-exclamation');
  }
}

/* ── BUILD ROWS ── */
function bookmarkCell(id) {
  const on = bookmarkSet.has(id);
  return `<button class="bookmark-btn ${on ? 'active' : ''}" data-uni="${id}" title="বুকমার্ক">
    <i class="fa-${on ? 'solid' : 'regular'} fa-bookmark"></i>
  </button>`;
}
function buildApplication(rows) {
  return rows.map(r => {
    const cdEl = `<span class="countdown" data-cd="${esc(r.deadlineCountdown)}"></span>`;
    const link = r.applyLink && r.applyLink !== '#'
      ? `<a href="${esc(r.applyLink)}" target="_blank" class="badge-link">${esc(r.applyLinkText || 'Apply')} <i class="fa-solid fa-arrow-up-right-from-square"></i></a>`
      : `<span style="color:var(--text-muted)">${esc(r.applyLinkText) || '—'}</span>`;
    return `<tr><td>${bookmarkCell(r.id)}</td><td>${esc(r.name)}</td><td>${link}</td><td>${esc(r.deadline)}</td><td>${cdEl}</td></tr>`;
  }).join('');
}
function buildExam(rows) {
  // Each university document may list its exam units in an `examUnits`
  // array (the current admin-panel model — add as many units/shifts as
  // needed under one university). For any older document saved before
  // that existed, fall back to its single flat examUnit/examDate/
  // examCountdown/admitCard fields, and group multiple such legacy
  // documents that share the same name under one name cell, same as
  // before. Either way the university name is shown once (rowspan) with
  // each unit and its own exam date/countdown listed underneath it.
  const groups = [];
  const indexByName = new Map();
  rows.forEach(r => {
    const units = Array.isArray(r.examUnits) && r.examUnits.length
      ? r.examUnits
      : [{ unit: r.examUnit || '', admitCard: r.admitCard || '', examDate: r.examDate || '', examCountdown: r.examCountdown || '' }];
    if (!indexByName.has(r.name)) {
      indexByName.set(r.name, groups.length);
      groups.push({ name: r.name, units: [] });
    }
    groups[indexByName.get(r.name)].units.push(...units);
  });

  return groups.map(g => {
    return g.units.map((u, i) => {
      const cdEl = `<span class="countdown" data-cd="${esc(u.examCountdown)}"></span>`;
      const unitLabel = u.unit ? esc(u.unit) : (g.units.length > 1 ? `ইউনিট ${i + 1}` : '—');
      const nameCell = i === 0 ? `<td rowspan="${g.units.length}">${esc(g.name)}</td>` : '';
      return `<tr>${nameCell}<td>${unitLabel}</td><td>${esc(u.admitCard)}</td><td>${esc(u.examDate)}</td><td>${cdEl}</td></tr>`;
    }).join('');
  }).join('');
}
function buildInfo(rows) {
  return rows.map(r => {
    const yes = `<i class="fa-solid fa-circle-check icon-yes"></i>`;
    const no  = `<i class="fa-solid fa-circle-xmark icon-no"></i>`;
    const circ = r.circularLink && r.circularLink !== '#'
      ? `<a href="${esc(r.circularLink)}" target="_blank" class="badge-link">দেখুন</a>`
      : `<span style="color:var(--text-muted)">—</span>`;
    return `<tr><td>${esc(r.name)}</td><td>${esc(r.negative)}</td><td>${r.calculator ? yes : no}</td><td>${r.secondTime ? yes : no}</td><td>${circ}</td></tr>`;
  }).join('');
}
function buildResult(rows) {
  return rows.map(r => {
    const link = r.resultLink && r.resultLink !== '#'
      ? `<a href="${esc(r.resultLink)}" target="_blank" class="badge-link result">দেখুন <i class="fa-solid fa-eye"></i></a>`
      : `<span style="color:var(--text-muted)">—</span>`;
    return `<tr><td>${esc(r.name)}</td><td>${esc(r.resultDate)}</td><td>${link}</td></tr>`;
  }).join('');
}
function buildVideos(videos) {
  const slider = document.getElementById('videoSlider');
  if (!slider) return; // this page doesn't have a video section (e.g. calendar-only.html)
  const section = document.getElementById('videoSection');
  // Hide just the "Latest Updates" section (not the whole page — a
  // previous bug here targeted `slider.parentElement`, which was #app
  // itself, so an empty video list used to hide the entire calendar).
  if (!videos || !videos.length) { if (section) section.style.display = 'none'; return; }
  if (section) section.style.display = '';
  slider.innerHTML = videos.map((v) => `
    <a href="${esc(v.url)}" target="_blank" class="video-card">
      <div class="thumb-wrap">
        <img src="${esc(v.thumb)}" alt="${esc(v.title)}" loading="lazy">
        <div class="play-badge"><i class="fa-solid fa-play"></i></div>
      </div>
      <div class="video-card-title">${esc(v.title)}</div>
    </a>`).join('');
}

function attachBookmarkHandlers() {
  document.querySelectorAll('.bookmark-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleBookmark(btn.dataset.uni, btn));
  });
}

/* ── LOAD DATA FROM FIRESTORE ── */
let allUniversities = [];
async function loadUniversities() {
  const all = await getCachedCollection('universities', async () => {
    const snap = await db.collection('universities').orderBy('order', 'asc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  });
  allUniversities = all.filter(u => u.active !== false);
  return allUniversities;
}

async function loadVideos() {
  try {
    return await getCachedCollection('videos', async () => {
      const snap = await db.collection('videos').orderBy('order', 'asc').get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    });
  } catch (e) {
    console.error('Failed to load videos:', e);
    return [];
  }
}

/* ── LIVE VISUAL CALENDAR (calendar-only.html) ──
   Scans every university's exam unit(s) for a parseable exam date/time
   (examCountdown, same field the countdown badges already use — see
   parseCountdown() above) and plots each on a normal month-grid calendar,
   showing the university + unit name directly on that date. Entries
   without a parseable datetime (e.g. only a free-text "শীঘ্রই" note) simply
   can't be placed on a specific day and are skipped here — they still show
   up fine in the regular "পরীক্ষা" tab above. */
const BN_MONTHS = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
let lcCurrentMonth = new Date();
lcCurrentMonth.setDate(1);

function collectExamEvents() {
  const events = {}; // 'YYYY-M-D' -> [{ name, unit }]
  allUniversities.forEach(u => {
    const units = Array.isArray(u.examUnits) && u.examUnits.length
      ? u.examUnits
      : ((u.examDate || u.examCountdown) ? [{ unit: u.examUnit || '', examCountdown: u.examCountdown || '' }] : []);
    units.forEach(unit => {
      const date = parseCountdown(unit.examCountdown);
      if (!date) return;
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      (events[key] = events[key] || []).push({ name: u.name, unit: unit.unit || '' });
    });
  });
  return events;
}

function renderLiveCalendar() {
  const grid = document.getElementById('liveCalGrid');
  if (!grid) return; // this page doesn't have the live calendar (e.g. index.html)

  const events = collectExamEvents();
  const year = lcCurrentMonth.getFullYear();
  const month = lcCurrentMonth.getMonth();
  document.getElementById('lcMonthLabel').textContent = `${BN_MONTHS[month]} ${toBn(year)}`;

  const firstWeekday = new Date(year, month, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  let html = '';
  for (let i = 0; i < firstWeekday; i++) html += `<div class="lc-day lc-empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const dayEvents = events[`${year}-${month}-${d}`] || [];
    const isToday = isCurrentMonth && today.getDate() === d;
    const shown = dayEvents.slice(0, 3);
    const tagsHtml = shown.map(e => {
      const label = e.unit ? `${e.name} · ${e.unit}` : e.name;
      return `<span class="lc-tag" title="${esc(label)}">${esc(label)}</span>`;
    }).join('');
    const moreHtml = dayEvents.length > 3 ? `<span class="lc-more">+${toBn(dayEvents.length - 3)} আরও</span>` : '';
    html += `<div class="lc-day${dayEvents.length ? ' has-exam' : ''}${isToday ? ' lc-today' : ''}">
      <span class="lc-daynum">${toBn(d)}</span>
      <div class="lc-tags">${tagsHtml}${moreHtml}</div>
    </div>`;
  }
  grid.innerHTML = html;
}

function wireLiveCalendarNav() {
  const prev = document.getElementById('lcPrev');
  const next = document.getElementById('lcNext');
  if (!prev || !next) return;
  prev.addEventListener('click', () => { lcCurrentMonth.setMonth(lcCurrentMonth.getMonth() - 1); renderLiveCalendar(); });
  next.addEventListener('click', () => { lcCurrentMonth.setMonth(lcCurrentMonth.getMonth() + 1); renderLiveCalendar(); });
}

async function initCalendar() {
  try {
    const [, videos] = await Promise.all([loadUniversities(), loadVideos()]);
    await loadBookmarks();
    buildVideos(videos);

    document.getElementById('body-application').innerHTML = buildApplication(allUniversities.filter(u => u.deadline));
    document.getElementById('body-exam').innerHTML        = buildExam(allUniversities.filter(u => u.examDate || (Array.isArray(u.examUnits) && u.examUnits.length)));
    document.getElementById('body-info').innerHTML        = buildInfo(allUniversities.filter(u => u.negative || u.circularLink));
    document.getElementById('body-result').innerHTML      = buildResult(allUniversities.filter(u => u.resultDate));

    document.querySelectorAll('[data-cd]').forEach(el => {
      if (el.dataset.cd) registerCountdown(el, el.dataset.cd);
      else el.textContent = '—';
    });
    attachBookmarkHandlers();
    wireAuthBookmarkSync();

    document.querySelectorAll('tbody tr').forEach((tr, i) => {
      tr.style.animation = `fadeUp .4s ${i * .02}s both`;
    });

    wireLiveCalendarNav();
    renderLiveCalendar();
  } catch (err) {
    console.error('Failed to load universities:', err);
    ['application', 'exam', 'info', 'result'].forEach(id => {
      const el = document.getElementById('body-' + id);
      if (el) el.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--accent2);padding:20px;">
        ডেটা লোড হয়নি। Firebase কনফিগারেশন চেক করুন (assets/firebase-config.js)।</td></tr>`;
    });
  }
}

/* re-sync bookmark icons once auth resolves, and show guest toast once.
   Registered from inside initCalendar (after the table/buttons exist), and
   uses onAuthReady so it still fires correctly even if Firebase resolved
   the auth state before initCalendar ran. */
let guestToastShown = false;
function wireAuthBookmarkSync() {
  onAuthReady(async (user) => {
    await loadBookmarks();
    document.querySelectorAll('.bookmark-btn').forEach(btn => {
      const on = bookmarkSet.has(btn.dataset.uni);
      btn.classList.toggle('active', on);
      btn.innerHTML = on ? '<i class="fa-solid fa-bookmark"></i>' : '<i class="fa-regular fa-bookmark"></i>';
    });
    if (!user && !guestToastShown) {
      guestToastShown = true;
      setTimeout(() => showAuthToast(), 900);
    }
  });
}

document.addEventListener('DOMContentLoaded', initCalendar);
