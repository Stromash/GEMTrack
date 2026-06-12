const CACHE_NAME = 'gemtrack-v4';
const STATIC_CACHE = 'gemtrack-static-v4';

// Core files to cache on install
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
  './icons/apple-touch-icon.png',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
];

// Install: pre-cache all static assets
self.addEventListener('install', event => {
  console.log('[GEMTrack SW] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[GEMTrack SW] Pre-caching assets');
        return cache.addAll(PRECACHE_URLS.map(url => new Request(url, { mode: 'no-cors' })))
          .catch(err => console.warn('[GEMTrack SW] Pre-cache partial fail:', err));
      })
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
  console.log('[GEMTrack SW] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME && name !== STATIC_CACHE)
          .map(name => {
            console.log('[GEMTrack SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Cache-First for static, Network-First for everything else
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Cache-first for CDN resources and local files
  if (
    url.hostname.includes('jsdelivr.net') ||
    url.hostname.includes('cloudflare.com') ||
    url.hostname === self.location.hostname ||
    url.protocol === 'chrome-extension:'
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request, { mode: 'no-cors' })
          .then(response => {
            if (response && response.status === 0 || response.ok) {
              const clone = response.clone();
              caches.open(STATIC_CACHE).then(cache => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => cached || new Response('Offline', { status: 503 }));
      })
    );
    return;
  }

  // Network-first for everything else, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Background sync for data persistence (future use)
self.addEventListener('sync', event => {
  console.log('[GEMTrack SW] Background sync:', event.tag);
});

// Push notifications (future use)
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    self.registration.showNotification(data.title || 'GEMTrack', {
      body: data.body,
      icon: './icons/icon-192x192.png',
      badge: './icons/icon-96x96.png'
    });
  }
});
