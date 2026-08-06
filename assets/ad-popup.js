/* ==========================================================================
   AD / PROMO POPUP + floating trigger button
   Drop-in on any page: add
     <link rel="stylesheet" href="assets/ad-popup.css">
   in <head>, and
     <script src="assets/ad-popup.js"></script>
   near your other scripts at the bottom of <body>. That's it — this file
   builds and injects its own markup (popup + floating button), so no HTML
   needs to be copied into every page.

   Edit the CONFIG block below to set your ad image, links, and timing.
   ========================================================================== */

const AD_POPUP_CONFIG = {
  imageUrl: 'ad.png', // TODO: replace with your real ad image URL
  imageLink: '',        // optional — where clicking the image goes (leave '' for no link)
  title: 'বিশেষ অফার!',
  description: 'যেকোনো প্রশ্ন বা সহায়তার জন্য আমাদের সাথে সরাসরি যোগাযোগ করুন।',
  telegramUrl: 'https://t.me/maahin728',
  whatsappUrl: 'https://wa.me/+8801931923910', // TODO: replace with your real WhatsApp number (country code, no +, no spaces)
  autoOpenDelayMs: 3000,
  // Auto-open (on page load) respects this cooldown, so it doesn't nag on
  // every page. Manually clicking the floating trigger button always opens
  // it immediately, cooldown or not — that's a deliberate click, not a nag.
  cooldownHours: 24,
  storageKey: 'adPopupLastShown',
  triggerLabel: 'অফার'
};

let adPopupOverlay = null;

function buildAdPopup() {
  if (adPopupOverlay) return adPopupOverlay;
  const c = AD_POPUP_CONFIG;
  const imgHtml = `<img class="ad-popup-img" src="${c.imageUrl}" alt="${c.title}">`;

  const overlay = document.createElement('div');
  overlay.className = 'ad-popup-overlay';
  overlay.id = 'adPopupOverlay';
  overlay.innerHTML = `
    <div class="ad-popup-box" role="dialog" aria-modal="true" aria-label="${c.title}">
      <button class="ad-popup-close" id="adPopupClose" aria-label="বন্ধ করুন" type="button">
        <i class="fa-solid fa-xmark"></i>
      </button>
      ${c.imageLink
        ? `<a href="${c.imageLink}" target="_blank" class="ad-popup-img-link">${imgHtml}</a>`
        : `<div class="ad-popup-img-link">${imgHtml}</div>`}
      <div class="ad-popup-body">
        <div class="ad-popup-title">${c.title}</div>
        <div class="ad-popup-desc">${c.description}</div>
        <div class="ad-popup-actions">
          <a href="${c.telegramUrl}" target="_blank" class="ad-popup-btn tg">
            <i class="fa-brands fa-telegram"></i> Telegram
          </a>
          <a href="${c.whatsappUrl}" target="_blank" class="ad-popup-btn wa">
            <i class="fa-brands fa-whatsapp"></i> WhatsApp
          </a>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => overlay.classList.remove('open');
  document.getElementById('adPopupClose').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) close();
  });

  adPopupOverlay = overlay;
  return overlay;
}

/** Opens the popup right now, bypassing the cooldown — used by the manual
 *  trigger button, or callable from anywhere as window.openAdPopup(). */
function openAdPopup() {
  const overlay = buildAdPopup();
  overlay.classList.add('open');
  try { localStorage.setItem(AD_POPUP_CONFIG.storageKey, String(Date.now())); } catch (e) {}
}
window.openAdPopup = openAdPopup;

function initAutoOpen() {
  try {
    const last = localStorage.getItem(AD_POPUP_CONFIG.storageKey);
    if (last && (Date.now() - Number(last)) / 3600000 < AD_POPUP_CONFIG.cooldownHours) return;
  } catch (e) {}
  setTimeout(openAdPopup, AD_POPUP_CONFIG.autoOpenDelayMs);
}

/* Floating animated button — click opens the popup immediately, any time,
   on any page. Self-injected, same as the popup itself. */
function injectTriggerButton() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ad-popup-trigger';
  btn.setAttribute('aria-label', 'বিশেষ অফার দেখুন');
  btn.innerHTML = `
    <span class="ad-popup-trigger-ring"></span>
    <i class="fa-solid fa-bullhorn"></i>
    <span class="ad-popup-trigger-label">${AD_POPUP_CONFIG.triggerLabel}</span>`;
  btn.addEventListener('click', openAdPopup);
  document.body.appendChild(btn);
}

document.addEventListener('DOMContentLoaded', () => {
  injectTriggerButton();
  initAutoOpen();
});
