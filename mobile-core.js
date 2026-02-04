/**
 * mobile-core.js - View Navigation Controller (V6.0 Categorized & Search)
 */

class MobileApp {
    constructor() {
        this.tabBar = document.getElementById('main-tab-bar');

        // Main Tab Views
        this.mainViews = {
            home: document.getElementById('view-home'),
            chat: document.getElementById('view-chat'),
            search: document.getElementById('view-search'),
            reading: document.getElementById('view-reading'),
            notes: document.getElementById('view-notes')
        };

        // Full Screen Sub Views
        this.subViews = {
            editor: document.getElementById('view-editor'),
            'reader-detail': document.getElementById('view-reader-detail')
        };

        this.searchQuery = '';
        this.setupTabNavigation();
        this.activeTab = 'home';
        this.setupGlobalEvents();
        console.log('MobileCore V6.0 Initialized');
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

        this.setupSwipeNavigation();
        this.setupSearch();
        this.setupFAB();
    }

    setupSwipeNavigation() {
        let touchStartX = 0;
        document.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].screenX;
            // Left to Right Swipe (Back)
            if (touchEndX - touchStartX > 150 && touchStartX < 50) {
                if (this.subViews.editor.classList.contains('active')) {
                    if (window.mobileEditor) window.mobileEditor.saveNote(true);
                    this.goBack();
                } else if (this.activeTab !== 'home') {
                    this.switchTab('home');
                }
            }
        }, { passive: true });
    }

    setupSearch() {
        const searchInput = document.querySelector('#view-search input');
        if (searchInput) {
            searchInput.oninput = (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.renderApp();
            };
        }
    }

    setupFAB() {
        let fab = document.querySelector('.fab-main');
        if (!fab) {
            fab = document.createElement('div');
            fab.className = 'fab-main';
            fab.innerHTML = '<span>+</span>';
            fab.onclick = () => {
                if (window.mobileEditor) window.mobileEditor.initNewNote();
            };
            document.body.appendChild(fab);
        }
        this.fab = fab;
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
        const hideTabsFor = ['chat', 'editor', 'reader-detail'];
        if (this.tabBar) {
            this.tabBar.style.display = hideTabsFor.includes(tabName) ? 'none' : 'flex';
        }
        if (this.fab) {
            this.fab.style.display = (tabName === 'home' || tabName === 'notes') ? 'flex' : 'none';
        }

        Object.entries(this.mainViews).forEach(([name, el]) => {
            if (el) {
                if (name === tabName) el.classList.add('active');
                else el.classList.remove('active');
            }
        });

        // Update Buttons
        const tabs = this.tabBar.querySelectorAll('.tab-btn');
        tabs.forEach(tab => {
            const target = tab.dataset.target.replace('view-', '');
            if (target === tabName) tab.classList.add('active');
            else tab.classList.remove('active');
        });

        this.activeTab = tabName;
        window.scrollTo(0, 0);
        if (tabName !== 'chat') this.renderApp();
    }

    navigateTo(viewName) {
        const view = this.subViews[viewName];
        if (view) {
            view.classList.add('active');
            view.style.display = 'flex';
            if (this.tabBar) this.tabBar.style.display = 'none';
            if (this.fab) this.fab.style.display = 'none';
        }
    }

    goBack() {
        Object.values(this.subViews).forEach(view => {
            if (view && view.classList.contains('active')) {
                view.classList.remove('active');
                view.style.display = 'none';
            }
        });
        if (this.tabBar) this.tabBar.style.display = 'flex';
        if (this.fab) this.fab.style.display = (this.activeTab === 'home' || this.activeTab === 'notes') ? 'flex' : 'none';
    }

    async renderApp() {
        const homeDyn = document.getElementById('home-dyn-list');
        const notesDyn = document.getElementById('notes-dyn-list');
        const readingDyn = document.getElementById('reading-dyn-list');

        if (homeDyn) homeDyn.innerHTML = '';
        if (notesDyn) notesDyn.innerHTML = '';
        if (readingDyn) readingDyn.innerHTML = '';

        try {
            let allData = {};
            if (window.appStorage) allData = await window.appStorage.getAll();

            const flatList = [];
            const noteKeys = [];
            const highlightGroups = {};

            const processItem = (key, item) => {
                if (!item || typeof item !== 'object') return;
                item._debug_key = key;

                const url = item.url || item.uri || item.pageUrl || '';
                const isNote = item.type === 'note' || (!url && !item.type);

                if (isNote) noteKeys.push(item);
                else {
                    const sourceKey = url || item.title || 'Unknown Source';
                    if (!highlightGroups[sourceKey]) {
                        highlightGroups[sourceKey] = { isGroup: true, id: sourceKey, title: item.title || item.pageTitle || 'Highlights', url, items: [], updatedAt: 0 };
                    }
                    highlightGroups[sourceKey].items.push(item);
                    const ts = new Date(item.updatedAt || item.timestamp || 0).getTime();
                    if (ts > highlightGroups[sourceKey].updatedAt) highlightGroups[sourceKey].updatedAt = ts;
                }
                flatList.push(item);
            };

            Object.entries(allData).forEach(([k, v]) => {
                if (k.startsWith('ai_') || k.startsWith('webdav_') || k === 'notes') return; // notes container handled differently in some versions
                processItem(k, v);
            });

            // If notes is a special container
            if (allData.notes) {
                Object.entries(allData.notes).forEach(([k, v]) => processItem(k, v));
            }

            const getTs = (i) => new Date(i.updatedAt || i.timestamp || i.date || 0).getTime();
            flatList.sort((a, b) => getTs(b) - getTs(a));
            noteKeys.sort((a, b) => getTs(b) - getTs(a));
            const sortedGroups = Object.values(highlightGroups).sort((a, b) => b.updatedAt - a.updatedAt);

            const q = this.searchQuery;
            const filter = (list) => q ? list.filter(i => (i.title || '').toLowerCase().includes(q) || (i.text || '').toLowerCase().includes(q)) : list;

            const categorize = (items) => {
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                const groups = { Today: [], Yesterday: [], Older: [] };
                items.forEach(i => {
                    const ts = getTs(i);
                    if (ts >= today) groups.Today.push(i);
                    else if (ts >= today - 86400000) groups.Yesterday.push(i);
                    else groups.Older.push(i);
                });
                return groups;
            };

            const renderCategorized = (container, items) => {
                const cats = categorize(filter(items));
                Object.entries(cats).forEach(([label, list]) => {
                    if (list.length > 0) {
                        const h = document.createElement('div');
                        h.className = 'note-category-header';
                        h.textContent = label;
                        container.appendChild(h);
                        list.forEach(item => this.renderCard(container, item._debug_key, item));
                    }
                });
            };

            if (homeDyn) renderCategorized(homeDyn, flatList.slice(0, 20));
            if (notesDyn) renderCategorized(notesDyn, noteKeys);
            if (readingDyn) {
                sortedGroups.forEach(g => this.renderCard(readingDyn, g.id, g));
            }

        } catch (e) { console.error('Render Error', e); }
    }

    async openReaderDetail(group) {
        const view = document.getElementById('view-reader-detail');
        if (!view) return;

        const container = view.querySelector('.editor-content');
        container.innerHTML = ''; // Start fresh

        // 1. Header Section
        const header = document.createElement('div');
        header.style.padding = '20px';
        header.innerHTML = `
            <h1 style="font-size:24px; margin-bottom:8px;">${group.title || 'Untitled'}</h1>
            <div style="font-size:12px; color:#8e8e93; margin-bottom:20px;">
                ${group.hostname || 'Web Selection'} • ${group.items ? group.items.length : 1} excerpts
            </div>
            <div style="display:flex; gap:10px; margin-bottom:20px;">
                <button class="tool-btn" style="background:#f2f2f7; padding:8px 16px; border-radius:20px; font-size:14px;" onclick="window.mobileCore.shareNote('${group.title}')">📤 Share</button>
                <button class="tool-btn" style="background:#f2f2f7; padding:8px 16px; border-radius:20px; font-size:14px;" onclick="window.mobileCore.summarizeReader()">✨ Summarize</button>
            </div>
        `;
        container.appendChild(header);

        // 2. Content Body
        const body = document.createElement('div');
        body.style.padding = '0 20px';
        const items = group.items || [group];
        items.forEach(it => {
            const block = document.createElement('div');
            block.style.marginBottom = '30px';
            const text = (it.text || it.content || '').replace(/<[^>]*>?/gm, ''); // Strip HTML
            block.innerHTML = `
                <blockquote style="border-left:4px solid var(--ios-blue); padding-left:15px; margin:0; font-size:18px; line-height:1.6; color:#111;">
                    ${text}
                </blockquote>
            `;
            body.appendChild(block);
        });
        container.appendChild(body);

        // 3. Evaluation Section
        const evaluation = document.createElement('div');
        evaluation.style.padding = '20px';
        evaluation.style.marginTop = '40px';
        evaluation.style.borderTop = '1px solid #eee';
        evaluation.style.paddingBottom = '100px';
        evaluation.innerHTML = `
            <h3 style="font-size:14px; color:#8e8e93; text-transform:uppercase; margin-bottom:12px;">Evaluation / 评价</h3>
            <textarea id="reader-eval" style="width:100%; height:150px; border:1px solid #eee; border-radius:12px; padding:12px; font-size:16px; font-family:inherit; outline:none; background:#fafafa;" placeholder="Add your thoughts or AI evaluation..."></textarea>
            <button style="margin-top:10px; width:100%; background:var(--ios-blue); color:white; border:none; padding:12px; border-radius:12px; font-weight:600;">Save Evaluation</button>
        `;
        container.appendChild(evaluation);

        this.navigateTo('reader-detail');
    }

    shareNote(title) {
        if (navigator.share) {
            navigator.share({ title: title, text: 'Check out this note from Highlighti' }).catch(() => { });
        } else {
            alert('Sharing is not supported on this browser.');
        }
    }


    renderCard(container, key, item) {
        if (!container) return;
        const isGroup = !!item.isGroup;
        const text = isGroup ? item.items[0].text : (item.text || item.content || '');
        const title = item.title || (text ? text.substring(0, 30) : 'Untitled Note');
        const date = new Date(item.updatedAt || item.timestamp || item.date || Date.now()).toLocaleDateString();

        const card = document.createElement('div');
        card.className = 'note-card';
        card.onclick = () => {
            if (isGroup) this.openReaderDetail(item);
            else if (item.type === 'note' || !item.url) window.mobileEditor.loadNote(key, item);
            else this.openReaderDetail(item);
        };

        card.innerHTML = `
            <div class="note-row-top">
                <span class="note-title">${title}</span>
                <span class="note-time">${date}</span>
            </div>
            <div class="note-preview">${isGroup ? `[${item.items.length}] ` : ''}${text ? text.substring(0, 80) : '...'}</div>
        `;
        container.appendChild(card);
    }

    openReaderDetail(group) {
        const view = document.getElementById('view-reader-detail');
        const body = view.querySelector('.editor-content'); // Simple clear for now
        body.innerHTML = `<h1 style="padding:20px;">${group.title}</h1>`;
        const items = group.items || [group];
        items.forEach(it => {
            const div = document.createElement('div');
            div.style.padding = '20px';
            div.style.borderBottom = '1px solid #eee';
            div.innerHTML = `<blockquote style="border-left:4px solid #007aff; padding-left:15px; margin:0;">${it.text || it.content}</blockquote>`;
            body.appendChild(div);
        });
        this.navigateTo('reader-detail');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.mobileCore = new MobileApp();
    setTimeout(() => window.mobileCore.renderApp(), 500);
});
