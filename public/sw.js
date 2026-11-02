/* Clocked service worker.
 *
 * - Install: precaches the whole web app so the installed app works offline
 *   from the first launch. The file list and version are filled in by
 *   scripts/postexport-web.mjs after `expo export` (see `npm run build:web`).
 * - Page loads: network first, falling back to the cached app shell.
 * - Everything else from this site: cache first, stored the first time.
 */
const VERSION = '__CLOCKED_VERSION__';
const PRECACHE = /* __CLOCKED_PRECACHE__ */ [];

const CACHE = `clocked-${VERSION}`;
// Paths are relative to the service worker's scope ("/" locally, "/Time/" on
// GitHub Pages), so the same file works in both places.
const BASE = new URL(self.registration.scope).pathname;
const at = (p) => BASE + p.replace(/^\//, '');
const SHELL = ['', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'].map(at);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([...new Set([...SHELL, ...PRECACHE.map(at)])]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('clocked-') && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(BASE, copy));
          return response;
        })
        .catch(() => caches.match(BASE)),
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreVary: true }).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
