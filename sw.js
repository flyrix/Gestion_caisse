const CACHE_NAME = 'caisse-v4'; // Version incrémentée pour invalider l'ancien cache

// 1. Liste exhaustive de tous les fichiers nécessaires à l'application hors-ligne
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './page.html',
  './styles/style.css',
  './styles/style.css?v=1.0.5',
  './scripts/script.js',
  './scripts/script.js?v=1.0.3',
  './scripts/auth.js',
  './scripts/db.js',
  './scripts/supabase-config.js',
  './scripts/supabase.js',
  './scripts/avatar-visemes.js?v=1.0.0',
  './scripts/ai-vocal.js?v=1.0.1',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/avatar-visemes/closed.png',
  './icons/avatar-visemes/smile-closed.png',
  './icons/avatar-visemes/slight-open.png',
  './icons/avatar-visemes/medium-open.png'
];

// 2. Installation et mise en cache initiale
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Mise en cache des ressources locales...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .catch(err => console.warn('[SW] Erreur lors de l installation du cache :', err))
  );
  self.skipWaiting();
});

// 3. Activation et nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => {
        console.log(`[SW] Suppression de l ancien cache : ${k}`);
        return caches.delete(k);
      })
    ))
  );
  self.clients.claim();
});

// 4. Interception sécurisée des requêtes réseau
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Traiter uniquement les requêtes GET relatives au même domaine
  if (req.method === 'GET' && req.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(req).then(cachedRes => {
        // A. Si la ressource est présente en cache, la servir immédiatement
        if (cachedRes) {
          return cachedRes;
        }

        // B. Sinon, tenter de la récupérer sur le réseau
        return fetch(req)
          .then(networkRes => {
            // Mettre en cache uniquement les réponses valides (code 200)
            if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
              const resClone = networkRes.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
            }
            return networkRes;
          })
          .catch(() => {
            // C. Réseau indisponible (Mode Hors-ligne)

            // Si c'est une navigation entre pages HTML :
            if (req.mode === 'navigate') {
              return caches.match('./page.html').then(pageRes => {
                return pageRes || caches.match('./index.html');
              });
            }

            // Pour tout autre fichier (JS, CSS, images) non présent dans le cache,
            // retourner une Response 503 propre pour éviter un retour 'undefined'
            return new Response('Ressource indisponible hors-ligne', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' })
            });
          });
      })
    );
  }
});