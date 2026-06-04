const CACHE = 'tyotunnit-v18';
const FILES = [
  '/tyokirjanpito/manifest.json',
  '/tyokirjanpito/icons/icon-192.png',
  '/tyokirjanpito/icons/icon-512.png',
  '/tyokirjanpito/css/style.css',
  '/tyokirjanpito/js/firebase.js',
  '/tyokirjanpito/js/state.js',
  '/tyokirjanpito/js/i18n.js',
  '/tyokirjanpito/js/utils.js',
  '/tyokirjanpito/js/storage.js',
  '/tyokirjanpito/js/auth.js',
  '/tyokirjanpito/js/ui.js',
  '/tyokirjanpito/js/clock.js',
  '/tyokirjanpito/js/entries.js',
  '/tyokirjanpito/js/customers.js',
  '/tyokirjanpito/js/invoices.js',
  '/tyokirjanpito/js/org.js',
  '/tyokirjanpito/js/settings.js',
  '/tyokirjanpito/js/app.js',
];

const HTML_URLS = ['/tyokirjanpito/', '/tyokirjanpito/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())
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
          caches.open(CACHE).then(c => c.put(e.request, response.clone()));
          return response;
        })
        .catch(() => caches.match('/tyokirjanpito/index.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(() =>
      new Response('', { status: 503, statusText: 'Service Unavailable' })
    ))
  );
});
