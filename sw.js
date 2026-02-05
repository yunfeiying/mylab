const CACHE_NAME = 'highlighti-mobile-v22';
const ASSETS = [
    './mobile.html',
    './mobile.css',
    './mobile-core.js',
    './mobile-chat.js',
    './mobile-editor.js',
    './ai-core-mobile.js',
    './mobile-gdrive.js',
    './modules/idb-utils.js',
    './modules/storage-bridge.js',
    './modules/memory-agent.js'
];

// Install: Cache all assets
self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

// Activate: Clean up old caches and take control
self.addEventListener('activate', (e) => {
    e.waitUntil(
        Promise.all([
            caches.keys().then((keys) => {
                return Promise.all(keys.map((key) => {
                    if (key !== CACHE_NAME) return caches.delete(key);
                }));
            }),
            self.clients.claim()
        ])
    );
});

// Fetch: Network First, fallback to cache
self.addEventListener('fetch', (e) => {
    e.respondWith(
        fetch(e.request)
            .then((res) => {
                const clone = res.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
                return res;
            })
            .catch(() => caches.match(e.request))
    );
});
