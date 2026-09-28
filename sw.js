// Offline app shell for Points & Status Tracker.
// Files are served cache-first and refreshed in the background (stale-while-revalidate),
// so an edit reaches an installed copy on the launch after it's deployed.
// Bump VERSION when the SHELL list changes so old caches get cleaned up.
const VERSION = 'v1';
const CACHE = `status-tracker-shell-${VERSION}`;
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  const isNavigation = request.mode === 'navigate';

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = (await cache.match(request, { ignoreSearch: true }))
      || (isNavigation ? await cache.match('./index.html') : undefined);

    const refresh = fetch(request)
      .then((response) => {
        // Redirected responses can't be replayed for navigations, so don't cache them.
        if (response.ok && !response.redirected && response.type === 'basic') {
          cache.put(request, response.clone());
        }
        return response;
      })
      .catch(() => undefined);

    if (cached) {
      event.waitUntil(refresh);
      return cached;
    }
    return (await refresh) || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  })());
});
