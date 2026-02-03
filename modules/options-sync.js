/**
 * options-sync.js - 数据同步逻辑 (Google Drive & WebDAV)
 * 包含: getAuthToken, findDriveFile, mergeCloudDataLocal, syncToGoogleDriveDirectly, syncToWebDav 等
 */

window.DRIVE_FILENAME = 'highlighter_backup.json';

// ==========================================
// 1. Google Drive 同步核心
// ==========================================

window.getAuthToken = function () {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, function (token) {
            if (chrome.runtime.lastError || !token) {
                const errorMsg = chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Token is null';
                console.error('Auth Error Details:', errorMsg);
                reject(new Error(`Auth Failed: ${errorMsg}`));
            } else {
                resolve(token);
            }
        });
    });
};

window.findDriveFile = async function (token) {
    const q = `name = '${window.DRIVE_FILENAME}' and trashed = false`;
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    return (data.files && data.files.length > 0) ? data.files[0].id : null;
};

window.mergeCloudDataLocal = function (local, cloud) {
    const merged = { ...local };
    let addedCount = 0;

    const trashItems = local.trash_bin || [];
    const trashKeys = new Set(Array.isArray(trashItems) ? trashItems.map(item => item.originalKey) : []);

    for (const [key, val] of Object.entries(cloud)) {
        if (trashKeys.has(key)) continue;

        if (Array.isArray(val) && Array.isArray(merged[key])) {
            const localIds = new Set(merged[key].map(i => i.id));
            const newItems = val.filter(i => !localIds.has(i.id));

            if (newItems.length > 0) {
                merged[key] = [...merged[key], ...newItems].sort((a, b) => b.timestamp - a.timestamp);
                addedCount += newItems.length;
            }
        } else if (!merged[key]) {
            merged[key] = val;
            if (Array.isArray(val)) addedCount += val.length;
        }
    }
    return { merged, count: addedCount };
};

window.syncToGoogleDriveDirectly = async function () {
    console.log('[Sync] syncToGoogleDriveDirectly called');
    try {
        const token = await window.getAuthToken();
        console.log('[Sync] Token acquired:', !!token);
        const existingFileId = await window.findDriveFile(token);
        console.log('[Sync] Existing File ID:', existingFileId);

        const settings = await chrome.storage.local.get(['sync_mode']);
        const isOverwriteMode = settings.sync_mode === 'overwrite';

        let localData = await chrome.storage.local.get(null);
        let incomingCount = 0;

        if (existingFileId && !isOverwriteMode) {
            console.log('[Sync] Merging with cloud data...');
            try {
                const downloadUrl = `https://www.googleapis.com/drive/v3/files/${existingFileId}?alt=media`;
                console.log('[Sync] Fetching cloud data from:', downloadUrl);

                const dlRes = await fetch(downloadUrl, { headers: { 'Authorization': `Bearer ${token}` } });
                console.log('[Sync] Download status:', dlRes.status, dlRes.statusText);

                if (dlRes.ok) {
                    try {
                        const cloudData = await dlRes.json();
                        console.log('[Sync] Cloud data downloaded. Keys:', Object.keys(cloudData).length);

                        const result = window.mergeCloudDataLocal(localData, cloudData);
                        console.log('[Sync] Merge complete. Incoming count:', result.count);

                        localData = result.merged;
                        incomingCount = result.count;
                        await chrome.storage.local.set(localData);
                        console.log('[Sync] Local storage updated.');
                    } catch (parseErr) {
                        console.error('[Sync] JSON Parse Error:', parseErr);
                    }
                } else {
                    console.warn('[Sync] Download not OK:', await dlRes.text());
                }
            } catch (e) {
                console.warn("[Sync] Merge warning:", e);
                if (e.message && (e.message.includes('Failed to fetch') || e.message.includes('NetworkError'))) {
                    throw new Error('Network Error: Check VPN/Proxy');
                }
            }
        }

        const uploadData = { ...localData };
        delete uploadData.smart_temp_content;
        delete uploadData.smart_temp_title;

        const fileContent = JSON.stringify(uploadData);
        const metadata = { name: window.DRIVE_FILENAME, mimeType: 'application/json' };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([fileContent], { type: 'application/json' }));

        let uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
        let method = 'POST';

        if (existingFileId) {
            uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`;
            method = 'PATCH';
        }

        console.log(`[Sync] Starting upload. Method: ${method}, URL: ${uploadUrl}`);

        const uploadRes = await fetch(uploadUrl, {
            method: method,
            headers: { 'Authorization': `Bearer ${token}` },
            body: form
        });

        console.log('[Sync] Upload response status:', uploadRes.status);

        if (!uploadRes.ok) throw new Error(`Upload Failed: ${uploadRes.status}`);

        if (incomingCount > 0) {
            window.showToast(chrome.i18n.getMessage('msg_syncSuccessCount', [incomingCount]));
        } else if (isOverwriteMode) {
            window.showToast('Cloud data overwritten with Local data');
        } else {
            window.showToast('Sync Complete (Cloud updated)');
        }
    } catch (err) {
        console.error('GDrive Sync Error:', err);
        window.showToast('Sync Failed: ' + err.message);
    }
};

window.restoreFromDrive = async function () {
    if (!confirm("⚠️ Warning: This will overwrite your local data with Cloud backup. Continue?")) return;
    try {
        const token = await window.getAuthToken();
        const fileId = await window.findDriveFile(token);
        if (!fileId) {
            alert("No backup found on Google Drive.");
            return;
        }
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        await chrome.storage.local.clear();
        await chrome.storage.local.set(data);
        alert("Restore Successful!");
        location.reload();
    } catch (error) {
        console.error('Restore Error:', error);
        alert(`Restore Failed: ${error.message}`);
    }
};

// ==========================================
// 2. WebDAV 同步核心
// ==========================================

window.syncToWebDav = async function (settings) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'START_WEBDAV_SYNC' }, (response) => {
            if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
            if (response && response.success) {
                if (response.incomingCount > 0) {
                    window.showToast(chrome.i18n.getMessage('msg_syncSuccessCount', [response.incomingCount]) || `Synced: +${response.incomingCount} items`);
                } else {
                    window.showToast('WebDAV Sync Complete');
                }
                resolve(response);
                if (typeof window.renderCategoryView === 'function') window.renderCategoryView();
            } else {
                reject(new Error(response ? response.error : 'Unknown Error'));
            }
        });
    });
};

console.log('[options-sync.js] Loaded: Sync logic (GDrive/WebDAV)');
