/**
 * mobile-core.js - Monolith Navigation Controller (V9.2)
 */

class MobileApp {
    constructor() {
        this.homeView = document.getElementById('view-home');
        this.chatView = document.getElementById('view-chat');
        this.editorView = document.getElementById('view-editor');
        this.globalSearch = document.getElementById('global-search');

        this.searchQuery = '';
        this.activeView = 'home';
        this.dataMap = new Map(); // Store full data objects here to avoid JSON attribute issues

        this.setupKeyboardTracking();
        this.setupEvents();
        console.log('MobileCore V10.7 (Monolith) Initialized');
    }

    // Robust date parser to prevent NaN display
    safeParseToNumber(val) {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        // Handle ISO strings, date strings, or numeric strings
        const parsed = new Date(val).getTime();
        return isNaN(parsed) ? 0 : parsed;
    }

    setupKeyboardTracking() {
        if (window.visualViewport) {
            const updateOffset = () => {
                const offset = window.innerHeight - window.visualViewport.height;
                // Only apply if offset is significant
                const finalOffset = offset > 50 ? offset : 0;
                document.documentElement.style.setProperty('--keyboard-offset', `${finalOffset}px`);

                if (finalOffset > 0) {
                    document.body.classList.add('keyboard-visible');
                } else {
                    document.body.classList.remove('keyboard-visible');
                }

                if (finalOffset > 0 && document.activeElement) {
                    setTimeout(() => {
                        document.activeElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
                    }, 300);
                }
            };
            window.visualViewport.addEventListener('resize', updateOffset);
            window.visualViewport.addEventListener('scroll', updateOffset);
        }
    }

    triggerUniversalSend(inputEl) {
        if (!inputEl) return;
        const text = inputEl.value.trim();
        if (window.mobileChat) {
            this.navigateTo('chat');
            if (typeof window.mobileChat.clearMessages === 'function') {
                window.mobileChat.clearMessages(); // Start fresh or clear
            }
            if (text) {
                window.mobileChat.input.value = text;
                window.mobileChat.handleSend();
                inputEl.value = '';
            }
        }
    }

    navigateToChat() {
        this.navigateTo('chat');
        if (window.mobileChat && typeof window.mobileChat.clearMessages === 'function') {
            window.mobileChat.clearMessages(); // Start fresh conversation
            setTimeout(() => {
                if (window.mobileChat.input) window.mobileChat.input.focus();
            }, 100);
        }
    }

    showActionSheet(context = 'home') {
        const sheet = document.getElementById('action-sheet-overlay');
        const saveBtn = document.getElementById('act-save-note');
        const syncBtn = document.getElementById('act-sync');

        if (context === 'home') {
            if (saveBtn) saveBtn.classList.add('hidden');
            if (syncBtn) syncBtn.classList.remove('hidden');
        } else {
            if (saveBtn) saveBtn.classList.remove('hidden');
            if (syncBtn) syncBtn.classList.add('hidden');
        }
        if (sheet) sheet.classList.remove('hidden');
    }

    setupEvents() {
        // Sidebar Toggle
        const sideBtn = document.getElementById('btn-sidebar-toggle');
        if (sideBtn) {
            sideBtn.onclick = () => {
                alert('Quick Actions Menu coming soon');
            };
        }

        // Settings Button
        const setBtn = document.getElementById('btn-settings');
        const sheet = document.getElementById('action-sheet-overlay');
        const cancelBtn = document.getElementById('act-cancel');

        if (setBtn) setBtn.onclick = () => this.showActionSheet('home');
        if (cancelBtn) cancelBtn.onclick = () => sheet.classList.add('hidden');
        if (sheet) sheet.onclick = (e) => { if (e.target === sheet) sheet.classList.add('hidden'); };

        const syncBtn = document.getElementById('act-sync');
        if (syncBtn) {
            syncBtn.onclick = () => {
                const sheet = document.getElementById('action-sheet-overlay');
                if (sheet) sheet.classList.add('hidden');
                if (window.mobileGDrive) {
                    window.mobileGDrive.sync();
                } else {
                    alert('Google Drive module not loaded.');
                }
            };
        }

        const syncWebdavBtn = document.getElementById('act-sync-webdav');
        if (syncWebdavBtn) {
            syncWebdavBtn.onclick = () => {
                const sheet = document.getElementById('action-sheet-overlay');
                if (sheet) sheet.classList.add('hidden');
                if (window.mobileSync && window.mobileSync.webDavSync) {
                    window.mobileSync.webDavSync();
                } else {
                    alert('WebDAV module not loaded.');
                }
            };
        }

        const saveBtn = document.getElementById('act-save-note');
        if (saveBtn) {
            saveBtn.onclick = () => {
                sheet.classList.add('hidden');
                if (window.mobileEditor) window.mobileEditor.saveNote();
            };
        }

        // --- Attachment Action Sheet Logic ---
        this.setupAttachmentSheet();

        // --- Global Core Hub logic ---
        const globalInput = document.getElementById('global-input');

        if (globalInput) {
            globalInput.oninput = (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.renderApp();
            };

            globalInput.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.triggerUniversalSend(globalInput);
                }
            };

            // Auto-navigate to chat when focusing on input from home/list views
            globalInput.onfocus = () => {
                const viewsToAutoChat = ['home', 'notes-all', 'reading-all'];
                if (viewsToAutoChat.includes(this.activeView)) {
                    this.navigateToChat();
                }
            };
        }

        // Headers
        const notesHeader = document.getElementById('header-notes-all');
        if (notesHeader) notesHeader.onclick = () => this.navigateTo('notes-all');

        const readingHeader = document.getElementById('header-reading-all');
        if (readingHeader) readingHeader.onclick = () => this.navigateTo('reading-all');

        // New Note Buttons
        const notesAllNew = document.getElementById('btn-notes-all-new');
        if (notesAllNew) {
            notesAllNew.onclick = () => {
                if (window.mobileEditor) window.mobileEditor.initNewNote();
            };
        }

        const notesPageNew = document.getElementById('btn-notes-page-new');
        if (notesPageNew) {
            notesPageNew.onclick = () => {
                if (window.mobileEditor) window.mobileEditor.initNewNote();
            };
        }

        // General Back Buttons
        document.querySelectorAll('.btn-go-home').forEach(btn => {
            btn.onclick = () => this.goBack();
        });

        // Back logic for specific views
        document.querySelectorAll('.btn-back-to-notes').forEach(btn => {
            btn.onclick = () => {
                if (window.mobileEditor) window.mobileEditor.saveNote(true);
                this.navigateTo('notes-all');
            };
        });

        document.querySelectorAll('.btn-back-to-reader').forEach(btn => {
            btn.onclick = () => {
                this.navigateTo('reading-all');
            };
        });

        // API Settings Dialog
        const apiDialog = document.getElementById('api-settings-dialog');
        const btnOpenApiSettings = document.getElementById('act-ai');
        const btnSaveApiSettings = document.getElementById('btn-save-api-settings');
        const btnCancelApiSettings = document.getElementById('btn-cancel-api-settings');
        const inputApiKey = document.getElementById('input-api-key');
        const inputBaseUrl = document.getElementById('input-base-url');
        const inputModel = document.getElementById('input-model');

        if (btnOpenApiSettings) {
            btnOpenApiSettings.onclick = async () => {
                // Close action sheet
                const actionSheet = document.getElementById('action-sheet-overlay');
                if (actionSheet) actionSheet.classList.add('hidden');

                // Load current settings (try top-level keys first, fallback to nested object)
                const res = await window.appStorage.get(['ai_api_key', 'ai_base_url', 'ai_model', 'gdrive_root_folder', 'gdrive_client_id', 'gdrive_api_key', 'settings']);
                const nested = res.settings || {};

                if (inputApiKey) inputApiKey.value = res.ai_api_key || nested.ai_api_key || '';
                if (inputBaseUrl) inputBaseUrl.value = res.ai_base_url || nested.ai_base_url || 'https://api.deepseek.com';
                if (inputModel) inputModel.value = res.ai_model || nested.ai_model || 'deepseek-chat';

                const gdriveRootInput = document.getElementById('input-gdrive-root');
                const gdriveClientIdInput = document.getElementById('input-gdrive-client-id');
                const gdriveApiKeyInput = document.getElementById('input-gdrive-api-key');

                if (gdriveRootInput) gdriveRootInput.value = res.gdrive_root_folder || nested.gdrive_root_folder || 'Highlighti_Data';
                if (gdriveClientIdInput) gdriveClientIdInput.value = res.gdrive_client_id || nested.gdrive_client_id || '';
                if (gdriveApiKeyInput) gdriveApiKeyInput.value = res.gdrive_api_key || nested.gdrive_api_key || '';

                // Show dialog
                if (apiDialog) apiDialog.classList.remove('hidden');
            };
        }

        if (btnSaveApiSettings) {
            btnSaveApiSettings.onclick = async () => {
                const apiKey = inputApiKey ? inputApiKey.value.trim() : '';
                const baseUrl = inputBaseUrl ? inputBaseUrl.value.trim() : 'https://api.deepseek.com';
                const model = inputModel ? inputModel.value.trim() : 'deepseek-chat';

                // Save to individual keys (Extension Standard)
                await window.appStorage.set({
                    ai_api_key: apiKey,
                    ai_base_url: baseUrl,
                    ai_model: model
                });

                // Update aiCore config immediately
                if (window.aiCore) {
                    window.aiCore.config.apiKey = apiKey;
                    window.aiCore.config.baseUrl = baseUrl;
                    window.aiCore.config.model = model;
                }

                if (apiDialog) apiDialog.classList.add('hidden');
                alert('App settings saved!');
            };
        }

        if (btnCancelApiSettings) {
            btnCancelApiSettings.onclick = () => { if (apiDialog) apiDialog.classList.add('hidden'); };
        }

        // --- Dedicated Google Drive Settings ---
        const gdDialog = document.getElementById('gdrive-settings-dialog');
        const btnOpenGdSettings = document.getElementById('act-gd-settings');
        const btnSaveGdSettings = document.getElementById('btn-save-gd-settings');
        const btnCancelGdSettings = document.getElementById('btn-cancel-gd-settings');

        if (btnOpenGdSettings) {
            btnOpenGdSettings.onclick = async () => {
                const actionSheet = document.getElementById('action-sheet-overlay');
                if (actionSheet) actionSheet.classList.add('hidden');

                const res = await window.appStorage.get(['gdrive_client_id', 'gdrive_api_key', 'gdrive_root_folder', 'settings']);
                const nested = res.settings || {};

                const inputClientId = document.getElementById('input-gd-client-id');
                const inputApiKeyGd = document.getElementById('input-gd-api-key');
                const inputRoot = document.getElementById('input-gd-root');

                if (inputClientId) inputClientId.value = res.gdrive_client_id || nested.gdrive_client_id || '';
                if (inputApiKeyGd) inputApiKeyGd.value = res.gdrive_api_key || nested.gdrive_api_key || '';
                if (inputRoot) inputRoot.value = res.gdrive_root_folder || nested.gdrive_root_folder || 'Highlighti_Data';

                if (gdDialog) gdDialog.classList.remove('hidden');
            };
        }

        if (btnSaveGdSettings) {
            btnSaveGdSettings.onclick = async () => {
                const clientId = document.getElementById('input-gd-client-id')?.value.trim() || '';
                const apiKey = document.getElementById('input-gd-api-key')?.value.trim() || '';
                const rootFolder = document.getElementById('input-gd-root')?.value.trim() || 'Highlighti_Data';

                // Save to individual keys
                await window.appStorage.set({
                    gdrive_client_id: clientId,
                    gdrive_api_key: apiKey,
                    gdrive_root_folder: rootFolder
                });

                if (window.mobileGDrive) {
                    window.mobileGDrive.ROOT_FOLDER_NAME = rootFolder;
                    window.mobileGDrive.setCredentials(clientId, apiKey);
                }

                if (gdDialog) gdDialog.classList.add('hidden');
            };
        }

        if (btnCancelGdSettings) {
            btnCancelGdSettings.onclick = () => { if (gdDialog) gdDialog.classList.add('hidden'); };
        }

        const btnResetData = document.getElementById('btn-reset-data');
        if (btnResetData) {
            btnResetData.onclick = async () => {
                const confirmed = confirm("WARNING: This will permanently delete ALL local notes, highlights, and settings from this device. Cloud data will NOT be affected.\\n\\nAre you sure you want to continue?");
                if (confirmed) {
                    if (window.appStorage && window.appStorage.clear) {
                        await window.appStorage.clear();
                        alert('Local data cleared successfully. The app will now reload.');
                        location.reload();
                    }
                }
            };
        }

        if (btnCancelApiSettings) {
            btnCancelApiSettings.onclick = () => {
                if (apiDialog) apiDialog.classList.add('hidden');
            };
        }

        // Close dialog when clicking overlay
        if (apiDialog) {
            apiDialog.onclick = (e) => {
                if (e.target === apiDialog) {
                    apiDialog.classList.add('hidden');
                }
            };
        }

        // Delegation for dynamic cards & swipes
        let touchStart = 0;
        let activeSwipeCard = null;

        document.addEventListener('touchstart', (e) => {
            const card = e.target.closest('.note-card');
            const deleteAction = e.target.closest('.note-delete-action');

            if (card) {
                touchStart = e.touches[0].clientX;
                // Close existing swiped card if clicking a different card
                if (activeSwipeCard && activeSwipeCard !== card) {
                    activeSwipeCard.classList.remove('swiped');
                    activeSwipeCard = null;
                }
            } else if (activeSwipeCard && !deleteAction) {
                // Close swiped card if clicking outside, except when clicking the delete button itself
                activeSwipeCard.classList.remove('swiped');
                activeSwipeCard = null;
            }
        });

        document.addEventListener('touchmove', (e) => {
            const card = e.target.closest('.note-card');
            if (!card) return;
            const touchCurrent = e.touches[0].clientX;
            const diff = touchStart - touchCurrent;

            if (diff > 50) { // Swipe left
                card.classList.add('swiped');
                activeSwipeCard = card;
            } else if (diff < -50) { // Swipe right
                card.classList.remove('swiped');
            }
        });

        // Use Capture Phase for Deletion to prevent bubbling to the card click
        document.addEventListener('click', async (e) => {
            const deleteBtn = e.target.closest('.note-delete-action');
            if (!deleteBtn) return;

            // Stop propagation immediately
            e.stopPropagation();
            e.preventDefault();

            const wrapper = deleteBtn.closest('.note-item-wrapper');
            const id = wrapper?.dataset.id;
            const parentKey = wrapper?.dataset.parentKey;

            if (!id || !window.appStorage) return;

            const confirmed = confirm('Delete this item?');
            if (!confirmed) return;

            try {
                if (parentKey === 'user_notes') {
                    // It's in the unified array
                    const res = await window.appStorage.get('user_notes');
                    const notes = res.user_notes || [];

                    const updated = notes.filter((n, index) => {
                        // 1. Try safe ID match (handles number vs string)
                        const nId = (n.id || n.timestamp || '').toString();
                        if (nId && nId === id.toString()) return false;

                        // 2. Try strict Index match (Fallback for malformed items)
                        // renderApp generates ID as `idx-${index}` if no internal ID exists
                        if (id === `idx-${index}`) return false;

                        return true;
                    });

                    if (updated.length === notes.length) {
                        console.warn('[Delete] Item not found in user_notes array', id);
                    }

                    await window.appStorage.set({ user_notes: updated });
                } else if (parentKey) {
                    // It's a flat entry
                    await window.appStorage.remove(parentKey);
                } else {
                    // Last resort try by ID (Handle as string or number if needed)
                    await window.appStorage.remove(id);
                }

                // Show success feedback
                if (window.mobileEditor && window.mobileEditor.showToast) {
                    window.mobileEditor.showToast('Deleted successfully');
                } else {
                    alert('Deleted successfully');
                }

                this.renderApp();
            } catch (err) {
                console.error('[Delete] Failed:', err);
                alert('Delete failed: ' + err.message);
            }
        }, true); // TRUE for capture phase

        document.addEventListener('click', async (e) => {
            const card = e.target.closest('.note-card');
            if (!card) return;

            // If card is swiped, clicking it should close it without opening note
            if (card.classList.contains('swiped')) {
                card.classList.remove('swiped');
                activeSwipeCard = null;
                return;
            }

            const id = card.dataset.id;
            const type = card.dataset.type;
            if (!id) return; // Ignore cards without explicit ID (like chat session cards handled elsewhere)

            const data = this.dataMap.get(id);

            if (!data) {
                console.warn('Data not found for ID:', id);
                return;
            }

            if (type === 'reader') {
                this.loadReader(data);
                this.navigateTo('reader-detail');
                return;
            }

            if (type === 'note') {
                if (window.mobileEditor) window.mobileEditor.loadNote(id, data);
                this.navigateTo('editor');
                return;
            }
        });

        // Reader Source Button
        const readerUrlBtn = document.getElementById('btn-reader-open-url');
        if (readerUrlBtn) {
            readerUrlBtn.onclick = () => {
                if (this.currentReaderUrl) window.open(this.currentReaderUrl, '_blank');
            };
        }


        this.setupSwipeNavigation();
    }

    setupSwipeNavigation() {
        let touchStartX = 0;
        document.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });
        document.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].screenX;
            if (touchEndX - touchStartX > 150 && touchStartX < 50) {
                this.goBack();
            }
        }, { passive: true });
    }

    navigateTo(viewId) {
        document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
        const target = document.getElementById('view-' + viewId);
        if (target) {
            target.classList.add('active');
            this.activeView = viewId;
        }

        // --- Global Nav Dock Visibility ---
        const navBar = document.getElementById('global-nav-bar');
        if (navBar) {
            // ONLY hide in these two specific deep-level views
            // User requested Dock on Home, Notes, Reader. Chat has its own input. Editor has its own toolbar.
            const hideIn = ['editor', 'chat'];
            if (hideIn.includes(viewId)) {
                navBar.classList.add('hidden');
            } else {
                navBar.classList.remove('hidden');
            }

            // Sync active state for the Home button
            const homeBtn = document.getElementById('nav-btn-home');
            if (homeBtn) {
                if (viewId === 'home') {
                    homeBtn.classList.add('active');
                } else {
                    homeBtn.classList.remove('active');
                }
            }
        }
    }

    goBack() {
        this.navigateTo('home');
        this.renderApp();
    }

    /**
     * Setup the Attachment Action Sheet triggered by the global '+' button.
     * This allows users to add photos or files before sending to AI.
     */
    setupAttachmentSheet() {
        const attachSheet = document.getElementById('attachment-sheet-overlay');
        const globalAddBtn = document.getElementById('btn-global-add');
        const attCancel = document.getElementById('att-cancel');
        const attCamera = document.getElementById('att-camera');
        const attGallery = document.getElementById('att-gallery');
        const attFile = document.getElementById('att-file');

        // Hidden file inputs
        const cameraInput = document.getElementById('chat-camera-input');
        const galleryInput = document.getElementById('global-gallery-input');
        const fileInput = document.getElementById('chat-file-input');

        // Open attachment sheet
        if (globalAddBtn && attachSheet) {
            globalAddBtn.onclick = (e) => {
                e.stopPropagation();
                attachSheet.classList.remove('hidden');
            };
        }

        // Close on cancel or background click
        if (attCancel) attCancel.onclick = () => attachSheet.classList.add('hidden');
        if (attachSheet) {
            attachSheet.onclick = (e) => {
                if (e.target === attachSheet) attachSheet.classList.add('hidden');
            };
        }

        // Camera action
        if (attCamera && cameraInput) {
            attCamera.onclick = () => {
                attachSheet.classList.add('hidden');
                cameraInput.click();
            };
            cameraInput.onchange = (e) => this.handleAttachment(e.target.files, 'camera');
        }

        // Gallery action
        if (attGallery && galleryInput) {
            attGallery.onclick = () => {
                attachSheet.classList.add('hidden');
                galleryInput.click();
            };
            galleryInput.onchange = (e) => this.handleAttachment(e.target.files, 'gallery');
        }

        // File action
        if (attFile && fileInput) {
            attFile.onclick = () => {
                attachSheet.classList.add('hidden');
                fileInput.click();
            };
            fileInput.onchange = (e) => this.handleAttachment(e.target.files, 'file');
        }
    }

    /**
     * Handle selected attachment files - navigate to chat and pass to mobileChat.
     * @param {FileList} files 
     * @param {string} source - 'camera', 'gallery', or 'file'
     */
    handleAttachment(files, source) {
        if (!files || files.length === 0) return;

        // Navigate to chat view
        this.navigateTo('chat');

        // If mobileChat has an attachment handler, use it
        if (window.mobileChat && typeof window.mobileChat.addAttachments === 'function') {
            window.mobileChat.addAttachments(files);
        } else {
            console.log(`[Attachment] ${files.length} file(s) selected from ${source}`);
            // Fallback: store for later use
            this.pendingAttachments = Array.from(files);
        }
    }

    loadReader(data) {
        this.navigateTo('reader-detail');
        const titleEl = document.getElementById('reader-title');
        const metaEl = document.getElementById('reader-meta');
        const contentEl = document.getElementById('reader-content');

        if (titleEl) titleEl.innerText = data.title || 'Untitled Article';
        if (metaEl) {
            const domain = data.url ? new URL(data.url).hostname : 'Local Source';
            const time = data.updatedAt || data.timestamp || Date.now();
            const date = new Date(time).toLocaleString();
            metaEl.innerText = `${domain} • ${date}`;
        }

        if (contentEl) {
            contentEl.innerHTML = data.content || data.text || '';
        }

        this.currentReaderUrl = data.url;
        this.loadSnapshot(data.url); // Load snapshot if exists

        // Scroll to top
        document.querySelector('.reader-scroll-area').scrollTop = 0;
    }

    async loadSnapshot(url) {
        const container = document.getElementById('reader-snapshot-container');
        const contentEl = document.getElementById('reader-snapshot-content');
        const toggleBtn = document.getElementById('btn-toggle-snapshot');

        if (!container || !contentEl || !toggleBtn) return;

        // Reset state
        container.classList.add('hidden');
        contentEl.classList.add('hidden');
        toggleBtn.classList.remove('active');
        contentEl.innerHTML = '';
        const arrow = toggleBtn.querySelector('.arrow');
        if (arrow) arrow.innerText = '▼';

        if (!url) return;

        try {
            const key = 'snapshot_' + url;
            // First, just check if the key exists to show the bar
            const res = await window.appStorage.get(key);
            const snapshotData = res[key];

            if (snapshotData && snapshotData.content) {
                container.classList.remove('hidden');

                // Toggle click handler handles lazy loading
                toggleBtn.onclick = async (e) => {
                    e.stopPropagation();
                    const isHidden = contentEl.classList.contains('hidden');

                    if (isHidden) {
                        // If content is empty, fetch and render now
                        if (!contentEl.innerHTML.trim()) {
                            contentEl.innerHTML = `
                                <div style="font-size: 13px; color: #8e8e93; margin-bottom: 12px; padding: 10px; border-left: 3px solid #ddd; font-style: italic;">
                                    Saved Page Content (Snapshot):
                                </div>
                                <div class="snapshot-inner-content" style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #eee;">
                                    ${snapshotData.content}
                                </div>
                            `;
                        }
                        contentEl.classList.remove('hidden');
                        toggleBtn.classList.add('active');
                        if (arrow) arrow.innerText = '▲';
                    } else {
                        contentEl.classList.add('hidden');
                        toggleBtn.classList.remove('active');
                        if (arrow) arrow.innerText = '▼';
                    }
                };
            }
        } catch (e) {
            console.warn('Failed to check/load snapshot:', e);
        }
    }

    async renderApp() {
        if (!window.appStorage) return;
        const all = await window.appStorage.getAll();
        const noteMap = new Map(); // Use Map to deduplicate by ID
        const readerMap = {}; // For grouping

        const processItem = (val, key, arrayIdx = -1) => {
            if (!val || typeof val !== 'object') return;

            // 1. Recursive for Arrays (like user_notes)
            if (Array.isArray(val)) {
                val.forEach((sub, i) => processItem(sub, key, i));
                return;
            }

            // 2. Detection Logic
            const isNote = val.type === 'note' ||
                ((val.hasOwnProperty('content') || val.hasOwnProperty('text')) && !val.url) ||
                (key && (key.startsWith('note-') || key.startsWith('note_')));

            const isReading = (val.type === 'reading' ||
                val.url ||
                (key && (key.startsWith('http') || key.startsWith('meta_')))) &&
                !(key && key.startsWith('snapshot_')); // Exclude full snapshots

            if (key && key.startsWith('snapshot_')) return; // Explicitly skip snapshot keys

            if (isNote) {
                // 1. Determine Identity (ID or ChatSession)
                const identity = String(val.chatSessionId || val.id || val.timestamp || (arrayIdx !== -1 ? `idx-${arrayIdx}` : key));

                // 2. Build Content-Based Fingerprint (Title + Compressed Content)
                // This catches duplicates even if they have different IDs/Timestamps
                const rawContent = (val.content || val.text || '').trim();
                const contentFingerprint = `${val.title}_${rawContent.substring(0, 150).replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '')}`;

                const time = this.safeParseToNumber(val.updatedAt || val.timestamp);

                // 3. Robust Search for Existing Duplicate
                const existing = noteMap.get(identity) ||
                    Array.from(noteMap.values()).find(n => n._fingerprint === contentFingerprint);

                if (!existing || (time > 0 && time > (existing.updatedAt || 0))) {
                    // If we are replacing an existing but different ID entry, remove the old one
                    if (existing && existing.id !== identity) {
                        noteMap.delete(existing.id);
                        // [Auto-Clean Registry] If we found a redundant physical key, mark for background removal
                        if (existing._storageKey && existing._storageKey !== 'user_notes' && existing._storageKey !== key) {
                            window.appStorage.remove(existing._storageKey);
                        }
                    }

                    noteMap.set(identity, {
                        ...val,
                        id: identity,
                        updatedAt: time,
                        _fingerprint: contentFingerprint,
                        _storageKey: key,
                        _originalIdx: arrayIdx
                    });
                } else {
                    // The current item is the duplicate/older one. 
                    // If it's stored as a redundant flat key, clean it up from IDB immediately.
                    if (key !== 'user_notes' && key !== identity) {
                        window.appStorage.remove(key);
                    }
                }
            } else if (isReading) {
                const rKey = val.url || val.title || key;
                if (!readerMap[rKey]) {
                    readerMap[rKey] = {
                        ...val,
                        id: rKey,
                        _storageKey: key,
                        title: val.title || key,
                        updatedAt: val.updatedAt || val.timestamp || 0,
                        timestamp: val.updatedAt || val.timestamp || 0,
                        contents: []
                    };
                }
                const body = val.content || val.text || val.body || '';
                if (body && !readerMap[rKey].contents.includes(body)) {
                    readerMap[rKey].contents.push(body);
                }
                const currentTime = this.safeParseToNumber(val.updatedAt || val.timestamp);
                if (currentTime > (readerMap[rKey].updatedAt || 0)) {
                    readerMap[rKey].updatedAt = currentTime;
                    readerMap[rKey].timestamp = currentTime;
                }
            } else {
                // 3. If neither, but it's a plain object, descend into it (for highlights objects)
                // Avoid recursing into too deep or system property objects
                Object.entries(val).forEach(([k, v]) => {
                    if (typeof v === 'object' && v !== null) {
                        processItem(v, k);
                    }
                });
            }
        };

        Object.entries(all).forEach(([key, val]) => {
            // Skip config/system keys at root level
            const systemKeys = [
                'ai_api_key', 'ai_base_url', 'ai_model',
                'gdrive_client_id', 'gdrive_api_key', 'gdrive_root_folder',
                'settings', 'user_license_status', 'folder_structure'
            ];
            if (systemKeys.includes(key)) return;
            processItem(val, key);
        });

        const readings = Object.values(readerMap).map(r => {
            // Pre-process each snippet for proper HTML wrapping
            const processedContents = r.contents.map(c => {
                if (!c) return '';
                if (c.includes('<p>') || c.includes('<div') || c.includes('<br')) return c;
                return c.split('\n\n').map(p => `<p>${p.trim()}</p>`).join('');
            });

            return {
                ...r,
                content: processedContents.join('<hr style="border:none; border-top:1px dashed #ddd; margin:24px 0;">')
            };
        });

        // Filter and Sort
        const filterFn = (item) => {
            const title = (item.title || '').toLowerCase();
            const text = (item.content || '').toLowerCase();
            return title.includes(this.searchQuery) || text.includes(this.searchQuery);
        };

        const filteredNotes = Array.from(noteMap.values()).filter(filterFn).sort((a, b) => {
            const timeA = a.updatedAt || a.timestamp || 0;
            const timeB = b.updatedAt || b.timestamp || 0;
            return timeB - timeA;
        });
        const filteredReader = readings.filter(filterFn).sort((a, b) => {
            const timeA = a.updatedAt || a.timestamp || 0;
            const timeB = b.updatedAt || b.timestamp || 0;
            return timeB - timeA;
        });

        this.dataMap.clear();
        filteredNotes.forEach(n => this.dataMap.set(String(n.id), n));
        filteredReader.forEach(r => this.dataMap.set(String(r.id), r));

        // Render Home Summary (Top 10)
        this.renderNotes(filteredNotes.slice(0, 10), 'notes-list-container');
        this.renderReader(filteredReader.slice(0, 10), 'reader-list-container');

        // Render Full Lists
        this.renderNotes(filteredNotes, 'full-notes-container');
        this.renderReader(filteredReader, 'full-reader-container');
    }

    renderNotes(notes, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = notes.map((n) => {
            const displayTitle = n.title || 'Untitled Note';
            const body = n.content || n.text || '';
            const id = n.id;
            const parentKey = n._storageKey || '';

            // Format time: MM/DD HH:mm
            const timeVal = this.safeParseToNumber(n.updatedAt || n.timestamp);
            let dateStr = '';
            try {
                if (timeVal > 0) {
                    const d = new Date(timeVal);
                    const now = new Date();
                    const isToday = d.toDateString() === now.toDateString();

                    if (isToday) {
                        dateStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                    } else {
                        dateStr = d.toLocaleDateString([], { month: 'numeric', day: 'numeric' });
                    }
                }
            } catch (e) {
                dateStr = '';
            }

            return `
                <div class="note-item-wrapper" data-id="${id}" data-parent-key="${parentKey}" data-type="note">
                    <div class="note-card" data-type="note" data-id="${id}">
                        <div class="note-title-row">
                            <div class="note-title">${displayTitle}</div>
                            <div class="note-date-tag">${dateStr}</div>
                        </div>
                        <div class="note-preview">${this.stripHtml(body).substring(0, 80)}</div>
                    </div>
                    <div class="note-delete-action">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderReader(items, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = items.map(i => {
            const date = i.date || new Date(i.timestamp || Date.now()).toLocaleDateString();
            const parentKey = i._storageKey || '';
            return `
                <div class="note-item-wrapper" data-id="${i.id}" data-parent-key="${parentKey}" data-type="reader">
                    <div class="note-card" data-type="reader" data-id="${i.id}">
                        <div class="note-title">${i.title || 'Untitled Article'}</div>
                        <div class="note-preview">${date}</div>
                    </div>
                    <div class="note-delete-action">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </div>
                </div>
            `;
        }).join('');
    }

    stripHtml(html) {
        const doc = new Array();
        return html.replace(/<[^>]*>?/gm, '');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.mobileCore = new MobileApp();
    setTimeout(() => window.mobileCore.renderApp(), 500);
});

