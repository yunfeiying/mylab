/**
 * web-compat.js (v11.1 - Performance Optimized)
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
                    get: async (keys, cb) => {
                        console.log('[WebCompat] storage.local.get (non-blocking)');

                        // OPTIMIZED: No waiting, immediate check only
                        if (window.appStorage) {
                            try {
                                const result = await window.appStorage.get(keys);
                                console.log('[WebCompat] ✓ Got', Object.keys(result).length, 'keys');
                                if (cb) cb(result);
                                return;
                            } catch (e) {
                                console.error('[WebCompat] Get error:', e);
                            }
                        }

                        // If appStorage not ready, return empty immediately (non-blocking)
                        console.warn('[WebCompat] appStorage not ready, returning empty (app will handle lazy loading)');
                        if (cb) cb({});
                    },
                    set: async (items, cb) => {
                        console.log('[WebCompat] storage.local.set:', Object.keys(items));

                        // OPTIMIZED: No waiting, immediate check only
                        if (window.appStorage) {
                            try {
                                await window.appStorage.set(items);
                                console.log('[WebCompat] ✓ Saved successfully');
                                if (cb) cb();
                                return;
                            } catch (e) {
                                console.error('[WebCompat] Set error:', e);
                            }
                        }

                        // Fallback: Try again after a short delay (non-blocking retry)
                        console.warn('[WebCompat] appStorage not ready, retrying once...');
                        setTimeout(async () => {
                            if (window.appStorage) {
                                try {
                                    await window.appStorage.set(items);
                                    console.log('[WebCompat] ✓ Saved on retry');
                                } catch (e) {
                                    console.error('[WebCompat] Retry failed:', e);
                                }
                            } else {
                                console.error('[WebCompat] Set operation lost - appStorage never initialized');
                            }
                        }, 500);

                        if (cb) cb(); // Don't block
                    },
                    remove: async (keys, cb) => {
                        console.log('[WebCompat] storage.local.remove');

                        if (window.appStorage) {
                            try {
                                await window.appStorage.remove(keys);
                                console.log('[WebCompat] ✓ Removed successfully');
                                if (cb) cb();
                                return;
                            } catch (e) {
                                console.error('[WebCompat] Remove error:', e);
                            }
                        }

                        console.warn('[WebCompat] appStorage not ready, remove may be lost');
                        if (cb) cb();
                    }
                }
            }
        };
        console.log('[WebCompat] ⚡ Mocked chrome API (NON-BLOCKING, optimized for speed)');
    }
})();
