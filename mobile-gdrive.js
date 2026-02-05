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
    }

    // ==========================================
    // Core Auth & API Wrappers
    // ==========================================

    async getAuthToken(interactive = true) {
        // --- 1. Preferred: Chrome Identity (Extension Context) ---
        if (typeof chrome !== 'undefined' && chrome.identity && chrome.identity.getAuthToken) {
            return new Promise((resolve, reject) => {
                chrome.identity.getAuthToken({ interactive }, (token) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error("Auth Error: " + chrome.runtime.lastError.message));
                    } else if (!token) {
                        reject(new Error("Google Identity returned an empty token. Please sign in again."));
                    } else {
                        resolve(token);
                    }
                });
            });
        }

        // Fallback sensing (Ask user for token if not found or expired)
        const settingsRes = await window.appStorage.get('settings');
        const settings = settingsRes.settings || {};

        const savedToken = localStorage.getItem('gdrive_web_token');
        const expiry = localStorage.getItem('gdrive_web_token_expiry');

        // If we have manual CLIENT_ID/API_KEY, we could theoretically refresh, 
        // but for now we still rely on the Access Token.
        if (settings.gdrive_client_id) {
            console.log('[Sync] Using manual Client ID:', settings.gdrive_client_id);
        }

        // If token exists and hasn't expired (leave some buffer)
        if (savedToken && expiry && Date.now() < (parseInt(expiry) - 60000)) {
            return savedToken;
        }

        if (!interactive) return null;

        // Force a new token if we get here and it's interactive
        const promptMsg = settings.gdrive_client_id
            ? `Your token has expired.\nPlease paste a fresh Google Access Token for Client ID: ${settings.gdrive_client_id}`
            : `Your token has expired or is missing.\nPlease paste a fresh Google Access Token to continue (obtained from GCP Console):`;

        const manualToken = prompt("[API Sync Required]\n" + promptMsg, "");
        if (manualToken) {
            localStorage.setItem('gdrive_web_token', manualToken);
            localStorage.setItem('gdrive_web_token_expiry', Date.now() + 3500 * 1000);
            return manualToken;
        }

        throw new Error("Google Authentication required. Please provide a token or use WebDAV sync.");
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
                    console.warn("[Sync] Token expired (401), clearing storage...");
                    localStorage.removeItem('gdrive_web_token');
                    localStorage.removeItem('gdrive_web_token_expiry');
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
            const token = await this.getAuthToken(true);

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
