// Offline app shell for Points & Status Tracker.
// Files are served cache-first and refreshed in the background (stale-while-revalidate),
// so an edit reaches an installed copy on the launch after it's deployed.
// Bump VERSION when the SHELL list changes so old caches get cleaned up.
const VERSION = 'v5';
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
      .then((cache) => cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' }))))
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

  // One cache entry per file: query strings (?utm=…, cache-busters) are dropped from the key, so an old entry
  // saved under some query can't shadow the fresh copy.
  const key = new URL(request.url);
  key.search = '';

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = (await cache.match(key.href))
      || (isNavigation ? await cache.match('./index.html') : undefined);

    // Revalidate with the server (a cheap 304 when nothing changed) rather than trusting the browser's HTTP
    // cache, which GitHub Pages sets to 10 minutes and would otherwise delay updates.
    const fresh = isNavigation
      ? new Request(request.url, { cache: 'no-cache', credentials: 'same-origin' })
      : new Request(request, { cache: 'no-cache' });
    const refresh = fetch(fresh)
      .then(async (response) => {
        // Redirected responses can't be replayed for navigations, so don't cache them. The write is awaited so
        // the worker isn't stopped before it lands.
        if (response.ok && !response.redirected && response.type === 'basic') {
          await cache.put(key.href, response.clone()).catch(() => {});
          // The page on screen came from an older copy: tell open windows a new version is ready.
          // ETag first: it tracks the content, while Last-Modified can change on a redeploy of identical files.
          const tag = (r) => r.headers.get('etag') || r.headers.get('last-modified');
          if (isNavigation && cached && tag(cached) && tag(response) && tag(cached) !== tag(response)) {
            const windows = await self.clients.matchAll({ type: 'window' });
            for (const client of windows) client.postMessage({ type: 'updated' });
          }
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
