// Keeps the app working without internet. Serves the saved copy right away and
// quietly fetches a fresh one in the background, so updates appear on the next visit.

const CACHE = 'puzzles-v1';
const FILES = [
  './',
  'index.html',
  'style.css',
  'manifest.webmanifest',
  'js/app.js',
  'js/puzzle.js',
  'js/pictures.js',
  'js/storage.js',
  'js/sound.js',
  'js/util.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: true });
      const fresh = fetch(request)
        .then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        })
        .catch(() => cached);
      if (cached) {
        e.waitUntil(fresh);
        return cached;
      }
      return fresh;
    }),
  );
});
