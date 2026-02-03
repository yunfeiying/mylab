/**
 * storage-bridge.js
 * Platform Abstraction Layer (PAL).
 * Unified storage API that works in both Chrome Extension and Mobile/Web context.
 * 
 * Usage: window.appStorage.get('key')
 */

class UniversalStorage {
    constructor() {
        this.isExtension = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local);
        console.log(`[StorageBridge] Identity: ${this.isExtension ? 'Chrome Extension' : 'Mobile/Web PWA'}`);
    }

    /**
     * Get data by single key or array of keys
     */
    async get(keys) {
        if (this.isExtension) {
            return new Promise((resolve) => {
                chrome.storage.local.get(keys, (res) => resolve(res));
            });
        } else {
            // Fallback to IndexedDB (Mobile/Web)
            if (!window.idb) {
                console.error('[StorageBridge] idb-utils.js is missing!');
                return {};
            }
            if (Array.isArray(keys)) {
                const results = {};
                for (const key of keys) {
                    results[key] = await window.idb.get(key);
                }
                return results;
            } else if (typeof keys === 'string') {
                const val = await window.idb.get(keys);
                return { [keys]: val };
            } else if (keys === null) {
                // Not efficiently supported in IDB without more logic, 
                // but usually we don't 'get(null)' in crucial mobile paths
                console.warn('[StorageBridge] get(null) is not ideal for IndexedDB performance');
                return {};
            }
        }
    }

    /**
     * Set data (Object containing key-value pairs)
     */
    async set(items) {
        if (this.isExtension) {
            return new Promise((resolve) => {
                chrome.storage.local.set(items, () => resolve());
            });
        } else {
            if (!window.idb) return;
            for (const [key, val] of Object.entries(items)) {
                await window.idb.set(key, val);
            }
        }
    }

    /**
     * Remove keys
     */
    async remove(keys) {
        if (this.isExtension) {
            return new Promise((resolve) => {
                chrome.storage.local.remove(keys, () => resolve());
            });
        } else {
            if (!window.idb) return;
            const keyArray = Array.isArray(keys) ? keys : [keys];
            for (const key of keyArray) {
                await window.idb.delete(key);
            }
        }
    }

    /**
     * Clear (Optional/Careful)
     */
    async clear() {
        if (this.isExtension) {
            return new Promise((resolve) => chrome.storage.local.clear(() => resolve()));
        } else {
            // Not implemented for IDB to prevent accidental wipes
            console.warn('[StorageBridge] clear() not implemented for Mobile/Web');
        }
    }
}

// Global Singleton
window.appStorage = new UniversalStorage();
console.log('[StorageBridge] Persistent Bridge established.');
