// Jasper Business Suite Service Worker (Premium POS/ERP Offline-First Support)
const CACHE_NAME = 'jasper-pos-cache-v6';
const NAVIGATION_CACHE_KEY = '/__jasper-navigation-shell__';

// Assets to cache immediately on SW install
const ASSETS_TO_CACHE = [
  '/manifest.json',
  '/jb-logo.png',
  '/jasper_logo_transparent.png',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching static POS offline shell assets');
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('[Service Worker] Static assets pre-cache warning:', err);
      });
    })
  );
  // Force active immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Purging stale workspace cache version:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Let API and AI endpoint requests pass through to the live network with no caching
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('google.com') ||
    url.hostname.includes('generativelanguage.googleapis.com')
  ) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const contentType = response.headers.get('content-type') || '';
          if (response.ok && contentType.includes('text/html')) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(NAVIGATION_CACHE_KEY, copy));
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match(NAVIGATION_CACHE_KEY)) || (await cache.match('/index.html'));
        })
    );
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const contentType = networkResponse.headers.get('content-type') || '';
          const isExpectedAsset =
            contentType.includes('javascript') ||
            contentType.includes('text/css') ||
            contentType.includes('font/') ||
            contentType.includes('image/') ||
            contentType.includes('application/wasm');

          if (!networkResponse.ok || !isExpectedAsset) {
            if (event.request.destination === 'script' || url.pathname.endsWith('.js')) {
              return new Response(
                "if(!sessionStorage.getItem('jasper_asset_refresh_v1')){sessionStorage.setItem('jasper_asset_refresh_v1','1');location.reload();}",
                {
                  status: 200,
                  headers: new Headers({
                    'Content-Type': 'application/javascript; charset=utf-8',
                    'Cache-Control': 'no-store'
                  })
                }
              );
            }

            return new Response('Asset not found', {
              status: 404,
              statusText: 'Not Found',
              headers: new Headers({ 'Content-Type': 'text/plain' })
            });
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          return new Response('Workspace Offline: Connectivity required to retrieve this asset.', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain' })
          });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh copy in the background to keep cache refreshed (stale-while-revalidate pattern)
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {
            // Silently swallow background fetch errors (e.g. offline)
          });
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        // Cache newly requested web assets dynamically
        const contentType = networkResponse.headers.get('content-type') || '';
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === 'basic' &&
          !contentType.includes('text/html')
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(async () => {
        // When completely offline & the index.html is missing from normal fetches, serve the offline shell or fallback
        if (event.request.mode === 'navigate') {
          const cache = await caches.open(CACHE_NAME);
          const fallback = await cache.match('/');
          if (fallback) return fallback;
        }
        return new Response('Workspace Offline: Connectivity required to retrieve this new resource.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain' })
        });
      });
    })
  );
});

// ====== SERVICE WORKER BACKGROUND SYNC MODULE ======

// Helper to open IndexedDB in Service Worker context
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('jasper-offline-db', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('pending_sales')) {
        db.createObjectStore('pending_sales', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Function to fetch and upload pending sales to standard bulk sync API
async function syncOfflinePOSSales() {
  try {
    const db = await openDB();
    const sales = await new Promise((resolve, reject) => {
      const tx = db.transaction('pending_sales', 'readonly');
      const store = tx.objectStore('pending_sales');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    if (!sales || sales.length === 0) {
      console.log('[Service Worker Background Sync] No pending offline transactions to flush.');
      return;
    }

    console.log(`[Service Worker Background Sync] Found ${sales.length} queued bills, publishing to server...`);

    const response = await fetch('/api/sales/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sales })
    });

    if (response.ok) {
      const resultData = await response.json();
      console.log('[Service Worker Background Sync] Sync successfully processed by cloud target:', resultData);

      // Successfully synced! Clean up IndexedDB store
      await new Promise((resolve, reject) => {
        const tx = db.transaction('pending_sales', 'readwrite');
        const store = tx.objectStore('pending_sales');
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      // Broadcast completion status message to all active clients (tabs)
      const clientsList = await self.clients.matchAll();
      clientsList.forEach(client => {
        client.postMessage({
          type: 'OFFLINE_BACKGROUND_SYNC_SUCCESS',
          count: sales.length,
          syncedIds: sales.map(s => s.id)
        });
      });
    } else {
      console.error('[Service Worker Background Sync] Bulk upload failed with status:', response.status);
    }
  } catch (error) {
    console.error('[Service Worker Background Sync] Error during queue sync event:', error);
  }
}

// Background sync registration handler
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pos-sales') {
    console.log('[Service Worker Sync Event] "sync-pos-sales" signal received; flushing offline queue...');
    event.waitUntil(syncOfflinePOSSales());
  }
});

// Also listen to custom messages from client to manually trigger sync or notify SW of connectivity changes
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'TRIGGER_POS_SYNC') {
    console.log('[Service Worker Message Event] Manual sync requested by client application tab.');
    event.waitUntil(syncOfflinePOSSales());
  }
});
