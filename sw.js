const CACHE_NAME = 'caisse-v3'; // Version incrémentée pour forcer la mise à jour du cache

// 1. Tous les fichiers nécessaires à l'application hors-ligne
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './page.html',             
  './styles/style.css',
  './scripts/script.js',
  './scripts/auth.js',       
  './scripts/db.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// 2. Installation et mise en cache initiale
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .catch(err => console.warn('Erreur installation du cache :', err))
  );
  self.skipWaiting();
});

// 3. Activation et nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

// 4. Interception des requêtes réseau
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // On gère uniquement les requêtes GET locales (fichiers de votre projet)
  if (req.method === 'GET' && req.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(req).then(cachedRes => {
        // A. Si la ressource existe déjà en cache local, on la sert immédiatement
        if (cachedRes) {
          return cachedRes;
        }

        // B. Sinon, on tente de la récupérer sur le réseau
        return fetch(req)
          .then(networkRes => {
            if (networkRes && networkRes.status === 200) {
              const resClone = networkRes.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
            }
            return networkRes;
          })
          .catch(() => {
            // C. Si le réseau est indisponible ET qu'il s'agit d'une navigation de page :
            if (req.mode === 'navigate') {
              // On redirige l'utilisateur directement vers l'application hors-ligne
              return caches.match('./page.html') || caches.match('./index.html');
            }
          });
      })
    );
  }
});