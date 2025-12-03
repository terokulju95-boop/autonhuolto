const CACHE_NAME = 'huoltokirja-v1';
const urlsToCache = [
  '/autonhuolto/',
  '/autonhuolto/index.html',
  '/autonhuolto/manifest.json',
  '/autonhuolto/icons/icon-192.png',
  '/autonhuolto/icons/icon-512.png'
];

// Asennus - tallenna tiedostot cacheen
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache avattu');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Aktivointi - poista vanhat cachet
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Poistetaan vanha cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch - palauta cachesta tai hae verkosta
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - palauta cachesta
        if (response) {
          return response;
        }

        return fetch(event.request).then(
          response => {
            // Tarkista että vastaus on validi
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Kloonaa vastaus
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
  );
});
