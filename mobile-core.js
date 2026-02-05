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

        this.setupEvents();
        console.log('MobileCore V9.5 (Monolith) Initialized');
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

        // Headers
        const notesHeader = document.getElementById('header-notes-all');
        if (notesHeader) notesHeader.onclick = () => this.navigateTo('notes-all');

        const readingHeader = document.getElementById('header-reading-all');
        if (readingHeader) readingHeader.onclick = () => this.navigateTo('reading-all');

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

        // --- Universal Core Hub Components ---
        // Handle search inputs
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('universal-core-input')) {
                this.searchQuery = e.target.value.toLowerCase();
                this.renderApp();
            }
        });

        // Handle enter key in inputs
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.classList.contains('universal-core-input')) {
                e.preventDefault();

                // If in chat view, directly send via mobileChat
                if (this.activeView === 'chat' && window.mobileChat) {
                    window.mobileChat.handleSend();
                } else {
                    // Otherwise, navigate to chat and send
                    this.triggerUniversalSend(e.target);
                }
            }
        });

        // Handle clicks on plus and send buttons
        document.addEventListener('click', (e) => {
            const plusBtn = e.target.closest('.universal-plus-btn');
            if (plusBtn) {
                // Navigate to chat first if not already there
                if (this.activeView !== 'chat') {
                    this.navigateTo('chat');
                }
                const fileInput = document.getElementById('chat-file-input');
                if (fileInput) fileInput.click();
                return;
            }

            const sendBtn = e.target.closest('.universal-send-btn');
            if (sendBtn) {
                const capsule = sendBtn.closest('.core-hub');
                const input = capsule ? capsule.querySelector('.universal-core-input') : null;

                // If in chat view, directly send via mobileChat
                if (this.activeView === 'chat' && window.mobileChat) {
                    window.mobileChat.handleSend();
                } else if (input) {
                    // Otherwise, navigate to chat and send
                    this.triggerUniversalSend(input);
                }
            }
        });

        // Navigate to chat when user focuses on input (home, notes-all, or reading-all)
        document.addEventListener('focus', (e) => {
            if (e.target.classList.contains('universal-core-input')) {
                const viewsToAutoChat = ['home', 'notes-all', 'reading-all'];
                if (viewsToAutoChat.includes(this.activeView)) {
                    this.navigateToChat();
                }
            }
        }, true);

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

                // Load current settings
                const settingsRes = await window.appStorage.get('settings');
                const settings = settingsRes.settings || {};

                if (inputApiKey) inputApiKey.value = settings.ai_api_key || '';
                if (inputBaseUrl) inputBaseUrl.value = settings.ai_base_url || 'https://api.deepseek.com';
                if (inputModel) inputModel.value = settings.ai_model || 'deepseek-chat';

                const gdriveRootInput = document.getElementById('input-gdrive-root');
                if (gdriveRootInput) gdriveRootInput.value = settings.gdrive_root_folder || 'Highlighti_Data';

                // Show dialog
                if (apiDialog) apiDialog.classList.remove('hidden');
            };
        }

        if (btnSaveApiSettings) {
            btnSaveApiSettings.onclick = async () => {
                const apiKey = inputApiKey ? inputApiKey.value.trim() : '';
                const baseUrl = inputBaseUrl ? inputBaseUrl.value.trim() : 'https://api.deepseek.com';
                const model = inputModel ? inputModel.value.trim() : 'deepseek-chat';

                const gdriveRootInput = document.getElementById('input-gdrive-root');
                const gdriveRoot = gdriveRootInput ? gdriveRootInput.value.trim() : 'Highlighti_Data';

                // Save to storage
                const settingsRes = await window.appStorage.get('settings');
                const currentSettings = settingsRes.settings || {};

                const newSettings = {
                    ...currentSettings,
                    ai_api_key: apiKey,
                    ai_base_url: baseUrl,
                    ai_model: model,
                    gdrive_root_folder: gdriveRoot
                };

                await window.appStorage.set({ settings: newSettings });

                // Update aiCore config immediately
                if (window.aiCore) {
                    window.aiCore.config.apiKey = apiKey;
                    window.aiCore.config.baseUrl = baseUrl;
                    window.aiCore.config.model = model;
                }

                // Close dialog
                if (apiDialog) apiDialog.classList.add('hidden');

                // Show success message
                alert('API settings saved successfully!');
            };
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

            // Stop propagation immediately in capture phase
            e.stopPropagation();
            e.preventDefault();

            const wrapper = deleteBtn.closest('.note-item-wrapper');
            const id = wrapper?.dataset.id;
            const parentKey = wrapper?.dataset.parentKey;

            console.log('[Delete] Capture Phase:', { id, parentKey });
            if (!id || !window.appStorage) return;

            try {
                const res = await window.appStorage.get(parentKey);
                const parentData = res[parentKey];

                if (Array.isArray(parentData)) {
                    const updated = parentData.filter((n, idx) => {
                        const nid = (n.id || n.timestamp || `idx-${idx}`).toString();
                        return nid !== id.toString();
                    });
                    await window.appStorage.set({ [parentKey]: updated });
                } else {
                    await window.appStorage.remove(parentKey || id);
                }

                this.renderApp();
                if (window.mobileEditor && window.mobileEditor.showToast) {
                    window.mobileEditor.showToast('Item Deleted');
                }
            } catch (err) {
                console.error('[Delete] Failed:', err);
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
    }

    goBack() {
        this.navigateTo('home');
        this.renderApp();
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
        // Scroll to top
        document.querySelector('.reader-scroll-area').scrollTop = 0;
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

            const isReading = val.type === 'reading' ||
                val.url ||
                (key && (key.startsWith('http') || key.startsWith('meta_')));

            if (isNote) {
                // 1. Determine Identity (ID or ChatSession)
                const identity = String(val.chatSessionId || val.id || val.timestamp || (arrayIdx !== -1 ? `idx-${arrayIdx}` : key));

                // 2. Build Content-Based Fingerprint (Title + Compressed Content)
                // This catches duplicates even if they have different IDs/Timestamps
                const rawContent = (val.content || val.text || '').trim();
                const contentFingerprint = `${val.title}_${rawContent.substring(0, 150).replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '')}`;

                const time = Number(val.updatedAt || val.timestamp || 0);

                // 3. Robust Search for Existing Duplicate
                const existing = noteMap.get(identity) ||
                    Array.from(noteMap.values()).find(n => n._fingerprint === contentFingerprint);

                if (!existing || time > (existing.updatedAt || 0)) {
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
                const currentTime = val.updatedAt || val.timestamp || 0;
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
            const systemKeys = ['ai_api_key', 'ai_base_url', 'ai_model', 'user_license_status', 'folder_structure'];
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
            const timeVal = n.updatedAt || n.timestamp || 0;
            const dateStr = timeVal ? new Date(timeVal).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

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
