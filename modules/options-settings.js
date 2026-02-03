/**
 * options-settings.js - Settings & Configuration Handlers
 * Handles saving keys, configuring sync providers, license verification, and language settings.
 */

window.setupSettingsHandlers = function () {

    // 1. Language Selection
    const langSelect = document.getElementById('language-select');
    if (langSelect) {
        window.appStorage.get('app_language').then((res) => {
            langSelect.value = res.app_language || 'auto';
        });
        langSelect.onchange = () => {
            const newLang = langSelect.value;
            window.appStorage.set({ 'app_language': newLang }).then(() => {
                location.reload();
            });
        };
    }

    // 2. OCR Shortcut
    const ocrSelect = document.getElementById('ocr-shortcut-select');
    if (ocrSelect) {
        window.appStorage.get('ocr_shortcut_mode').then((res) => {
            ocrSelect.value = res.ocr_shortcut_mode || 'alt';
        });
        ocrSelect.onchange = () => {
            const newMode = ocrSelect.value;
            window.appStorage.set({ 'ocr_shortcut_mode': newMode }).then(() => {
                window.showToast(chrome.i18n.getMessage('msg_saved') || 'Saved');
            });
        };
    }

    // 3. License Modal Toggles
    const btnCloseLicense = document.getElementById('btn-close-license');
    if (btnCloseLicense) {
        btnCloseLicense.onclick = () => { const m = document.getElementById('license-modal'); if (m) m.style.display = 'none'; };
    }
    const licenseModal = document.getElementById('license-modal');
    if (licenseModal) {
        licenseModal.onclick = (e) => { if (e.target === licenseModal) licenseModal.style.display = 'none'; };
    }
    const btnActivateIntro = document.getElementById('btn-activate-intro');
    if (btnActivateIntro) {
        btnActivateIntro.onclick = () => {
            const sm = document.getElementById('settings-modal'); if (sm) sm.style.display = 'none';
            const lm = document.getElementById('license-modal'); if (lm) lm.style.display = 'flex';
        };
    }

    // 4. Verify License
    const btnVerify = document.getElementById('btn-verify-license');
    if (btnVerify) {
        btnVerify.onclick = async () => {
            const input = document.getElementById('license-input');
            const key = input ? input.value.trim() : '';

            if (!key) return alert(chrome.i18n.getMessage('msg_inputKey'));
            btnVerify.innerText = '...';
            btnVerify.disabled = true;

            const response = await chrome.runtime.sendMessage({ action: 'VERIFY_LICENSE', key: key });

            if (response && response.success) {
                alert(chrome.i18n.getMessage('msg_activateSuccess'));
                location.reload();
            } else {
                alert(chrome.i18n.getMessage('msg_activateFail', [response.error || 'Invalid Key']));
                btnVerify.innerText = chrome.i18n.getMessage('opt_activate');
                btnVerify.disabled = false;
            }
        };
    }

    // 5. Settings Modal Toggles
    const btnSettings = document.getElementById('btn-settings');
    if (btnSettings) {
        btnSettings.onclick = () => {
            document.getElementById('settings-modal').style.display = 'flex';
            if (typeof window.renderColorSettings === 'function') window.renderColorSettings();
        };
    }
    const closeSettings = document.getElementById('close-settings-modal');
    if (closeSettings) closeSettings.onclick = () => document.getElementById('settings-modal').style.display = 'none';
    const closeSettingsBtn = document.getElementById('btn-close-settings-bottom');
    if (closeSettingsBtn) closeSettingsBtn.onclick = () => document.getElementById('settings-modal').style.display = 'none';

    // 6. Save AI Config
    const btnSaveAI = document.getElementById('btn-save-ai-config');
    if (btnSaveAI) {
        btnSaveAI.onclick = async () => {
            const k = document.getElementById('api-key-input').value.trim();
            const u = document.getElementById('api-url-input').value.trim();
            const m = document.getElementById('api-model-input').value.trim();

            await window.appStorage.set({
                'ai_api_key': k,
                'ai_base_url': u,
                'ai_model': m,
                'openai_api_key': k,
                'openai_api_url': u,
                'openai_model': m,
                'deepseek_api_key': k,
                'deepseek_base_url': u,
                'deepseek_model': m
            });

            window.showToast(chrome.i18n.getMessage('smart_keySaved') || 'AI Settings Saved');
        };
    }

    // 7. Save Notion Config
    const btnSaveNotion = document.getElementById('btn-save-notion');
    if (btnSaveNotion) {
        btnSaveNotion.onclick = async () => {
            const token = document.getElementById('notion-token').value.trim();
            const pageId = document.getElementById('notion-page-id').value.trim();

            if (!token.startsWith('secret_') && !token.startsWith('ntn_')) {
                window.showToast('Invalid Token (must start with secret_ or ntn_)');
                return;
            }

            // Extract ID if full URL pasted
            let finalId = pageId;
            if (pageId.includes('notion.so')) {
                const parts = pageId.split('-');
                finalId = parts[parts.length - 1].split('?')[0]; // Simple extraction
            }

            await window.appStorage.set({
                notion_token: token,
                notion_page_id: finalId
            });
            window.showToast('Notion Config Saved');
        };
    }

    // 8. Save WebDAV Config
    const btnSaveWebDav = document.getElementById('btn-save-webdav');
    if (btnSaveWebDav) {
        btnSaveWebDav.onclick = () => {
            console.log('[Settings] Save WebDAV Config clicked');
            if (!window.IS_PRO) return window.showToast(chrome.i18n.getMessage('ui_proOnly') || 'Pro Feature Only');

            let davUrl = document.getElementById('sync-url').value;
            const davUser = document.getElementById('sync-user').value;
            const davPass = document.getElementById('sync-pass').value;

            if (davUrl.includes('jianguoyun') && !davUrl.includes('/dav/')) {
                if (!davUrl.endsWith('/')) davUrl += '/'; davUrl += 'dav/';
                document.getElementById('sync-url').value = davUrl;
            }

            console.log('[Settings] Saving WebDAV:', davUrl, davUser);
            window.appStorage.set({ 'webdav_url': davUrl, 'webdav_user': davUser, 'webdav_pass': davPass }).then(() => {
                console.log('[Settings] WebDAV settings saved.');
                window.showToast(chrome.i18n.getMessage('msg_webdavSaved') || 'WebDAV Config Saved');
            });
        };
    }

    // 9. Save Google Drive Config
    const btnSaveGDrive = document.getElementById('btn-save-gdrive');
    if (btnSaveGDrive) {
        btnSaveGDrive.onclick = () => {
            console.log('[Settings] Save Google Drive Config clicked');
            if (!window.IS_PRO) return window.showToast(chrome.i18n.getMessage('ui_proOnly') || 'Pro Feature Only');

            const gdriveEnabled = document.getElementById('gdrive-sync-switch').checked;
            const nbEnabled = document.getElementById('notebooklm-sync-switch') ? document.getElementById('notebooklm-sync-switch').checked : false;

            console.log('[Settings] Saving GDrive:', gdriveEnabled, 'NotebookLM:', nbEnabled);

            window.appStorage.set({
                'gdrive_sync_enabled': gdriveEnabled,
                'notebooklm_sync_enabled': nbEnabled
            }).then(() => {
                const status = document.getElementById('gdrive-status');
                if (status) status.innerText = gdriveEnabled ? 'ON' : 'OFF';

                const nbStatus = document.getElementById('notebooklm-status');
                if (nbStatus) nbStatus.innerText = nbEnabled ? 'ON' : 'OFF';

                console.log('[Settings] Google Drive settings saved.');
                window.showToast(chrome.i18n.getMessage('msg_gdriveSaved') || 'Google Drive Settings Saved');
            });
        };
    }

    // 10. Sync Mode Selection
    const syncModeSelect = document.getElementById('sync-mode-select');
    const syncWarning = document.getElementById('sync-mode-warning');
    if (syncModeSelect) {
        window.appStorage.get('sync_mode').then((res) => {
            syncModeSelect.value = res.sync_mode || 'merge';
            if (syncModeSelect.value === 'overwrite' && syncWarning) {
                syncWarning.style.display = 'block';
            }
        });
        syncModeSelect.onchange = () => {
            const val = syncModeSelect.value;
            window.appStorage.set({ 'sync_mode': val });
            if (val === 'overwrite' && syncWarning) syncWarning.style.display = 'block';
            else if (syncWarning) syncWarning.style.display = 'none';
        };
    }

    // 11. Initial UI State Updates (formerly in initUI)
    const btnActivate = document.getElementById('btn-activate-pro');
    const btnAI = document.getElementById('btn-smart-generate');
    const btnDaily = document.getElementById('btn-daily-summary');
    const btnAICompose = document.getElementById('btn-ai-compose');
    const btnSync = document.getElementById('btn-sync-now');
    const btnChat = document.getElementById('btn-chat-view');
    const freeIntro = document.getElementById('free-version-intro');
    const proContent = document.getElementById('pro-settings-content');

    // Link update in footer
    const settingsFooter = document.getElementById('settings-modal')?.querySelector('.modal-footer');
    if (settingsFooter && !document.getElementById('highlighti-link')) {
        const link = document.createElement('a');
        link.id = 'highlighti-link';
        link.href = "https://highlighti.com";
        link.target = "_blank";
        link.innerText = "Visit Highlighti.com";
        link.style.cssText = "font-size:12px; color:#1976d2; margin-right:auto; text-decoration:none;";
        settingsFooter.prepend(link);
    }
    if (freeIntro) {
        freeIntro.innerHTML = freeIntro.innerHTML.replace(/Highlighter Pro/g, 'Highlighti');
    }

    // --- NEW: Populate UI from Storage on Load ---
    console.log('[Settings] Populating UI from storage...');
    const keysToLoad = [
        'gdrive_sync_enabled', 'notebooklm_sync_enabled',
        'webdav_url', 'webdav_user', 'webdav_pass',
        'notion_token', 'notion_page_id',
        'ai_api_key', 'ai_base_url', 'ai_model'
    ];

    window.appStorage.get(keysToLoad).then((res) => {
        // GDrive
        const gdSwitch = document.getElementById('gdrive-sync-switch');
        if (gdSwitch) gdSwitch.checked = !!res.gdrive_sync_enabled;
        const nbSwitch = document.getElementById('notebooklm-sync-switch');
        if (nbSwitch) nbSwitch.checked = !!res.notebooklm_sync_enabled;

        // Status Labels
        const gdStatus = document.getElementById('gdrive-status');
        if (gdStatus) gdStatus.innerText = res.gdrive_sync_enabled ? 'ON' : 'OFF';
        const nbStatus = document.getElementById('notebooklm-status');
        if (nbStatus) nbStatus.innerText = res.notebooklm_sync_enabled ? 'ON' : 'OFF';

        // WebDAV
        if (document.getElementById('sync-url')) document.getElementById('sync-url').value = res.webdav_url || '';
        if (document.getElementById('sync-user')) document.getElementById('sync-user').value = res.webdav_user || '';
        if (document.getElementById('sync-pass')) document.getElementById('sync-pass').value = res.webdav_pass || '';

        // Notion
        if (document.getElementById('notion-token')) document.getElementById('notion-token').value = res.notion_token || '';
        if (document.getElementById('notion-page-id')) document.getElementById('notion-page-id').value = res.notion_page_id || '';

        // AI
        if (document.getElementById('api-key-input')) document.getElementById('api-key-input').value = res.ai_api_key || '';
        if (document.getElementById('api-url-input')) document.getElementById('api-url-input').value = res.ai_base_url || 'https://api.deepseek.com';
        if (document.getElementById('api-model-input')) document.getElementById('api-model-input').value = res.ai_model || 'deepseek-chat';

        console.log('[Settings] UI Population Complete', res);
    });

    if (window.IS_PRO) {
        if (btnActivate) btnActivate.style.display = 'none';
        if (btnAI) btnAI.style.display = 'inline-flex';
        if (btnDaily) btnDaily.style.display = 'inline-flex';
        if (btnAICompose) btnAICompose.style.display = 'inline-flex';
        if (btnSync) btnSync.style.display = 'inline-flex';
        if (btnChat) btnChat.style.display = 'inline-flex';
        if (freeIntro) freeIntro.style.display = 'none';
        if (proContent) proContent.style.display = 'block';
    } else {
        if (btnActivate) btnActivate.style.display = 'block';
        if (btnAI) btnAI.style.display = 'none';
        if (btnDaily) btnDaily.style.display = 'none';
        if (btnAICompose) btnAICompose.style.display = 'none';
        if (btnSync) btnSync.style.display = 'none';
        if (btnChat) btnChat.style.display = 'none';
        if (freeIntro) freeIntro.style.display = 'block';
        if (proContent) proContent.style.display = 'none';
    }
};

console.log('[options-settings.js] Loaded: Settings and Config handlers');
