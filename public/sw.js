// Service Worker for IdiamPro PWA
const CACHE_NAME = 'idiampro-v3';

// Install event - activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event - claim clients and clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - network-first for pages and scripts, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip API routes and external requests
  if (url.pathname.startsWith('/api/') || url.origin !== self.location.origin) return;

  // Navigation requests (HTML pages) and Next.js chunks: always network-first
  if (event.request.mode === 'navigate' || url.pathname.startsWith('/_next/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache a fresh copy for offline fallback
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // Offline: try cache, then show a basic message for navigation
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            if (event.request.mode === 'navigate') {
              return new Response('You are offline. Please reconnect and refresh.', {
                headers: { 'Content-Type': 'text/html' },
              });
            }
            return new Response('', { status: 503 });
          });
        })
    );
    return;
  }

  // Static assets (images, fonts, etc.): cache-first is fine
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      });
    })
  );
});

// Listen for messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
