/**
 * mobile-gdrive.js - Manifest V3 Compliant Google Drive Sync (Folder Structure Support)
 * Now compatible with Extension v3.3+ Folder Architecture
 */

class MobileGDrive {
    constructor() {
        this.ROOT_FOLDER_NAME = 'Highlighti_Data';
        this.ARTICLES_FOLDER_NAME = 'articles';
        this.NOTES_FOLDER_NAME = 'notes';
        this.INDEX_FILE_NAME = 'index.json';
        this.MEMORY_FOLDER_NAME = 'memories';

        // GIS Auth Properties
        this.CLIENT_ID = localStorage.getItem('gdrive_client_id') || '';
        this.API_KEY = localStorage.getItem('gdrive_api_key') || '';
        this.SCOPES = 'https://www.googleapis.com/auth/drive.file';
        this.access_token = localStorage.getItem('gdrive_web_token') || '';
        this.tokenClient = null;

        // Auto-load if credentials exist - CHANGED: Removed to prevent blocking on load
        // Scripts will be lazy-loaded on first Sync attempt
        /*
        if (this.CLIENT_ID) {
            setTimeout(() => this.loadScripts(), 1000);
        }
        */
    }

    // ==========================================
    // Core Auth & API Wrappers (GIS Version)
    // ==========================================

    async loadGoogleSdk() {
        if (window.google && window.google.accounts) return true;

        console.log("[Sync] Lazy loading Google SDKs...");
        const loadScript = (src) => {
            return new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = src;
                s.async = true;
                s.defer = true;
                s.onload = resolve;
                s.onerror = () => reject(new Error(`Failed to load ${src}`));
                document.body.appendChild(s);
            });
        };

        try {
            await loadScript("https://apis.google.com/js/api.js");
            await loadScript("https://accounts.google.com/gsi/client");
            return true;
        } catch (e) {
            console.error("[Sync] Google SDK Load Failed:", e);
            throw new Error("Unable to load Google scripts. if you are in China, please enable VPN.");
        }
    }

    loadScripts() {
        // Deprecated wrapper kept for compatibility, now does nothing or warns
        console.warn("[Sync] loadScripts is deprecated. Use loadGoogleSdk() instead.");
    }

    initTokenClient() {
        if (!window.google || !window.google.accounts) return;
        try {
            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: this.CLIENT_ID,
                scope: this.SCOPES,
                callback: (resp) => {
                    if (resp.error) {
                        console.error("[Auth] GIS Error:", resp);
                        return;
                    }
                    this.access_token = resp.access_token;
                    localStorage.setItem('gdrive_web_token', resp.access_token);
                    localStorage.setItem('gdrive_web_token_expiry', Date.now() + (resp.expires_in * 1000));
                    console.log("[Auth] Token acquired via GIS.");
                    // Reset sync after auth if needed, or rely on second click
                },
            });
            console.log("[Auth] Token Client Initialized.");
        } catch (e) {
            console.error("[Auth] Init failed:", e);
        }
    }

    setCredentials(clientId, apiKey) {
        this.CLIENT_ID = clientId;
        this.API_KEY = apiKey;
        localStorage.setItem('gdrive_client_id', clientId);
        localStorage.setItem('gdrive_api_key', apiKey);

        // Also update settings storage for consistency
        window.appStorage.get('settings').then(res => {
            const s = res.settings || {};
            s.gdrive_client_id = clientId;
            s.gdrive_api_key = apiKey;
            window.appStorage.set({ settings: s });
        });

        this.loadGoogleSdk().then(() => {
            if (window.google && window.google.accounts) this.initTokenClient();
        }).catch(err => console.error(err));
        alert('Credentials Saved! Click Sync again to authenticate.');
    }

    async handleAuthClick() {
        // --- 1. Preferred: Chrome Identity (Extension Context) ---
        // Enhanced detection for extension environment
        const isExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;

        if (isExtension) {
            if (chrome.identity && chrome.identity.getAuthToken) {
                console.log('[Sync] Using Chrome Identity API.');
                return new Promise((resolve, reject) => {
                    chrome.identity.getAuthToken({ interactive: true }, (token) => {
                        if (chrome.runtime.lastError) {
                            console.warn('[Sync] Chrome Identity failed:', chrome.runtime.lastError);
                            reject(new Error(`Chrome Auth Error: ${chrome.runtime.lastError.message}`));
                        } else {
                            resolve(token);
                        }
                    });
                });
            } else {
                console.warn('[Sync] Chrome Identity API missing despite being in extension environment. Check manifest permissions.');
                // Fallthrough to Web GIS, but warn
            }
        }

        // --- 2. Web/PWA Context (GIS) OR Fallback ---
        console.log('[Sync] Falling back to Google Identity Services (Web Flow).');

        if (!this.CLIENT_ID || !this.API_KEY) {
            const id = prompt("🔑 Step 1/2: Enter Google Client ID\n(From Google Cloud Console -> OAuth Client -> Web Application):", this.CLIENT_ID);
            if (!id) return null;
            const key = prompt("🔑 Step 2/2: Enter Google API Key:", this.API_KEY);
            if (id && key) {
                this.setCredentials(id, key);
            }
            return null;
        }

        // Check cache
        const expiry = localStorage.getItem('gdrive_web_token_expiry');
        if (this.access_token && expiry && Date.now() < (parseInt(expiry) - 60000)) {
            return this.access_token;
        }

        // Need new token
        if (!this.tokenClient) {
            // Lazy load scripts first
            try {
                await this.loadGoogleSdk();
                this.initTokenClient();
                if (!this.tokenClient) {
                    throw new Error("Google Identity Service failed to initialize (tokenClient is null).");
                }
            } catch (error) {
                alert("Google Sync Unavailable: " + error.message);
                return null;
            }
        }

        return new Promise((resolve, reject) => {
            try {
                // Ensure callback is bound to this instance context if needed (handled in initTokenClient)
                // We need to override the callback or handle it via the existing one
                this.tokenClient.callback = (resp) => {
                    if (resp.error) {
                        reject(new Error(`GIS Auth Error: ${resp.error}`));
                        return;
                    }
                    this.access_token = resp.access_token;
                    localStorage.setItem('gdrive_web_token', resp.access_token);
                    localStorage.setItem('gdrive_web_token_expiry', Date.now() + (resp.expires_in * 1000));
                    resolve(resp.access_token);
                };

                this.tokenClient.requestAccessToken({ prompt: 'consent' });
            } catch (e) {
                reject(new Error("Google Identity Service is not ready or failed to request token: " + e.message));
            }
        });
    }

    async _wait(ms) { return new Promise(r => setTimeout(r, ms)); }

    async driveRequest(url, method = 'GET', token, body = null, contentType = 'application/json', retries = 2) {
        if (!token) throw new Error("Google Authentication token is missing.");

        const headers = new Headers({ 'Authorization': `Bearer ${token}` });
        if (body && contentType) {
            headers.append('Content-Type', contentType);
        }

        const options = { method, headers };
        if (body) options.body = body;

        try {
            const resp = await fetch(url, options);
            if (!resp.ok) {
                if (resp.status === 401) {
                    console.warn("[Sync] 401: Token expired.");
                    this.access_token = '';
                    localStorage.removeItem('gdrive_web_token');
                    localStorage.removeItem('gdrive_web_token_expiry'); // Added this for consistency
                }
                const err = await resp.text();
                throw new Error(`Drive API Error (${resp.status}): ${err}`);
            }
            return resp;
        } catch (err) {
            const isNetworkError = err.name === 'TypeError' || err.message.includes('fetch');
            if (isNetworkError && retries > 0) {
                console.warn(`[Sync] Network failed, retrying in 2s... (${retries} left)`, err);
                await this._wait(2000);
                return this.driveRequest(url, method, token, body, contentType, retries - 1);
            }
            if (isNetworkError) {
                throw new Error("Network Error: Google Drive is currently unreachable. Please check your VPN/Proxy settings.");
            }
            throw err;
        }
    }

    // ==========================================
    // File System Helpers
    // ==========================================

    async search(query, token) {
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&pageSize=100&fields=files(id,name,modifiedTime)`;
        const resp = await this.driveRequest(url, 'GET', token);
        const data = await resp.json();
        return data.files || [];
    }

    async ensureFolder(name, parentId, token) {
        let q = `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`;
        if (parentId) q += ` and '${parentId}' in parents`;

        const files = await this.search(q, token);
        if (files.length > 0) return files[0].id;

        // Create
        const metadata = {
            name: name,
            mimeType: 'application/vnd.google-apps.folder'
        };
        if (parentId) metadata.parents = [parentId];

        const resp = await this.driveRequest(
            'https://www.googleapis.com/drive/v3/files',
            'POST',
            token,
            JSON.stringify(metadata)
        );
        const file = await resp.json();
        return file.id;
    }

    async downloadJson(fileId, token) {
        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
        const resp = await this.driveRequest(url, 'GET', token);
        return await resp.json();
    }

    async uploadJson(name, data, parentId, fileId, token) {
        const metadata = { name: name, mimeType: 'application/json' };
        if (parentId && !fileId) metadata.parents = [parentId];

        const boundary = '-------314159265358979323846';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";

        const multipartBody =
            delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) +
            delimiter + 'Content-Type: application/json\r\n\r\n' + JSON.stringify(data) +
            close_delim;

        let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
        let method = 'POST';

        if (fileId) {
            url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
            method = 'PATCH';
        }

        const contentType = `multipart/related; boundary=${boundary}`;
        await this.driveRequest(url, method, token, multipartBody, contentType);
    }

    // ==========================================
    // Main Sync Logic
    // ==========================================

    async sync() {
        let toast = null;
        try {
            if (!navigator.onLine) throw new Error("You are currently offline. Please check your internet connection.");

            toast = this.showToast('🔄 Initializing Folder Sync...');
            const token = await this.handleAuthClick();
            if (!token) {
                if (toast) toast.remove();
                return; // Auth in progress or cancelled
            }

            // 1. Load Settings (including GDrive Root)
            const settingsRes = await window.appStorage.get('settings');
            const settings = settingsRes.settings || {};
            const syncRegistry = settings.gdrive_sync_registry || {};
            const rootFolderName = settings.gdrive_root_folder || this.ROOT_FOLDER_NAME;

            // 1b. Locate Folders
            console.log(`[Sync] Connecting to Google Drive (Root: ${rootFolderName})...`);
            const rootId = await this.ensureFolder(rootFolderName, null, token);
            const articlesFolderId = await this.ensureFolder(this.ARTICLES_FOLDER_NAME, rootId, token);
            const notesFolderId = await this.ensureFolder(this.NOTES_FOLDER_NAME, rootId, token);
            const memoryFolderId = await this.ensureFolder(this.MEMORY_FOLDER_NAME, rootId, token);

            // 2. Fetch Remote Index
            this.updateToast(toast, '📄 Fetching cloud index...');
            const indexFiles = await this.search(`name='${this.INDEX_FILE_NAME}' and '${rootId}' in parents and trashed=false`, token);
            let remoteIndex = [];
            let indexFileId = null;

            if (indexFiles.length > 0) {
                indexFileId = indexFiles[0].id;
                remoteIndex = await this.downloadJson(indexFileId, token);
            }

            // 3. Prepare Local Data
            const localRawData = window.appStorage ? await window.appStorage.getAll() : {};
            const localItems = this.extractLocalItems(localRawData, syncRegistry);

            // 4. Reconcile (Compare Local vs Remote)
            const { toUpload, toDownload, newIndex, indexPruned } = this.reconcile(localItems, remoteIndex, syncRegistry);

            // 5. Execute Downloads
            if (toDownload.length > 0) {
                await this.batchDownload(toDownload, { articles: articlesFolderId, notes: notesFolderId }, token, toast, syncRegistry);
            }

            // 6. Execute Uploads
            if (toUpload.length > 0) {
                await this.batchUpload(toUpload, { articles: articlesFolderId, notes: notesFolderId }, token, toast, syncRegistry);
            }

            // 7. Update Remote Index (Force update if we pruned legacy items or had updates)
            if (toUpload.length > 0 || indexPruned) {
                this.updateToast(toast, '📝 Updating cloud index...');
                await this.uploadJson(this.INDEX_FILE_NAME, newIndex, rootId, indexFileId, token);
            }

            // 8. Sync Memories
            await this.syncMemories(localRawData, memoryFolderId, token);

            // 9. Save updated Sync Registry
            const currentSettings = (await window.appStorage.get('settings')).settings || {};
            currentSettings.gdrive_sync_registry = syncRegistry;
            await window.appStorage.set({ settings: currentSettings });

            this.updateToast(toast, '✅ Sync Complete!', 2000);
            setTimeout(() => location.reload(), 1500);

        } catch (err) {
            console.error('[Sync Error]', err);
            if (toast) toast.remove();

            let msg = err.message;
            if (msg.includes('fetch') || msg === 'Failed to fetch' || err.name === 'TypeError') {
                msg = "Network Failure: Google Drive services are currently unreachable.\n\nPRO TIP: Ensure your VPN or Proxy is enabled and allows traffic to 'googleapis.com'.";
            }
            alert('Cloud Sync Failed:\n' + msg);
        }
    }

    // ==========================================
    // Logic & Helpers
    // ==========================================

    extractLocalItems(localData, syncRegistry = {}) {
        const items = [];

        // 1. Articles (Reader items) and Individual Notes (Atomic Assets)
        Object.entries(localData).forEach(([key, val]) => {
            if (key === 'user_notes' || key === 'settings' || key.startsWith('meta_')) return;
            if (!val) return;

            // Detection A: Highlights array (Article)
            const isHighlightsArray = Array.isArray(val) && (val.length >= 0 && (val.length === 0 || (val[0].hasOwnProperty('text') || val[0].hasOwnProperty('content') || val[0].hasOwnProperty('quote'))));

            if (isHighlightsArray) {
                const highlights = val;
                const timestamps = highlights.map(h => h.timestamp || 0);
                const updatedAt = Math.max(0, ...timestamps);

                items.push({
                    id: key,
                    url: key,
                    type: 'article',
                    highlights: highlights,
                    updatedAt: updatedAt,
                    size: JSON.stringify(val).length, // SIZE
                    title: highlights[0]?.title || 'Untitled Article'
                });
                return;
            }

            // Detection B: Atomic Note Asset
            const looksLikeNote = (val.type === 'note') || (val.hasOwnProperty('content') && !val.url);
            const hasNoteKey = key.startsWith('note-') || key.startsWith('note_');

            if ((hasNoteKey || looksLikeNote) && typeof val === 'object' && !Array.isArray(val)) {
                // Check if this note is redundant (already exists in user_notes array)
                const isRedundant = localData.user_notes && Array.isArray(localData.user_notes) &&
                    localData.user_notes.some(n => String(n.id) === String(key) || String(n.id) === String(val.id));

                if (isRedundant) {
                    console.log(`[Sync] Found redundant flat note key: ${key}. Cleaning up...`);
                    window.appStorage.remove(key);
                    return;
                }

                const updatedAt = val.updatedAt || val.timestamp || 0;
                items.push({
                    id: key,
                    type: 'note',
                    title: val.title || 'Untitled Note',
                    updatedAt: updatedAt,
                    size: JSON.stringify(val).length,
                    _raw: val
                });
            }
        });

        // 2. Legacy Note Database (Unified Collection Migration)
        if (Array.isArray(localData.user_notes)) {
            let modified = false;
            const seenIds = new Set();
            const uniqueNotes = [];

            localData.user_notes.forEach(n => {
                // Ensure atomic ID pattern
                const currentId = String(n.id || '');
                if (!currentId.startsWith('note-') && !currentId.startsWith('note_')) {
                    n.id = `note-${n.timestamp || Date.now()}`;
                    modified = true;
                }

                if (!seenIds.has(n.id)) {
                    seenIds.add(n.id);
                    uniqueNotes.push(n);

                    const updatedAt = n.updatedAt || n.timestamp || 0;

                    items.push({
                        id: n.id,
                        type: 'note',
                        title: n.title || 'Untitled Note',
                        updatedAt: updatedAt,
                        size: JSON.stringify(n).length, // SIZE
                        _raw: n
                    });
                } else {
                    modified = true;
                }
            });

            if (modified) {
                localData.user_notes = uniqueNotes;
                window.appStorage.set({ user_notes: uniqueNotes });
            }
        }

        return items;
    }

    reconcile(localItems, remoteIndex, syncRegistry = {}) {
        const toUpload = [];
        const toDownload = [];
        const newIndex = [...remoteIndex];
        const remoteMap = new Map();

        remoteIndex.forEach(i => {
            const id = String(i.id || i.url);
            remoteMap.set(id, i);
        });

        const localIds = new Set();
        for (const local of localItems) {
            const id = String(local.id);
            localIds.add(id);

            const remote = remoteMap.get(id);

            if (!remote) {
                // New local item: Upload
                const idxEntry = {
                    id: id,
                    url: local.url || null,
                    title: local.title || 'Untitled',
                    updatedAt: local.updatedAt,
                    size: local.size || 0,
                    type: local.type
                };
                toUpload.push(local);
                newIndex.push(idxEntry);
                console.log(`[Sync] Mobile found new item to upload: ${id}`);
            } else {
                // ID exists on server already: Apply PC Rule (Size + Timestamp)
                const localSize = local.size || 0;
                const remoteSize = remote.size || 0;

                if (localSize === remoteSize) {
                    console.log(`[Sync] ID ${id} identical size (${localSize}). Skipping.`);
                    continue;
                } else {
                    const localTime = Number(local.updatedAt || local.timestamp || 0);
                    const remoteTime = Number(remote.updatedAt || remote.timestamp || 0);

                    if (localTime > remoteTime) {
                        toUpload.push(local);
                        const idx = newIndex.findIndex(i => String(i.id || i.url) === id);
                        if (idx !== -1) {
                            newIndex[idx].updatedAt = localTime;
                            newIndex[idx].size = localSize;
                        }
                        console.log(`[Sync] Local updated: ${id}`);
                    } else if (remoteTime > localTime) {
                        toDownload.push(remote);
                        console.log(`[Sync] Server updated: ${id}`);
                    }
                }
                continue;
            }
        }

        // Check for items on remote that are missing locally & Pruning Legacy DBs
        let indexPruned = false;
        for (const remote of remoteIndex) {
            const id = String(remote.id || remote.url);

            // PRUNE LEGACY UNIFIED DB
            if (id === 'system_user_notes_db') {
                const idx = newIndex.findIndex(i => String(i.id || i.url) === id);
                if (idx !== -1) {
                    newIndex.splice(idx, 1);
                    indexPruned = true;
                }
                continue;
            }

            if (!localIds.has(id)) {
                // Skip if registry matches to stop "Ghost Loops"
                const registeredTime = syncRegistry[id] || 0;
                if (registeredTime >= remote.updatedAt) continue;

                // Missing locally: Download
                if (!toDownload.some(i => String(i.id || i.url) === id)) {
                    toDownload.push(remote);
                    console.log(`[Sync] Mobile found missing server item to download: ${id}`);
                }
            }
        }

        return { toUpload, toDownload, newIndex, indexPruned };
    }

    async batchUpload(items, folders, token, toast, syncRegistry = {}) {
        const total = items.length;
        let completed = 0;
        const poolSize = 3; // Reduced for memory safety on mobile
        const uploadTime = Date.now();

        for (let i = 0; i < total; i += poolSize) {
            const chunk = items.slice(i, i + poolSize);
            await Promise.all(chunk.map(async (item) => {
                const id = String(item.id);
                const folderId = item.type === 'note' ? folders.notes : folders.articles;

                // Find existing file
                const files = await this.search(`name contains '${id}.json' and '${folderId}' in parents and trashed=false`, token);
                const fileId = files.length > 0 ? files[0].id : null;
                let fileName = files.length > 0 ? files[0].name : null;

                if (!fileName) {
                    const safeTitle = (item.title || 'Untitled').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').substring(0, 50);
                    fileName = `${safeTitle}_${id}.json`;
                }

                item.updatedAt = Math.max(item.updatedAt || 0, uploadTime);

                // Atomic Payload
                const payload = item.type === 'note' ? item._raw : item;
                await this.uploadJson(fileName, payload, folderId, fileId, token);

                syncRegistry[id] = item.updatedAt;
                completed++;
                if (toast) this.updateToast(toast, `⬆️ Uploading (${completed}/${total})...`);
            }));
        }
    }

    async batchDownload(indexItems, folders, token, toast, syncRegistry = {}) {
        const total = indexItems.length;
        let completed = 0;
        const poolSize = 3;
        const results = {};
        let notesModified = false;

        const currentNotes = (await window.appStorage.get('user_notes')).user_notes || [];
        const notesMap = new Map(currentNotes.map(n => [String(n.id || n.timestamp), n]));

        for (let i = 0; i < total; i += poolSize) {
            const chunk = indexItems.slice(i, i + poolSize);
            await Promise.all(chunk.map(async (remoteEntry) => {
                const id = String(remoteEntry.id || remoteEntry.url);
                const folderId = remoteEntry.type === 'note' ? folders.notes : folders.articles;

                const files = await this.search(`name contains '${id}.json' and '${folderId}' in parents and trashed=false`, token);
                if (files.length > 0) {
                    try {
                        const data = await this.downloadJson(files[0].id, token);
                        if (remoteEntry.type === 'note') {
                            // FORCE ID MATCH: Prevent download cycles due to ID variations
                            data.id = id;

                            const existing = notesMap.get(id);
                            if (!existing || (remoteEntry.updatedAt > (existing.updatedAt || existing.timestamp || 0))) {
                                notesMap.set(id, data);
                                notesModified = true;
                            }
                        } else if (data.highlights) {
                            results[data.url || id] = data.highlights;
                        }
                        syncRegistry[id] = remoteEntry.updatedAt;
                    } catch (e) {
                        console.error(`[Sync] Failed to download ${id}:`, e);
                    }
                }
                completed++;
                if (toast) this.updateToast(toast, `⬇️ Downloading (${completed}/${total})...`);
            }));
        }

        if (notesModified) {
            const finalNotes = Array.from(notesMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            results['user_notes'] = finalNotes;
        }

        if (Object.keys(results).length > 0 && window.appStorage) {
            this.updateToast(toast, `💾 Saving atomic data...`);
            await window.appStorage.set(results);
        }
    }

    async syncMemories(localData, folderId, token) {
        const memoryKeys = ['memory_long_term', 'memory_short_recent'];
        for (const key of memoryKeys) {
            if (!localData[key]) continue;
            const fileName = key === 'memory_long_term' ? 'MEMORY.md' : `${key}.md`;
            const localContent = localData[key];
            const files = await this.search(`name='${fileName}' and '${folderId}' in parents and trashed=false`, token);
            let combined = localContent;
            let fileId = null;

            if (files.length > 0) {
                fileId = files[0].id;
                const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
                try {
                    const remoteResp = await this.driveRequest(url, 'GET', token);
                    const remoteContent = await remoteResp.text();
                    combined = this.mergeText(localContent, remoteContent);
                } catch (e) { console.warn(`[Sync] Merge failed for ${fileName}`, e); }
            }

            if (combined !== localContent) await window.appStorage.set({ [key]: combined });
            await this.uploadFile(fileName, combined, 'text/markdown', folderId, fileId, token);
        }
    }

    async uploadFile(name, content, mimeType, parentId, fileId, token) {
        const metadata = { name, mimeType };
        if (parentId && !fileId) metadata.parents = [parentId];
        const boundary = '-------314159265358979323846';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";
        const body = delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) +
            delimiter + `Content-Type: ${mimeType}\r\n\r\n` + content + close_delim;

        let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
        let method = 'POST';
        if (fileId) {
            url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
            method = 'PATCH';
        }
        const contentType = `multipart/related; boundary=${boundary}`;
        await this.driveRequest(url, method, token, body, contentType);
    }

    mergeText(a, b) {
        if (!a) return b || '';
        if (!b) return a || '';
        const set = new Set([...b.split('\n'), ...a.split('\n')]);
        return Array.from(set).join('\n');
    }

    showToast(msg, duration = 0) {
        let t = document.getElementById('sync-toast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'sync-toast';
            t.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);padding:20px;background:rgba(0,0,0,0.85);color:white;border-radius:10px;z-index:9999;text-align:center;font-size:14px;min-width:200px;';
            document.body.appendChild(t);
        }
        t.innerText = msg;
        if (duration > 0) setTimeout(() => t.remove(), duration);
        return t;
    }

    updateToast(el, msg, duration = 0) {
        if (el) el.innerText = msg;
        if (duration > 0) setTimeout(() => el && el.remove(), duration);
    }
}

window.mobileGDrive = new MobileGDrive();
