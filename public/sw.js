// Offline shell. The calculator is pure client-side maths, so once the bundle is
// cached it works with no connection at all — the API key panel simply fails to
// reach api.torn.com and manual entry still does everything.
//
// Estrategia (invariante, ver claude/ui-pass-2026-09.md):
//   - /api/*        → nunca en caché: estado Pro, historial y facción deben ser frescos.
//   - /assets/*     → cache-first: Vite les pone hash, son inmutables.
//   - todo lo demás → network-first con caché de respaldo offline. Así cada deploy
//     se ve en la carga normal, no solo con Ctrl+F5.
// Si cambia la forma del shell, subir CACHE (tto-v2 → tto-v3): activate borra el resto.

const CACHE = 'tto-v2';
const SHELL = ['/', '/site.webmanifest', '/favicon.svg'];

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

const save = (req, res) => {
  if (res.ok) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return res;
};

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(caches.match(e.request).then((hit) => hit ?? fetch(e.request).then((r) => save(e.request, r))));
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((r) => save(e.request, r))
      .catch(() =>
        caches.match(e.request).then((hit) => hit ?? (e.request.mode === 'navigate' ? caches.match('/') : Response.error())),
      ),
  );
});
