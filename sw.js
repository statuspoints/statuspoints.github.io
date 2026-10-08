// Offline app shell for Points & Status Tracker.
// Files are served cache-first and refreshed in the background (stale-while-revalidate),
// so an edit reaches an installed copy on the launch after it's deployed.
// Bump VERSION when the SHELL list changes so old caches get cleaned up.
const VERSION = 'v6';
const CACHE = `status-tracker-shell-${VERSION}`;
// The screenshot reader's files from jsDelivr (pinned versions, so they never change): kept across app updates so
// scanning works offline after the first use, not only while the browser's HTTP cache happens to keep them.
const OCR_CACHE = 'status-tracker-ocr-v2'; // same name in index.html, which clears it if the scanner fails to load
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
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== OCR_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // The scanner's pinned files only (exact versions, so they never change): cache-first, kept across updates.
  if (url.hostname === 'cdn.jsdelivr.net' && /^\/npm\/(tesseract\.js@5\.1\.1|tesseract\.js-core@5\.1\.1|@tesseract\.js-data\/eng@1\.0\.0)\//.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(OCR_CACHE);
      const hit = await cache.match(request);
      if (hit) return hit;
      const response = await fetch(request);
      if (response.ok || response.type === 'opaque') event.waitUntil(cache.put(request, response.clone()).catch(() => {}));
      return response;
    })());
    return;
  }
  if (url.origin !== self.location.origin) return;
  const isNavigation = request.mode === 'navigate';

  // One cache entry per file: query strings (?utm=…, cache-busters) are dropped from the key, so an old entry
  // saved under some query can't shadow the fresh copy.
  const key = new URL(request.url);
  key.search = '';

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = (await cache.match(key.href))
      || (isNavigation ? await cache.match('./index.html') : undefined);
    const shown = isNavigation && cached ? cached.clone() : null; // to compare with what the server has now

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
          const latest = shown ? response.clone() : null;
          const saved = await cache.put(key.href, response.clone()).then(() => true, () => false);
          // The page on screen came from an older copy: tell open windows a new version is ready — only when its
          // content really changed (every deploy changes headers like ETag) and the new copy was saved, so Reload
          // actually shows it.
          if (saved && shown && latest && (await shown.text()) !== (await latest.text())) {
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
