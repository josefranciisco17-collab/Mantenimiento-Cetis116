// Nombre de la versión del caché para Clima CETis 116 - By JFAM Tecno-Energy
const CACHE_NAME = 'cetis116-clima-pwa-v1';

// Archivos base que necesita la app para arrancar rápido
const STATIC_ASSETS = [
  './',
  './index.html',
  './login.html',
  './manifest.json',
  './icono-192.png',
  './icono-512.png',
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap'
];

// 1. INSTALACIÓN: Guarda los archivos base en la memoria del teléfono
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Usamos map con catch individual por si algún ícono aún no se ha subido, que no falle el Service Worker
      return Promise.allSettled(
        STATIC_ASSETS.map((url) => cache.add(url).catch((err) => console.warn('No se pudo cachear:', url, err)))
      );
    })
  );
});

// 2. ACTIVACIÓN: Limpia versiones viejas cuando actualices tu código en GitHub
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. INTERCEPTOR DE RED (Requisito obligatorio de PWABuilder para generar el APK)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // REGLA CRÍTICA: Nunca interceptar ni guardar en caché las peticiones de Firebase Auth ni Firestore
  // Esto garantiza que tus equipos, servicios y el historial de auditoría siempre estén en tiempo real
  if (
    req.method !== 'GET' ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('gstatic.com')
  ) {
    return;
  }

  // Estrategia "Network First" (Primero intenta internet para ver cambios recientes; si no hay red, usa caché)
  event.respondWith(
    fetch(req)
      .then((networkResponse) => {
        // Si la respuesta de red es válida, actualizamos la copia en caché
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Si se va el internet o falla la señal en algún aula, carga la interfaz guardada
        return caches.match(req).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Si estaba navegando a una página y no hay red, devuelve index.html
          if (req.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
