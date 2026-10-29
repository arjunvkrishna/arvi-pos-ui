/**
 * ARVI POS service worker.
 * - Installable app + offline app shell: the page itself is always fetched from the network first (so a new release is
 *   picked up straight away) and falls back to the last copy when offline.
 * - Built files (/assets/, /vendor/, icons) never change under the same name, so they are served from cache.
 * - Never touches /api (live data and the live order / notification streams) or other sites.
 * It replaces the worker of the old app on the same URL: on activation it removes every older ARVI cache.
 */
const CACHE = 'arvi-pos-web-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.add('/index.html').catch(() => undefined)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n.startsWith('arvi-pos-') && n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

const IMMUTABLE = /^\/(assets|vendor)\/|\.(?:png|woff2|ico)$/;

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname === '/menu' || url.pathname === '/menu.html') return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); void caches.open(CACHE).then((c) => c.put('/index.html', copy)); }
        return res;
      }).catch(() => caches.match('/index.html').then((r) => r || Response.error())),
    );
    return;
  }
  if (IMMUTABLE.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); void caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })),
    );
  }
});
