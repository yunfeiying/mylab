/**
 * options-sync-ui.js - Sync UI Handlers
 * Handles click events for the Sync Menu items.
 */

window.setupSyncHandlers = function () {
    const sidebarSyncMenu = document.getElementById('sync-menu');

    // 1. Google Drive Sync
    const itemGDrive = document.getElementById('menu-sync-gdrive');
    if (itemGDrive) {
        itemGDrive.onclick = async (e) => {
            console.log('[Sync] Google Drive button clicked');
            e.preventDefault(); e.stopPropagation();
            if (!window.IS_PRO) {
                console.log('[Sync] Not Pro');
                return window.showToast(chrome.i18n.getMessage('ui_proOnly'));
            }

            const switchEl = document.getElementById('gdrive-sync-switch');
            if (!switchEl || !switchEl.checked) {
                if (sidebarSyncMenu) sidebarSyncMenu.style.display = 'none';
                const settingsModal = document.getElementById('settings-modal');
                if (settingsModal) settingsModal.style.display = 'flex';
                window.showToast('Please enable Google Drive Sync first ⚠️');
                return;
            }

            if (sidebarSyncMenu) sidebarSyncMenu.style.display = 'none';
            window.showToast('Google Drive Sync Initiated (Background)...');

            try {
                // Determine if we should use the legacy mode or the new background service
                // The user's feedback suggests they see Highlighti_Data, so we should prefer the Service.
                // We use sendMessage to offload network requests to Background Service Worker (avoiding CSP/CORS issues)

                chrome.runtime.sendMessage({ action: 'START_GDRIVE_SYNC' }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('[Sync] Runtime Warning:', chrome.runtime.lastError);
                        // Fallback or just report
                        window.showToast('Communication Error: ' + chrome.runtime.lastError.message);
                        return;
                    }

                    if (response && response.success) {
                        window.showToast('Google Drive Sync Success! ✅');
                        // Reload UI to show any new data
                        setTimeout(() => {
                            if (typeof window.loadData === 'function') window.loadData().then(() => {
                                if (typeof window.renderSidebar === 'function') window.renderSidebar();
                            });
                        }, 500);
                    } else {
                        console.error('[Sync] Service Failure:', response?.error);
                        let msg = response?.error || 'Unknown Error';
                        if (msg === 'Sync Disabled') msg = 'Sync Disabled in Settings';
                        window.showToast('Sync Failed: ' + msg);
                    }
                });

            } catch (error) {
                console.error('[Sync] Trigger Error:', error);
                window.showToast('Trigger Failed: ' + error.message);
            }
        };
    }

    // 2. WebDAV Sync
    const itemWebDav = document.getElementById('menu-sync-webdav');
    if (itemWebDav) {
        itemWebDav.onclick = async (e) => {
            e.preventDefault(); e.stopPropagation();
            if (!window.IS_PRO) return window.showToast(chrome.i18n.getMessage('ui_proOnly'));

            const settings = await chrome.storage.local.get(['webdav_url', 'webdav_user', 'webdav_pass']);
            if (!settings.webdav_url || !settings.webdav_user || !settings.webdav_pass) {
                if (sidebarSyncMenu) sidebarSyncMenu.style.display = 'none';
                const settingsModal = document.getElementById('settings-modal');
                if (settingsModal) settingsModal.style.display = 'flex';
                window.showToast('Please configure WebDAV first ⚠️');
                return;
            }

            if (sidebarSyncMenu) sidebarSyncMenu.style.display = 'none';
            window.showToast('WebDAV Sync Started...');

            try {
                if (typeof window.syncToWebDav === 'function') {
                    await window.syncToWebDav(settings);
                    // toast handled inside
                    setTimeout(() => {
                        if (typeof window.loadData === 'function') window.loadData().then(() => { if (typeof window.renderSidebar === 'function') window.renderSidebar(); });
                    }, 500);
                } else {
                    console.error("syncToWebDav not found");
                }
            } catch (error) {
                console.error('WebDAV Error:', error);
                let msg = 'Sync Failed';
                if (error.status === 401) msg = 'Auth Failed (Check App Password)';
                else if (error.status === 404) msg = 'File not found (First Sync?)';
                else msg = error.message || 'Network Error';
                window.showToast(msg);
            }
        };
    }

    // 3. NotebookLM Sync (Toggle)
    const itemNotebookLM = document.getElementById('menu-sync-notebooklm');
    if (itemNotebookLM) {
        itemNotebookLM.onclick = async (e) => {
            e.preventDefault(); e.stopPropagation();
            if (!window.IS_PRO) return window.showToast(chrome.i18n.getMessage('ui_proOnly'));

            const res = await chrome.storage.local.get('notebooklm_sync_enabled');
            const newState = !res.notebooklm_sync_enabled;
            await chrome.storage.local.set({ notebooklm_sync_enabled: newState });

            if (newState) window.showToast('NotebookLM Auto-Sync: ON ✅');
            else window.showToast('NotebookLM Auto-Sync: OFF ❌');

            const switchEl = document.getElementById('notebooklm-sync-switch');
            if (switchEl) {
                switchEl.checked = newState;
                const statusEl = document.getElementById('notebooklm-status');
                if (statusEl) statusEl.textContent = newState ? 'ON' : 'OFF';
            }

            if (sidebarSyncMenu) sidebarSyncMenu.style.display = 'none';
        };
    }

    // 4. Notion Sync
    const itemNotion = document.getElementById('menu-sync-notion');
    if (itemNotion) {
        itemNotion.onclick = async (e) => {
            e.preventDefault(); e.stopPropagation();
            if (!window.IS_PRO) return window.showToast(chrome.i18n.getMessage('ui_proOnly'));

            const settings = await chrome.storage.local.get(['notion_token', 'notion_page_id']);
            if (!settings.notion_token || !settings.notion_page_id) {
                if (sidebarSyncMenu) sidebarSyncMenu.style.display = 'none';
                const settingsModal = document.getElementById('settings-modal');
                if (settingsModal) settingsModal.style.display = 'flex';
                window.showToast('Please configure Notion first ⚠️');
                return;
            }

            if (sidebarSyncMenu) sidebarSyncMenu.style.display = 'none';
            window.showToast('Syncing Memory to Notion...');

            try {
                chrome.runtime.sendMessage({ action: 'START_NOTION_SYNC' }, (response) => {
                    if (chrome.runtime.lastError) {
                        window.showToast('Error: ' + chrome.runtime.lastError.message);
                    } else if (response && response.success) {
                        window.showToast('Notion Sync Success! 🧠');
                    } else {
                        window.showToast('Sync Failed: ' + (response ? response.error : 'Unknown'));
                    }
                });
            } catch (e) {
                window.showToast('Error: ' + e.message);
            }
        };
    }
};

console.log('[options-sync-ui.js] Loaded: Sync UI handlers');
