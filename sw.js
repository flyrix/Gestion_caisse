/**
 * SERVICE WORKER - APPLICATION CAISSE PWA
 * Gestion robuste du cache hors-ligne, du SDK Supabase et des CDNs.
 */

const CACHE_NAME = 'caisse-pwa-v1.0.9';

// Scripts applicatifs : toujours récupérés depuis le réseau (jamais depuis le cache)
const NETWORK_ONLY = [
  '/scripts/auth.js',
  '/scripts/supabase.js',
  '/scripts/supabase-config.js',
  '/index.html',
  '/'
];

// Liste des ressources à pré-cacher obligatoirement
const STATIC_ASSETS = [
  './',
  './index.html',
  './page.html',
  './styles/style.css?v=1.0.5',
  './scripts/supabase-config.js',
  './scripts/supabase.js',
  './scripts/db.js',
  './scripts/auth.js',
  './scripts/avatar-visemes.js?v=1.0.0',
  './scripts/script.js?v=1.0.3',
  // CDNs externes indispensables (Supabase UMD CDN jsDelivr et Bodymovin Lottie)
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.48.1/dist/umd/supabase.js',
  'https://cdnjs.cloudflare.com/ajax/libs/bodymovin/5.12.2/lottie.min.js'
];

// 1. INSTALLATION : Mise en cache initiale des fichiers statiques et CDNs
self.addEventListener('install', (event) => {
  console.log('[SW] Installation du Service Worker...');
  self.skipWaiting(); // Active immédiatement le SW sans attendre le redémarrage

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW] Mise en cache des ressources statiques et CDNs');
      // Boucle sécurisée : évite de bloquer l'installation si un seul asset échoue
      for (const asset of STATIC_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn(`[SW] Impossible de pré-cacher l'élément : ${asset}`, err);
        }
      }
    })
  );
});

// 2. ACTIVATION : Nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation du nouveau Service Worker');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Suppression de l\'ancien cache :', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim()) // Prend le contrôle direct de tous les onglets ouverts
  );
});

// 3. INTERCEPTION DES REQUÊTES (FETCH)
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // LAISSER PASSER : API REST et WebSockets Supabase (Gestion en direct par SupabaseDB / IndexedDB)
  if (url.protocol === 'ws:' || url.protocol === 'wss:' || url.hostname.includes('supabase.co')) {
    return;
  }

  // NETWORK ONLY : scripts critiques toujours frais
  if (NETWORK_ONLY.some(p => url.pathname === p || url.pathname.endsWith(p))) {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  // STRATÉGIE : Cache First (Priorité au cache, repli sur le réseau)
  event.respondWith(
    caches.match(request).then(async (cachedResponse) => {
      // Si la ressource est présente dans le cache, on la renvoie immédiatement
      if (cachedResponse) {
        return cachedResponse;
      }

      // Sinon, tenter de récupérer la ressource depuis le réseau
      try {
        const networkResponse = await fetch(request);

        // Si la réponse est valide (200 OK), on met une copie en cache
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }

        return networkResponse;

      } catch (error) {
        console.warn(`[SW] Échec du réseau pour : ${request.url}`);

        // GARANTIE RESPONSE VALIDE (Jamais undefined)
        
        // 1. Pour les scripts JS
        if (request.destination === 'script' || url.pathname.endsWith('.js')) {
          return new Response('/* Resource JavaScript indisponible en mode hors-ligne */', {
            status: 200,
            headers: { 'Content-Type': 'application/javascript' }
          });
        }

        // 2. Pour les feuilles de style CSS
        if (request.destination === 'style' || url.pathname.endsWith('.css')) {
          return new Response('/* Resource CSS indisponible en mode hors-ligne */', {
            status: 200,
            headers: { 'Content-Type': 'text/css' }
          });
        }

        // 3. Pour la navigation HTML
        if (request.mode === 'navigate') {
          const pageCache = await caches.match('./page.html') || await caches.match('./') || await caches.match('./index.html');
          if (pageCache) return pageCache;
        }

        // 4. Fallback par défaut pour toutes les autres ressources
        return new Response('Ressource indisponible hors-ligne.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' })
        });
      }
    })
  );
});