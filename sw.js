/**
 * NERAM POS Service Worker - v2.14.2
 * Provides robust offline PWA caching, background update synchronization,
 * and high-availability app shell serving for iOS & Android.
 */

const CACHE_NAME = 'neram-pos-v2.14.2';
const APP_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/style.css?v=2.14.2',
  '/tailwind.css?v=2.14.2',
  '/app.js?v=2.14.2',
  '/js/analytics.js?v=2.14.2',
  '/js/attendance.js?v=2.14.2',
  '/js/audit.js?v=2.14.2',
  '/js/expenses.js?v=2.14.2',
  '/js/recipes.js?v=2.14.2',
  '/js/staff.js?v=2.14.2',
  '/js/suppliers.js?v=2.14.2',
  '/js/telegram.js?v=2.14.2',
  '/js/users.js?v=2.14.2',
  '/vendor/fontawesome-6.5.1/css/all.min.css',
  '/vendor/fontawesome-6.5.1/webfonts/fa-solid-900.woff2',
  '/vendor/fontawesome-6.5.1/webfonts/fa-regular-400.woff2',
  '/vendor/fontawesome-6.5.1/webfonts/fa-brands-400.woff2',
  '/vendor/outfit-1/outfit.css',
  '/vendor/outfit-1/outfit-latin.woff2',
  '/vendor/outfit-1/outfit-latin-ext.woff2',
  '/vendor/chartjs-4.4.1/chart.umd.min.js',
  '/logo-05.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/favicon.png'
];

// Install: Cache essential app shell assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Best effort pre-cache; continue even if an external CDN has network issues
      return Promise.allSettled(
        APP_SHELL_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[SW] Pre-cache skip for:', url, err);
          })
        )
      );
    })
  );
});

// Activate: Clean up legacy caches and immediately take control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name.startsWith('neram-pos-'))
          .map((name) => {
            console.log('[SW] Deleting legacy cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Strategy depending on request type
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Bypass Service Worker entirely for dynamic API requests and non-GET calls
  if (req.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  // 2. Navigation requests (HTML pages): Network-first with Cache fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return networkRes;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          const fallback = await caches.match('/index.html');
          return fallback || Response.error();
        })
    );
    return;
  }

  // 3. Static assets & Shell files: Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cachedRes) => {
      const fetchPromise = fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200 && networkRes.type !== 'opaque') {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return networkRes;
        })
        .catch(() => cachedRes);

      return cachedRes || fetchPromise;
    })
  );
});

// Handle messages from clients (e.g. force skip waiting)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
