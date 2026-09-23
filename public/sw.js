// Service worker disabled — no caching, pass everything through
const ORVIX_BUILD_VERSION = '__ORVIX_BUILD_VERSION__';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
    .then(() => self.clients.claim())
    .then(() => self.clients.matchAll({ type: 'window' }))
    .then(clients => clients.forEach(client => client.postMessage({
      type: 'ORVIX_PWA_UPDATED',
      version: ORVIX_BUILD_VERSION,
    })))
  );
});
self.addEventListener('fetch', () => {});
