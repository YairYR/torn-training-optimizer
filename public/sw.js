// Offline shell. The calculator is pure client-side maths, so once the bundle is
// cached it works with no connection at all — the API key panel simply fails to
// reach api.torn.com and manual entry still does everything. Useful on mobile,
// and it makes the installed PWA feel native.
//
// Cache-first for same-origin assets, network-only for api.torn.com (stale
// prices and stats would be worse than none).

const CACHE = 'tto-v1';
const SHELL = ['/', '/index.html', '/site.webmanifest', '/favicon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ??
        fetch(e.request).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        }),
    ),
  );
});
