// Keeps a copy of the app's own files so it opens offline. Book searches and
// covers from other sites always go to the network and are never stored here.
//
// The cache name comes from APP_VERSION in js/version.js, the same number the
// app shows, so bumping that one string retires the old copy. Nothing to
// bump in this file.
importScripts('./js/version.js');

const PREFIX = 'coffee-table-v';
const CACHE = PREFIX + self.APP_VERSION;
const FILES = [
  './index.html',
  './css/style.css',
  './js/version.js',
  './js/config.js',
  './js/logic.js',
  './js/db.js',
  './js/search.js',
  './js/photo.js',
  './js/views.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];
const FILE_URLS = new Set(FILES.map((file) => new URL(file, self.location).href));
const INDEX_URL = new URL('./index.html', self.location).href;
const APP_PATH = new URL('./', self.location).pathname;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // cache: 'reload' skips the browser's own cache (GitHub Pages lets it
      // keep files for 10 minutes), so a new version never stores old files.
      .then((cache) => cache.addAll(FILES.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  // Every app on jamien-liston.github.io shares this cache storage, so only
  // ever delete this app's own older copies.
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Opening the app (its folder, or index.html) gets the stored page.
  if (request.mode === 'navigate' &&
      (url.pathname === APP_PATH || url.pathname === `${APP_PATH}index.html`)) {
    event.respondWith(fromCache(INDEX_URL, request));
    return;
  }

  // The app's own files come from the stored copy; anything else passes by.
  url.search = '';
  if (FILE_URLS.has(url.href)) event.respondWith(fromCache(url.href, request));
});

// Stored copy first. If it's missing (something cleared the cache, say),
// fetch it and store it again, so the app heals itself when next online.
async function fromCache(key, request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(key);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic' && !response.redirected) {
    cache.put(key, response.clone()).catch(() => {});
  }
  return response;
}
