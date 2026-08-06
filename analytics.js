// Shared cookie-consent gate + Meta Pixel / GA4 loader for every public
// surface (hoyla.fi, hoyla.fi/ajanseuranta/) and the app itself — the app
// needs it too because the CompleteRegistration/sign_up event fires from
// app/js/auth.js right after a real signup, which requires fbq/gtag to
// already be available (and consent already resolved) in that page.
// Plain script (not a module) so it works unchanged from a relative <script>
// tag on both the static landing pages and the app's own index.html.
(function () {
  var CONSENT_KEY = 'tyoaikaCookieConsent'; // localStorage: 'accepted' | 'essential'
  var META_PIXEL_ID = '1063689643275539';
  var GA4_ID = 'G-3TJH2E6KDT';

  function loadMetaPixel() {
    if (window.fbq) return;
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', META_PIXEL_ID);
    fbq('track', 'PageView');
  }

  function loadGA4() {
    if (window.gtag) return;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', GA4_ID);
  }

  function loadTrackers() {
    loadMetaPixel();
    loadGA4();
  }

  function hideBanner() {
    var el = document.getElementById('cookie-consent-banner');
    if (el) el.remove();
  }

  function renderBanner() {
    if (document.getElementById('cookie-consent-banner')) return;
    var el = document.createElement('div');
    el.id = 'cookie-consent-banner';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Evästeasetukset');
    el.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#112439;color:#fff;' +
      'padding:16px 20px;display:flex;flex-wrap:wrap;gap:12px 20px;align-items:center;justify-content:space-between;' +
      'font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;box-shadow:0 -2px 12px rgba(0,0,0,.25);';
    var text = document.createElement('p');
    text.style.cssText = 'margin:0;flex:1;min-width:240px;';
    text.innerHTML = 'Käytämme evästeitä mainonnan mittaamiseen ja sivuston käytön tilastointiin (Meta, Google Analytics). ' +
      '<a href="/tietosuoja/" target="_blank" rel="noopener" style="color:#00e3a6;text-decoration:underline;">Lue lisää</a>';
    var actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;flex-shrink:0;';
    var declineBtn = document.createElement('button');
    declineBtn.type = 'button';
    declineBtn.textContent = 'Vain välttämättömät';
    declineBtn.style.cssText = 'padding:9px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.4);' +
      'background:transparent;color:#fff;font:inherit;cursor:pointer;';
    var acceptBtn = document.createElement('button');
    acceptBtn.type = 'button';
    acceptBtn.textContent = 'Hyväksy';
    acceptBtn.style.cssText = 'padding:9px 14px;border-radius:8px;border:none;background:#00e3a6;color:#0a1826;' +
      'font:inherit;font-weight:600;cursor:pointer;';
    declineBtn.addEventListener('click', function () { window.hoylaAnalytics.declineConsent(); });
    acceptBtn.addEventListener('click', function () { window.hoylaAnalytics.grantConsent(); });
    actions.appendChild(declineBtn);
    actions.appendChild(acceptBtn);
    el.appendChild(text);
    el.appendChild(actions);
    document.body.appendChild(el);
  }

  window.hoylaAnalytics = {
    hasConsent: function () { return localStorage.getItem(CONSENT_KEY) === 'accepted'; },
    grantConsent: function () {
      localStorage.setItem(CONSENT_KEY, 'accepted');
      loadTrackers();
      hideBanner();
    },
    declineConsent: function () {
      localStorage.setItem(CONSENT_KEY, 'essential');
      hideBanner();
    },
    // Fires the signup conversion event for ad-funnel tracking — no-op
    // silently if the visitor hasn't (yet) consented to marketing cookies.
    trackSignup: function () {
      if (!this.hasConsent()) return;
      if (window.fbq) fbq('track', 'CompleteRegistration');
      if (window.gtag) gtag('event', 'sign_up');
    },
    // Fires on a confirmed Stripe checkout — this is the event ad platforms
    // should actually optimize spend toward (a paying customer), not just
    // trackSignup's free-account creation.
    trackPurchase: function (value, currency) {
      if (!this.hasConsent()) return;
      if (window.fbq) fbq('track', 'Purchase', { value: value, currency: currency });
      if (window.gtag) gtag('event', 'purchase', { value: value, currency: currency });
    },
  };

  function init() {
    var decision = localStorage.getItem(CONSENT_KEY);
    if (decision === 'accepted') loadTrackers();
    else if (!decision) renderBanner();
    // decision === 'essential': stay silent, no banner, no trackers.
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
