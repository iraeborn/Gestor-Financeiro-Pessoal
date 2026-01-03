
const CACHE_NAME = 'finmanager-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/metadata.json'
];

self.addEventListener('install', (event) => {
  // Use a more resilient approach for caching
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Inserindo arquivos no cache...');
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url => {
          return fetch(url).then(response => {
            if (response.ok) {
              return cache.put(url, response);
            }
            throw new Error(`Falha ao buscar ${url}: ${response.statusText}`);
          });
        })
      ).then(results => {
        const failed = results.filter(r => r.status === 'rejected');
        if (failed.length > 0) {
          console.warn('[SW] Alguns arquivos não puderam ser cacheados:', failed);
        }
        return self.skipWaiting();
      });
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Ignora requisições de API e extensões de browser
  if (event.request.url.includes('/api/') || event.request.url.startsWith('chrome-extension')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Retorna do cache se existir, senão busca na rede
      return response || fetch(event.request).then(networkResponse => {
        // Opcional: Cachear dinamicamente novos arquivos estáticos (exceto scripts de login e API)
        if (networkResponse.ok && event.request.method === 'GET' && !event.request.url.includes('google')) {
           const responseClone = networkResponse.clone();
           caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        }
        return networkResponse;
      }).catch(() => {
        // Fallback offline para a página principal
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
