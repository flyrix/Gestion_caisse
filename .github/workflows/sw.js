const CACHE_NAME = 'caisse-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/styles/style.css',
  '/scripts/script.js',
  '/scripts/supabase-config.js',
  '/scripts/supabase.js',
  '/scripts/auth.js',
  '/scripts/db.js',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});