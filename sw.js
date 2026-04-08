const CACHE = 'tyotunnit-v6';
const FILES = [
  '/tyokirjanpito/',
  '/tyokirjanpito/index.html',
  '/tyokirjanpito/manifest.json',
  '/tyokirjanpito/icons/icon-192.png',
  '/tyokirjanpito/icons/icon-512.png'
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
    caches.match(e.request).then(r => r || fetch(e.request).catch(() => caches.match('/tyokirjanpito/index.html')
))
  );
});
