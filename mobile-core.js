/**
 * mobile-core.js - View Navigation Controller (V5.3 Reader Fixed)
 */

class MobileApp {
    constructor() {
        this.tabBar = document.getElementById('main-tab-bar');

        // Main Tab Views
        this.mainViews = {
            home: document.getElementById('view-home'),
            chat: document.getElementById('view-chat'),
            search: document.getElementById('view-search'),
            reader: document.getElementById('view-reader'),
            notes: document.getElementById('view-notes')
        };

        // Full Screen Sub Views
        this.subViews = {
            editor: document.getElementById('view-editor'),
            'reader-detail': document.getElementById('view-reader-detail')
        };

        this.setupTabNavigation();
        this.activeTab = 'home';
        this.setupGlobalEvents();
        console.log('MobileCore V5.3 Initialized');
    }

    setupGlobalEvents() {
        const userBtns = document.querySelectorAll('.user-btn');
        const sheetOverlay = document.getElementById('action-sheet-overlay');
        const cancelBtn = document.getElementById('act-cancel');
        const exportBtn = document.getElementById('act-export');
        const importBtn = document.getElementById('act-import');
        const fileInput = document.getElementById('file-import-input');
        const aiBtn = document.getElementById('act-ai');

        const closeSheet = () => { if (sheetOverlay) sheetOverlay.classList.add('hidden'); };
        const openSheet = () => { if (sheetOverlay) sheetOverlay.classList.remove('hidden'); };

        userBtns.forEach(btn => btn.onclick = (e) => { e.stopPropagation(); openSheet(); });
        if (cancelBtn) cancelBtn.onclick = closeSheet;
        if (sheetOverlay) sheetOverlay.onclick = (e) => { if (e.target === sheetOverlay) closeSheet(); };

        const gdriveBtn = document.getElementById('act-gdrive');
        if (gdriveBtn) gdriveBtn.onclick = () => {
            closeSheet();
            if (window.mobileGDrive) window.mobileGDrive.sync();
            else alert('GDrive module missing');
        };

        const webDavBtn = document.getElementById('act-webdav');
        if (webDavBtn) webDavBtn.onclick = () => {
            closeSheet();
            if (window.mobileSync) window.mobileSync.webDavSync();
        };

        if (exportBtn) exportBtn.onclick = () => {
            closeSheet();
            if (window.mobileSync) window.mobileSync.exportBackup();
            else alert('Error: mobileSync module missing');
        };

        if (importBtn && fileInput) {
            importBtn.onclick = () => { closeSheet(); fileInput.click(); };
            fileInput.onchange = (e) => {
                const file = e.target.files[0];
                if (file && window.mobileSync) {
                    window.mobileSync.importBackup(file).then(() => setTimeout(() => this.renderApp(), 1000));
                }
                fileInput.value = '';
            };
        }

        if (aiBtn) aiBtn.onclick = () => {
            closeSheet();
            setTimeout(async () => {
                const currentKey = window.aiCore?.config?.apiKey || '';
                const newKey = prompt('⚙️ [AI Settings]\nEnter API Key:', currentKey);
                if (newKey !== null && window.appStorage) {
                    await window.appStorage.set({ 'ai_api_key': newKey.trim() });
                    if (window.aiCore) await window.aiCore.init();
                    alert('✅ API Key Saved!');
                }
            }, 200);
        };
    }

    setupTabNavigation() {
        if (!this.tabBar) return;
        const tabs = this.tabBar.querySelectorAll('.tab-btn');
        tabs.forEach(tab => {
            if (tab.dataset.target) {
                tab.onclick = (e) => {
                    const btn = e.target.closest('.tab-btn');
                    if (!btn) return;
                    const targetId = btn.dataset.target.replace('view-', '');
                    this.switchTab(targetId);
                };
            }
        });
    }

    switchTab(tabName) {
        // --- Full Screen Logic ---
        if (this.tabBar) {
            if (tabName === 'chat') {
                this.tabBar.style.display = 'none';
            } else {
                this.tabBar.style.display = 'flex';
            }
        }

        Object.entries(this.mainViews).forEach(([name, el]) => {
            if (el) {
                if (name === tabName) el.classList.add('active');
                else el.classList.remove('active');
            }
        });

        // Update Buttons
        if (this.tabBar && this.tabBar.style.display !== 'none') {
            const tabs = this.tabBar.querySelectorAll('.tab-btn');
            tabs.forEach(tab => {
                if (!tab.dataset.target) return;
                const target = tab.dataset.target.replace('view-', '');
                if (target === tabName) tab.classList.add('active');
                else tab.classList.remove('active');
            });
        }

        this.activeTab = tabName;
        if (tabName === 'home' || tabName === 'notes' || tabName === 'reader') this.renderApp();
    }

    exitChat() {
        this.switchTab('home');
    }

    navigateTo(viewName) {
        const view = this.subViews[viewName];
        if (view) {
            view.classList.add('active');
            view.style.display = 'flex';
        }
    }

    goBack() {
        Object.values(this.subViews).forEach(view => {
            if (view && view.style.display !== 'none') {
                view.classList.remove('active');
                view.style.display = 'none';
            }
        });
    }

    // =========================================
    // Core Rendering Logic (Universal)
    // =========================================
    async renderApp() {
        const homeList = document.querySelector('#view-home .notes-list-content') || document.getElementById('view-home');
        const notesList = document.querySelector('#view-notes .notes-list-content') || document.getElementById('view-notes');
        const readerList = document.querySelector('#view-reader .reading-list-content') || document.getElementById('view-reader');

        // Setup Containers
        let homeDyn = document.getElementById('home-dyn-list');
        if (homeList && !homeDyn) {
            homeDyn = document.createElement('div');
            homeDyn.id = 'home-dyn-list';
            homeList.appendChild(homeDyn);
        }

        let notesDyn = document.getElementById('notes-dyn-list');
        if (notesList && !notesDyn) {
            notesDyn = document.createElement('div');
            notesDyn.id = 'notes-dyn-list';
            notesList.appendChild(notesDyn);
        }

        let readerDyn = document.getElementById('reader-dyn-list');
        if (readerList && !readerDyn) {
            readerDyn = document.createElement('div');
            readerDyn.id = 'reader-dyn-list';
            readerList.appendChild(readerDyn);
        }

        if (homeDyn) homeDyn.innerHTML = '';
        if (notesDyn) notesDyn.innerHTML = '';
        if (readerDyn) readerDyn.innerHTML = '';

        try {
            let allData = {};
            if (window.appStorage) {
                allData = await window.appStorage.getAll();
            }

            const allKeys = Object.keys(allData);

            // AUTO-INJECT IF EMPTY
            if (allKeys.length === 0 && window.appStorage) {
                console.log('Database empty, injecting welcome note...');
                const welcomeNote = {
                    id: 'note_welcome_' + Date.now(),
                    title: 'Welcome to Highlighti',
                    content: 'This note confirms the app is working properly. If you see this, Import your backup again.',
                    type: 'note',
                    date: new Date().toLocaleDateString(),
                    timestamp: Date.now()
                };
                await window.appStorage.set({ [welcomeNote.id]: welcomeNote });
                allData = await window.appStorage.getAll();
            }

            // 1. Helper to Process Item
            const processItem = (key, item, realType) => {
                if (!item) return;
                // Inherit URL from key if missing
                if (!item.url && key.startsWith('http')) item.url = key;

                let isNote = false;
                if (realType) {
                    isNote = (realType === 'note');
                } else {
                    if (item.type === 'note') isNote = true;
                    else if (item.type === 'highlight') isNote = false;
                    else if (!item.url && !item.uri && !item.pageUrl) isNote = true;
                }

                // Add hidden metadata for sorting helper
                item._debug_key = key;

                if (isNote) noteKeys.push(item);
                else highlightKeys.push(item);

                // Add to flat list for sorting
                flatList.push(item);
            };

            const flatList = [];
            const noteKeys = [];
            const highlightKeys = [];

            let processedCount = 0;
            let errorMsg = '';

            Object.keys(allData).forEach(k => {
                try {
                    // Skip settings/config keys
                    if (k.startsWith('ai_') || k.startsWith('webdav_') || k.startsWith('sync_') || k === 'settings' || k === 'notes') return;

                    let val = allData[k];
                    if (!val) return;

                    // Handle string values
                    if (typeof val === 'string') {
                        // Try to parse as JSON
                        try {
                            val = JSON.parse(val);
                        } catch (e) {
                            // If it's not JSON, treat it as a simple text note
                            val = { text: val, type: 'note', id: k };
                        }
                    }

                    if (Array.isArray(val)) {
                        val.forEach(child => processItem(k, child, child ? child.type : undefined));
                    } else if (val && typeof val === 'object') {
                        processItem(k, val, val.type);
                    }
                    processedCount++;
                } catch (loopErr) {
                    errorMsg = `Error at key ${k}: ${loopErr.message}`;
                }
            });

            // 2. Sort Flat List
            let sortedAll = [];
            try {
                sortedAll = flatList.sort((a, b) => {
                    const tA = a.updatedAt || a.timestamp || a.createdAt || a.date || 0;
                    const tB = b.updatedAt || b.timestamp || b.createdAt || b.date || 0;
                    return (new Date(tB).getTime() || 0) - (new Date(tA).getTime() || 0);
                });
            } catch (sortErr) {
                debugPanel.innerText += `\nSort Error: ${sortErr.message}`;
            }

            // 3. Distribute Keys (Items)
            const homeItems = sortedAll.slice(0, 50);

            // DEBUG: Update panel with flatList info
            debugPanel.innerText += `\nFlatList: ${flatList.length} | HomeItems: ${homeItems.length}`;

            // --- RENDER HOME (Recent 50) ---
            if (homeDyn) {
                if (homeItems.length === 0) {
                    homeDyn.innerHTML = `
                        <div style="text-align:center;padding:50px 20px;color:#999;font-family:sans-serif;">
                            <div style="font-size:32px;margin-bottom:10px;">👋</div>
                            <div style="font-weight:600;font-size:18px;color:#333;margin-bottom:5px;">Welcome</div>
                            <div style="font-size:14px;">Your recent items will appear here.</div>
                        </div>`;
                } else {
                    homeItems.forEach(item => this.renderCard(homeDyn, item.id || item._debug_key, item));
                }
            }

            // --- RENDER NOTES ---
            if (notesDyn) {
                // Filter Note Objects from sorted list
                const sortedNotes = sortedAll.filter(i => noteKeys.includes(i));
                if (sortedNotes.length === 0) {
                    // Empty State
                    notesDyn.innerHTML = `<div style="text-align:center;padding:40px;color:#999;" onclick="window.mobileEditor.initNewNote()">
                        <div>📝</div>
                        <div>No notes yet.</div>
                        <div style="color:#007aff;margin-top:5px;">Create New +</div>
                     </div>`;
                } else {
                    sortedNotes.forEach(item => this.renderCard(notesDyn, item.id || item._debug_key, item));
                }
            }

            // --- RENDER READER ---
            if (readerDyn) {
                const sortedHighlights = sortedAll.filter(i => highlightKeys.includes(i));
                if (sortedHighlights.length === 0) {
                    readerDyn.innerHTML = `<div style="text-align:center;padding:40px;color:#999;">
                        <div>📚</div>
                        <div>Reading list is empty.</div>
                    </div>`;
                } else {
                    sortedHighlights.forEach(item => this.renderCard(readerDyn, item.id || item._debug_key, item));
                }
            }

        } catch (e) {
            console.error('Render Error', e);
        }
    }

    sortKeys(keys, allData) {
        return keys.sort((a, b) => {
            const tA = allData[a].timestamp || allData[a].updatedAt || 0;
            const tB = allData[b].timestamp || allData[b].updatedAt || 0;
            return tB - tA;
        });
    }

    openReaderDetail(item) {
        const view = document.getElementById('view-reader-detail');
        if (!view) return;

        const titleEl = view.querySelector('.editor-title');
        const metaEl = view.querySelector('.note-time');
        const bodyEl = view.querySelector('.editor-body');

        if (titleEl) titleEl.textContent = item.title || 'Untitled Highlight';
        if (metaEl) metaEl.textContent = (item.hostname || 'Web Clip') + ' • ' + (item.date || 'Unknown Date');

        if (bodyEl) {
            const text = item.text || item.content || '';
            let html = `<blockquote style="border-left:4px solid #007aff; padding-left:16px; margin:0; font-size:18px; line-height:1.6; color:#333;">${text}</blockquote>`;

            if (item.comment || item.note) {
                const comment = item.comment || item.note;
                html += `<div style="margin-top:24px; padding:16px; background:#f2f2f7; border-radius:12px;">
                    <div style="font-weight:600; font-size:14px; color:#007aff; margin-bottom:4px;">YOUR NOTE</div>
                    <div style="font-size:16px;">${comment}</div>
                </div>`;
            }

            if (item.url) {
                html += `<div style="margin-top:40px; text-align:center;">
                    <a href="${item.url}" target="_blank" style="display:inline-block; padding:12px 24px; background:#007aff; color:white; text-decoration:none; border-radius:24px; font-weight:500;">Visit Source Website</a>
                </div>`;
            }

            bodyEl.innerHTML = html;
        }

        this.navigateTo('reader-detail');
    }

    renderCard(container, key, item) {
        const text = item.content || item.text || '';
        const title = item.title || text.substring(0, 50) || 'Untitled';
        const date = item.date || 'Just now';

        const card = document.createElement('div');
        card.className = 'note-card';
        card.onclick = () => {
            // Determine Type
            let isNote = false;
            if (item.type === 'note') isNote = true;
            else if (item.type === 'highlight') isNote = false;
            else if (!item.url && !item.uri && !item.pageUrl) isNote = true;

            if (isNote) {
                if (window.mobileEditor && typeof window.mobileEditor.loadNote === 'function') {
                    window.mobileEditor.loadNote(key, item);
                }
            } else {
                this.openReaderDetail(item);
            }
        };

        // Text-Only Minimalist Design
        card.innerHTML = `
            <div class="note-row-top">
                <span class="note-title">${title}</span>
                <span class="note-time">${date}</span>
            </div>
            <div class="note-preview">${text.substring(0, 100)}</div>
        `;
        container.appendChild(card);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.mobileCore = new MobileApp();
    setTimeout(() => {
        if (window.mobileCore) window.mobileCore.renderApp();
    }, 500);
});
