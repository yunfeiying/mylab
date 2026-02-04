/**
 * mobile-core.js - Monolith Navigation Controller (V7.0)
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
        console.log('MobileCore V7.0 (Monolith) Initialized');
    }

    triggerUniversalSend(inputEl) {
        if (!inputEl) return;
        const text = inputEl.value.trim();
        if (window.mobileChat) {
            this.navigateTo('chat');
            window.mobileChat.clearMessages(); // Clear previous conversation
            if (text) {
                window.mobileChat.input.value = text;
                window.mobileChat.handleSend();
                inputEl.value = '';
            }
        }
    }

    navigateToChat() {
        this.navigateTo('chat');
        if (window.mobileChat) {
            window.mobileChat.clearMessages(); // Start fresh conversation
            setTimeout(() => window.mobileChat.input.focus(), 100);
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
                sheet.classList.add('hidden');
                if (window.mobileGDrive) window.mobileGDrive.sync();
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

        // Editor specific back button
        const editorBack = document.getElementById('btn-editor-back');
        if (editorBack) {
            editorBack.onclick = () => {
                if (window.mobileEditor) window.mobileEditor.saveNote(true);
                this.goBack();
            };
        }

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
                if (window.mobileEditor) window.mobileEditor.initNewNote();
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

        // Navigate to chat when user focuses on input (home page only)
        document.addEventListener('focus', (e) => {
            if (e.target.classList.contains('universal-core-input') && this.activeView === 'home') {
                this.navigateToChat();
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
                const settings = await window.appStorage.get(['ai_api_key', 'ai_base_url', 'ai_model']);
                if (inputApiKey) inputApiKey.value = settings.ai_api_key || '';
                if (inputBaseUrl) inputBaseUrl.value = settings.ai_base_url || 'https://api.deepseek.com';
                if (inputModel) inputModel.value = settings.ai_model || 'deepseek-chat';

                // Show dialog
                if (apiDialog) apiDialog.classList.remove('hidden');
            };
        }

        if (btnSaveApiSettings) {
            btnSaveApiSettings.onclick = async () => {
                const apiKey = inputApiKey ? inputApiKey.value.trim() : '';
                const baseUrl = inputBaseUrl ? inputBaseUrl.value.trim() : 'https://api.deepseek.com';
                const model = inputModel ? inputModel.value.trim() : 'deepseek-chat';

                // Save to storage
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

                // Close dialog
                if (apiDialog) apiDialog.classList.add('hidden');

                // Show success message
                alert('API settings saved successfully!');
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
            if (card) {
                touchStart = e.touches[0].clientX;
                // Close existing swiped card if clicking elsewhere
                if (activeSwipeCard && activeSwipeCard !== card) {
                    activeSwipeCard.classList.remove('swiped');
                }
            } else if (activeSwipeCard) {
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

        document.addEventListener('click', async (e) => {
            // Check for Delete Action
            const deleteBtn = e.target.closest('.note-delete-action');
            if (deleteBtn) {
                e.stopPropagation();
                e.preventDefault();
                const wrapper = deleteBtn.closest('.note-item-wrapper');
                const id = wrapper.dataset.id;
                if (window.appStorage) {
                    await window.appStorage.remove(id);
                    this.renderApp();
                }
                return;
            }

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
            const data = this.dataMap.get(id);

            if (!data) {
                console.warn('Data not found for ID:', id);
                return;
            }

            if (type === 'note' && window.mobileEditor) {
                window.mobileEditor.loadNote(id, data);
            } else if (type === 'reader') {
                this.loadReader(data);
            }
        });

        // Reader Source Button
        const readerUrlBtn = document.getElementById('btn-reader-open-url');
        if (readerUrlBtn) {
            readerUrlBtn.onclick = () => {
                if (this.currentReaderUrl) window.open(this.currentReaderUrl, '_blank');
            };
        }

        // AI Settings in Action Sheet
        const aiBtn = document.getElementById('act-ai');
        if (aiBtn) {
            aiBtn.onclick = () => {
                sheet.classList.add('hidden');
                setTimeout(async () => {
                    const currentKey = window.aiCore?.config?.apiKey || '';
                    const newKey = prompt('[AI Settings]\nEnter API Key:', currentKey);
                    if (newKey !== null && window.appStorage) {
                        await window.appStorage.set({ 'ai_api_key': newKey.trim() });
                        if (window.aiCore) await window.aiCore.init();
                        alert('API Key Saved!');
                    }
                }, 200);
            };
        }

        // Action Sheet Save
        const saveBtn = document.getElementById('act-save-note');
        if (saveBtn) {
            saveBtn.onclick = () => {
                sheet.classList.add('hidden');
                if (window.mobileEditor) window.mobileEditor.saveNote();
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
            const date = data.date || new Date(data.timestamp || Date.now()).toLocaleDateString();
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
        const notes = [];
        const readerMap = {}; // For grouping

        const processItem = (item, key) => {
            if (!item || typeof item !== 'object') return;

            // Recursive for Arrays
            if (Array.isArray(item)) {
                item.forEach(sub => processItem(sub, key));
                return;
            }

            // Detection logic
            const isNote = item.type === 'note' || (item.content && !item.url) || (key && key.startsWith('note-'));
            const isReading = item.type === 'reading' || item.url || (key && (key.startsWith('http') || key.startsWith('meta_')));

            if (isNote) {
                notes.push({ ...item, id: item.id || key });
            } else if (isReading) {
                const rKey = item.url || item.title || key;
                if (!readerMap[rKey]) {
                    readerMap[rKey] = {
                        ...item,
                        id: rKey,
                        title: item.title || key,
                        timestamp: item.timestamp || 0,
                        contents: []
                    };
                }
                const body = item.content || item.text;
                if (body && !readerMap[rKey].contents.includes(body)) {
                    readerMap[rKey].contents.push(body);
                }
                if (item.timestamp > (readerMap[rKey].timestamp || 0)) {
                    readerMap[rKey].timestamp = item.timestamp;
                }
            }
        };

        Object.entries(all).forEach(([key, val]) => {
            if (['ai_api_key', 'ai_base_url', 'user_license_status', 'folder_structure'].includes(key)) return;
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

        const filteredNotes = notes.filter(filterFn).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        const filteredReader = readings.filter(filterFn).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        this.dataMap.clear();
        filteredNotes.forEach(n => this.dataMap.set(n.id || n.timestamp, n));
        filteredReader.forEach(r => this.dataMap.set(r.id, r));

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
        container.innerHTML = notes.map(n => {
            const displayTitle = n.title || 'Untitled Note';
            const body = n.content || n.text || '';
            const id = n.id || n.timestamp || `legacy-${Math.random()}`;

            return `
                <div class="note-item-wrapper" data-id="${id}" data-type="note">
                    <div class="note-card" data-type="note" data-id="${id}">
                        <div class="note-title">${displayTitle}</div>
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
        container.innerHTML = items.map(i => `
            <div class="note-item-wrapper" data-id="${i.id}" data-type="reader">
                <div class="note-card" data-type="reader" data-id="${i.id}">
                    <div class="note-title">${i.title || 'Untitled Article'}</div>
                    <div class="note-preview">${i.url || ''}</div>
                </div>
                <div class="note-delete-action">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </div>
            </div>
        `).join('');
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
