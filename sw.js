const CACHE_NAME = 'highlighti-mobile-v1';
const ASSETS = [
    './index.html',
    './mobile.css',
    './mobile-core.js',
    './mobile-chat.js',
    './mobile-editor.js',
    './ai-core-mobile.js',
    './modules/idb-utils.js',
    './modules/storage-bridge.js',
    './modules/memory-agent.js',
    './tesseract.min.js',
    './worker.min.js',
    './tesseract-core.wasm',
    './chi_sim.traineddata.gz',
    './eng.traineddata.gz'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => response || fetch(e.request))
    );
});
