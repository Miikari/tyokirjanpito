const CACHE = 'tyotunnit-v133';
const FILES = [
  'index.html',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'css/style.css',
  'js/vendor/jspdf.umd.min.js',
  'js/vendor/jspdf.plugin.autotable.min.js',
  'js/firebase.js',
  'js/state.js',
  'js/i18n.js',
  'js/utils.js',
  'js/storage.js',
  'js/auth.js',
  'js/ui.js',
  'js/clock.js',
  'js/entries.js',
  'js/customers.js',
  'js/demo.js',
  'js/invoices.js',
  'js/org.js',
  'js/reports.js',
  'js/settings.js',
  'js/billing.js',
  'js/app.js',
];

// Suhteelliset polut: sama tiedosto toimii sekä hoyla.dev/app/ että
// miikari.github.io/tyokirjanpito/app/ -asennuksissa (eri base path).
const HTML_URLS = ['/', 'index.html'];

// A visit to plain ".../app/" (the common case — every "Kirjaudu"/"Kokeile"
// link on the marketing pages points here) and a visit to ".../app/index.html"
// are different Request URLs, so caching each under its own key would mean
// the offline fallback only works for whichever variant happened to be
// fetched last. Every successful HTML fetch is cached under this single
// canonical key instead, and the offline fallback always reads back that
// same key — resolved relative to this script's own URL, so it still works
// correctly whichever base path (Firebase Hosting vs GitHub Pages) sw.js is
// actually served from (2026-08-04 review).
const APP_SHELL_URL = new URL('index.html', self.location).toString();

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(FILES.map(f => c.add(f))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;

  // index.html: verkosta ensin, päivitä cache, fallback cacheen jos offline
  if (HTML_URLS.some(u => e.request.url.endsWith(u))) {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(APP_SHELL_URL, clone));
          return response;
        })
        .catch(() => caches.match(APP_SHELL_URL))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(() =>
      new Response('', { status: 503, statusText: 'Service Unavailable' })
    ))
  );
});
