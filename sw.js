const CACHE_NAME = 'caisse-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles/style.css',
  './scripts/script.js',
  './scripts/db.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .catch(err => console.warn('Cache install error:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method === 'GET' && req.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(networkRes => {
        caches.open(CACHE_NAME).then(cache => cache.put(req, networkRes.clone()));
        return networkRes;
      }).catch(() => caches.match('./index.html')))
    );
  }
});
