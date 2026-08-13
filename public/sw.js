// Offline shell. The calculator is pure client-side maths, so once the bundle is
// cached it works with no connection at all — the API key panel simply fails to
// reach api.torn.com and manual entry still does everything. Useful on mobile,
// and it makes the installed PWA feel native.
//
// Strategy is per-request-type, and that distinction is load-bearing:
//
//   Navigations (HTML)  → network-first, cache as fallback.
//   /assets/* (hashed)  → cache-first; Vite fingerprints these, so a given URL
//                         is immutable and can never go stale.
//   Everything else     → stale-while-revalidate.
//   api.torn.com        → not intercepted at all; stale stats and prices would
//                         be worse than none.
//
// The previous version was cache-first for *everything* same-origin, including
// `/`. That pinned every returning visitor to whichever build they happened to
// cache first: the HTML was served from cache forever, so it kept pointing at
// the old hashed bundle, which was also in cache — a closed loop that no deploy
// could break. Bumping CACHE below purges those poisoned v1 entries on activate.

const CACHE = 'tto-v2';
const SHELL = ['/', '/site.webmanifest', '/favicon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      // A single failed entry rejects addAll and aborts the whole install, so
      // precache opportunistically — the fetch handler fills any gaps anyway.
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Cache a response, but only if it is one worth replaying (200, same-origin). */
function put(request, response) {
  if (!response || !response.ok || response.type !== 'basic') return response;
  const copy = response.clone();
  caches.open(CACHE).then((c) => c.put(request, copy));
  return response;
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // HTML: always try the network, so a deploy reaches the user on the next
  // visit. Cache is the offline fallback, never the primary source.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => put(e.request, res))
        .catch(() => caches.match(e.request).then((hit) => hit ?? caches.match('/'))),
    );
    return;
  }

  // Content-hashed build output: immutable, so the cache is authoritative.
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(e.request).then((hit) => hit ?? fetch(e.request).then((res) => put(e.request, res))),
    );
    return;
  }

  // Everything else: serve what we have instantly, refresh it in the background.
  e.respondWith(
    caches.match(e.request).then((hit) => {
      const network = fetch(e.request)
        .then((res) => put(e.request, res))
        .catch(() => hit);
      return hit ?? network;
    }),
  );
});
