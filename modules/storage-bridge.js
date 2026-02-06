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
            // Dual-write specific keys to IDB if available (e.g. user_notes for big data)
            if (window.idb && items.user_notes) {
                await window.idb.set('user_notes', items.user_notes);
            }
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
     * Get ALL data (Dump)
     */
    async getAll() {
        if (this.isExtension) {
            return new Promise(async (resolve) => {
                // Get Local Storage first
                chrome.storage.local.get(null, async (localData) => {
                    // Start with local storage data
                    const result = { ...localData };

                    // Merge critical IDB data (user_notes) if available
                    if (window.idb) {
                        try {
                            const notes = await window.idb.get('user_notes');
                            if (notes) {
                                result.user_notes = notes;
                            }
                        } catch (e) {
                            console.warn('[StorageBridge] Failed to read IDB in Extension mode', e);
                        }
                    }
                    resolve(result);
                });
            });
        } else {
            if (!window.idb) return { ...localStorage };

            try {
                const keys = await window.idb.keys();
                const result = {};
                for (const k of keys) {
                    result[k] = await window.idb.get(k);
                }
                return result;
            } catch (e) {
                console.error('IDB Dump Error', e);
                return {};
            }
        }
    }

    /**
     * Clear (Optional/Careful)
     */
    async clear() {
        if (this.isExtension) {
            // Clear BOTH Chrome Storage and IDB
            if (window.idb && window.idb.clear) {
                await window.idb.clear();
            }
            return new Promise((resolve) => chrome.storage.local.clear(() => resolve()));
        } else {
            // Mobile/Web mode: Clear IDB and LocalStorage
            if (window.idb && window.idb.clear) {
                await window.idb.clear();
                console.log('[StorageBridge] IDB Cleared');
            }
            localStorage.clear();
            console.log('[StorageBridge] LocalStorage Cleared');
        }
    }
}

// Global Singleton
window.appStorage = new UniversalStorage();
console.log('[StorageBridge] Persistent Bridge established.');
