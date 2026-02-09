/**
 * web-compat.js (v11.4 - Fixed Infinite Loop)
 * Provides a mock for Chrome Extension APIs when running in a standard web/mobile browser.
 * IMPORTANT: We DO NOT mock chrome.storage to avoid circular dependency with storage-bridge.js
 */
(function () {
    // Only mock if chrome is completely undefined OR if chrome.runtime doesn't exist
    // BUT we DO NOT mock chrome.storage - let storage-bridge.js handle storage!
    if (typeof chrome === 'undefined') {
        window.chrome = {
            runtime: {
                sendMessage: (msg, callback) => {
                    console.warn('[WebCompat] chrome.runtime.sendMessage (mocked):', msg);
                    if (callback) {
                        setTimeout(() => {
                            callback({
                                success: false,
                                error: 'Extension environment required for this action.'
                            });
                        }, 100);
                    }
                },
                lastError: null,
                id: null // Explicitly null to indicate non-extension
            }
            // NOTE: We do NOT define chrome.storage!
            // storage-bridge.js will see chrome.storage is undefined and use IndexedDB directly.
        };
        console.log('[WebCompat] ⚡ Chrome runtime mocked (storage handled by storage-bridge.js)');
    } else if (chrome.runtime && !chrome.runtime.id) {
        // Chrome object exists but no runtime.id - we're in web/mobile context
        // storage-bridge.js will correctly use IndexedDB
        console.log('[WebCompat] Chrome detected without extension ID - storage-bridge will use IndexedDB');
    }
})();
