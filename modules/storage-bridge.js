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
                chrome.storage.local.get(keys, async (res) => {
                    // [Fix] If missing and looks like a URL/Highlight, check IDB bucket
                    if (window.idb && typeof keys === 'string' && !res[keys] && (keys.includes('://') || keys.includes('h_') || keys.includes('.'))) {
                        try {
                            const bucket = await window.idb.get('user_highlights') || {};
                            if (bucket[keys]) {
                                res[keys] = bucket[keys];
                            }
                        } catch (e) { }
                    }
                    resolve(res);
                });
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
            const localToSet = { ...items };
            const idbHighlights = {};
            let hasIDBNotes = false;

            // Logic: Divert highlights and notes to IDB
            for (const [key, val] of Object.entries(items)) {
                if (key === 'user_notes') {
                    hasIDBNotes = true;
                } else if (Array.isArray(val) && val.length > 0 && val[0].timestamp && !['trash_bin'].includes(key)) {
                    // This is a highlight list for a specific URL
                    idbHighlights[key] = val;
                    // delete localToSet[key]; // Keep in local storage for content script visibility
                }
            }

            if (window.idb) {
                if (hasIDBNotes && items.user_notes) {
                    await window.idb.set('user_notes', items.user_notes);
                }

                if (Object.keys(idbHighlights).length > 0) {
                    const current = await window.idb.get('user_highlights') || {};
                    const merged = { ...current, ...idbHighlights };
                    await window.idb.set('user_highlights', merged);

                    // [Modified] Keep in local storage as well so content-script and popup can see it without bridge
                    // chrome.storage.local.remove(Object.keys(idbHighlights));
                }
            }

            return new Promise((resolve) => {
                // [Fix] Prevent saving the entire bucket back to local storage as a single key
                delete localToSet['user_highlights'];
                delete localToSet['user_notes'];

                if (Object.keys(localToSet).length > 0) {
                    chrome.storage.local.set(localToSet, () => resolve());
                } else {
                    resolve();
                }
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
            const keyArray = Array.isArray(keys) ? keys : [keys];

            // 1. Remove from IDB bucket if present
            if (window.idb) {
                try {
                    const currentH = await window.idb.get('user_highlights') || {};
                    let changed = false;
                    keyArray.forEach(k => {
                        if (currentH[k]) {
                            delete currentH[k];
                            changed = true;
                        }
                    });
                    if (changed) {
                        await window.idb.set('user_highlights', currentH);
                    }
                } catch (e) {
                    console.warn('[StorageBridge] IDB remove failed', e);
                }
            }

            // 2. Remove from Local Storage
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

                    // Merge critical IDB data (user_notes & user_highlights) if available
                    if (window.idb) {
                        try {
                            const notes = await window.idb.get('user_notes');
                            if (notes) result.user_notes = notes;

                            const hlights = await window.idb.get('user_highlights');
                            if (hlights) result.user_highlights = hlights;
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
                // Optimized bulk fetch
                if (window.idb.getAll) {
                    return await window.idb.getAll();
                }

                // Fallback (slow sequential fetch)
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
