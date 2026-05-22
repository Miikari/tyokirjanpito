const CACHE = 'tyotunnit-v12';
const FILES = [
  '/tyokirjanpito/',
  '/tyokirjanpito/index.html',
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
  '/tyokirjanpito/js/settings.js',
  '/tyokirjanpito/js/app.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(() => caches.match('/tyokirjanpito/index.html')))
  );
});
