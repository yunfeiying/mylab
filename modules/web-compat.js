/**
 * web-compat.js
 * Provides a mock for Chrome Extension APIs when running in a standard web/mobile browser.
 * This is crucial for testing the mobile UI without deploying as an extension.
 */
(function () {
    if (typeof chrome === 'undefined' || !chrome.runtime) {
        window.chrome = {
            runtime: {
                sendMessage: (msg, callback) => {
                    console.warn('[WebCompat] chrome.runtime.sendMessage:', msg);
                    if (callback) {
                        // Simulate async delay
                        setTimeout(() => {
                            callback({
                                success: false,
                                error: 'Extension environment required for this action.'
                            });
                        }, 100);
                    }
                },
                lastError: null
            },
            storage: {
                local: {
                    get: (keys, cb) => {
                        console.log('[WebCompat] storage.local.get mocked');
                        if (cb) cb({});
                    },
                    set: (items, cb) => {
                        console.log('[WebCompat] storage.local.set mocked');
                        if (cb) cb();
                    },
                    remove: (keys, cb) => {
                        console.log('[WebCompat] storage.local.remove mocked');
                        if (cb) cb();
                    }
                }
            }
        };
        console.log('[WebCompat] Mocked chrome API for mobile/web testing.');
    }
})();
