const CACHE_NAME = 'ai-note-v11';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './mobile.css',
    './mobile-core.js',
    './mobile-editor.js',
    './manifest.json'
];

// Install Event: Cache assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching app shell');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Activate Event: Cleanup old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[SW] Removing old cache', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    self.clients.claim();
});

// Fetch Event: Stale-While-Revalidate Strategy
// If network is available, fetch and update cache. If not, fallback to cache.
self.addEventListener('fetch', (event) => {
    // Only handle GET requests
    if (event.request.method !== 'GET') return;

    // Ignore chrome-extension schemes or non-http
    if (!event.request.url.startsWith('http')) return;

    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(event.request).then((cachedResponse) => {
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    // Update cache with new version if successful
                    if (networkResponse && networkResponse.status === 200) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(() => {
                    // Network failed, nothing to do (we rely on cache)
                });

                // Return cached response immediately if available, otherwise wait for network
                return cachedResponse || fetchPromise;
            });
        })
    );
});
