// WMS Service Worker — PWA offline support (production only)
const CACHE_NAME = 'wms-v2';
const IS_DEV = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

self.addEventListener('install', (event) => {
  // In dev: skip waiting so new SW activates immediately on reload
  self.skipWaiting();
  if (IS_DEV) return;

  const PRECACHE_URLS = ['/', '/picking', '/receiving', '/inventory', '/manifest.json'];
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Dev: never intercept — let everything go to network
  if (IS_DEV) return;

  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache Next.js chunks — hashes change per build
  if (url.pathname.startsWith('/_next/')) return;

  // Cache-first for app shell navigation routes
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
