
const CACHE_NAME = 'finmanager-v4';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Cacheando ativos críticos de UI...');
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url => {
          return fetch(url).then(response => {
            if (response.ok) return cache.put(url, response);
            throw new Error(`Falha ao cachear ${url}`);
          });
        })
      ).then(() => self.skipWaiting());
    })
  );
});

self.addEventListener('fetch', (event) => {
  // SEGURANÇA MÁXIMA: Nunca cachear ou servir de cache chamadas de API.
  // Isso impede que um usuário veja o /api/initial-data de um usuário anterior.
  if (event.request.url.includes('/api/') || event.request.url.startsWith('chrome-extension')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then(networkResponse => {
        // Apenas cacheamos ativos estáticos (não autenticados)
        const isStaticAsset = event.request.url.match(/\.(js|css|png|jpg|jpeg|svg|woff2)$/) || event.request.url === self.location.origin + '/';
        
        if (networkResponse.ok && event.request.method === 'GET' && isStaticAsset && !event.request.url.includes('google')) {
           const responseClone = networkResponse.clone();
           caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        }
        return networkResponse;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});
