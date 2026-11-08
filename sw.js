var CACHE_NAME = 'climahogar-v2-offline';
var urlsToCache = [
  './index.html',
  './facturas.html',
  './dictamenes.html',
  './manifest.json',
  './icono-192.png',
  './logo-climahogar.png',
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore-compat.js'
];

// Instalación del Service Worker y guardado en caché
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('[ServiceWorker] Archivos en caché offline');
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// Activación y limpieza de cachés antiguas
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Borrando caché vieja:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Intercepción de peticiones (Estrategia: Cache primero, luego red con respaldo offline)
self.addEventListener('fetch', function(event) {
  // Ignorar peticiones de Firebase Firestore / Auth para que la app intente la red primero
  if (event.request.url.includes('firestore.googleapis.com') || event.request.url.includes('firebase')) {
    event.respondWith(
      fetch(event.request).catch(function() {
        // Si no hay red para Firebase, devolvemos un estado offline controlado
        return new Response(JSON.stringify({ offline: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function(response) {
      return response || fetch(event.request).then(function(fetchResponse) {
        return caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, fetchResponse.clone());
          return fetchResponse;
        });
      }).catch(function() {
        // Si falla la red y no está en caché, podemos retornar el index principal o una página de respaldo
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
