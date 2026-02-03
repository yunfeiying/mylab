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
            reading: document.getElementById('view-reading'),
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
        console.log('MobileCore Cloned Version Initialized');
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
        // Hide Tab Bar for specific views to provide a focused experience
        const hideTabsFor = ['chat', 'reading', 'notes', 'search'];
        if (this.tabBar) {
            if (hideTabsFor.includes(tabName)) {
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
        // Always scroll to top on tab switch
        window.scrollTo(0, 0);
        if (tabName === 'home' || tabName === 'notes' || tabName === 'reading') this.renderApp();
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
        const readingList = document.querySelector('#view-reading .notes-list-content') || document.getElementById('view-reading');

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

        let readingDyn = document.getElementById('reading-dyn-list');
        if (readingList && !readingDyn) {
            readingDyn = document.createElement('div');
            readingDyn.id = 'reading-dyn-list';
            readingList.appendChild(readingDyn);
        }

        if (homeDyn) homeDyn.innerHTML = '';
        if (notesDyn) notesDyn.innerHTML = '';
        if (readingDyn) readingDyn.innerHTML = '';

        try {
            let allData = {};
            if (window.appStorage) {
                allData = await window.appStorage.getAll();
            }

            const allKeys = Object.keys(allData);

            // AUTO-INJECT IF EMPTY
            if (allKeys.length === 0 && window.appStorage) {
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

            const flatList = [];
            const noteKeys = [];
            const highlightGroups = {}; // [NEW] Group highlights by URL/Source

            // 1. Helper to Process Item
            const processItem = (key, item, realType) => {
                if (!item) return;

                // CRITICAL FIX: If item is a string, wrap it in an object so we can add properties
                let processedItem = item;
                if (typeof item === 'string') {
                    processedItem = { text: item, type: 'note', id: key };
                } else if (typeof item !== 'object') {
                    return; // Skip other non-objects
                }

                processedItem._debug_key = key;

                // Identify if it's a Note or Highlight
                const rawUrl = processedItem.url || processedItem.uri || processedItem.pageUrl || '';
                const sourceKey = rawUrl || processedItem.title || processedItem.pageTitle || 'Unknown Source';

                let isNote = !rawUrl;
                if (processedItem.type === 'note') isNote = true;
                if (processedItem.type === 'highlight' || realType === 'highlight') isNote = false;

                if (isNote) {
                    noteKeys.push(processedItem);
                } else {
                    // Grouping Logic
                    if (!highlightGroups[sourceKey]) {
                        let hostname = processedItem.hostname || '';
                        if (!hostname && rawUrl && rawUrl.startsWith('http')) {
                            try { hostname = new URL(rawUrl).hostname; } catch (e) { hostname = 'Web Clip'; }
                        }

                        highlightGroups[sourceKey] = {
                            isGroup: true,
                            id: sourceKey,
                            title: processedItem.title || processedItem.pageTitle || 'Web Highlights',
                            url: rawUrl,
                            hostname: hostname || 'Web Clip',
                            items: [],
                            updatedAt: processedItem.updatedAt || processedItem.timestamp || processedItem.createdAt || processedItem.date || 0
                        };
                    }
                    highlightGroups[sourceKey].items.push(processedItem);

                    const itemTs = new Date(processedItem.updatedAt || processedItem.timestamp || processedItem.createdAt || processedItem.date || 0).getTime();
                    const groupTs = new Date(highlightGroups[sourceKey].updatedAt).getTime();
                    if (itemTs > groupTs) highlightGroups[sourceKey].updatedAt = processedItem.updatedAt || processedItem.timestamp || processedItem.createdAt || processedItem.date;
                }

                flatList.push(processedItem);
            };

            // 2. Iterate Data
            Object.keys(allData).forEach(k => {
                try {
                    if (k.startsWith('ai_') || k.startsWith('webdav_') || k.startsWith('sync_') || k === 'settings') return;

                    let val = allData[k];
                    if (!val) return;

                    if (typeof val === 'string') {
                        try { val = JSON.parse(val); }
                        catch (e) { val = { text: val, type: 'note', id: k }; }
                    }

                    if (Array.isArray(val)) {
                        val.forEach(child => processItem(k, child, (child && typeof child === 'object') ? child.type : undefined));
                    } else if (val && typeof val === 'object') {
                        // Special container 'notes' handling
                        if (k === 'notes' && !val.type && !val.content) {
                            Object.entries(val).forEach(([subK, subV]) => {
                                processItem(subK, subV, (subV && typeof subV === 'object') ? subV.type : undefined);
                            });
                        } else {
                            processItem(k, val, val.type || (k.startsWith('http') ? 'highlight' : 'note'));
                        }
                    }
                } catch (e) { console.warn('Item error:', e); }
            });

            // 3. Sort Everything
            const getTs = (item) => {
                if (!item) return 0;
                const t = item.updatedAt || item.timestamp || item.createdAt || item.date || 0;
                return new Date(t).getTime() || 0;
            };

            const isToday = (ts) => {
                const d = new Date(ts);
                const now = new Date();
                return d.getDate() === now.getDate() &&
                    d.getMonth() === now.getMonth() &&
                    d.getFullYear() === now.getFullYear();
            };

            flatList.sort((a, b) => getTs(b) - getTs(a));
            noteKeys.sort((a, b) => getTs(b) - getTs(a));

            // Sort grouped highlights by latest activity
            const sortedGroups = Object.values(highlightGroups).sort((a, b) => {
                return (new Date(b.updatedAt).getTime() || 0) - (new Date(a.updatedAt).getTime() || 0);
            });

            // Enhanced Home logic: Today, otherwise Recent
            let homeItems = flatList.filter(item => isToday(getTs(item)));
            let feedTitle = 'TODAY';

            if (homeItems.length === 0) {
                homeItems = flatList.slice(0, 10);
                feedTitle = 'RECENT ACTIVITY';
            }

            const homeHeaderTitle = document.querySelector('#view-home .list-title');
            if (homeHeaderTitle) homeHeaderTitle.textContent = feedTitle;

            console.log(`Render stats: Total=${flatList.length}, Feed=${homeItems.length}, Notes=${noteKeys.length}, Groups=${sortedGroups.length}`);

            // --- Independent Renders ---
            if (homeDyn) {
                homeDyn.innerHTML = '';
                if (homeItems.length === 0) homeDyn.innerHTML = '<div style="padding:40px;text-align:center;color:#999;">Welcome! No content found.</div>';
                else homeItems.forEach(item => this.renderCard(homeDyn, item._debug_key, item));
            }

            if (notesDyn) {
                notesDyn.innerHTML = '';
                if (noteKeys.length === 0) notesDyn.innerHTML = '<div style="padding:40px;text-align:center;color:#999;">No Notes</div>';
                else noteKeys.forEach(item => this.renderCard(notesDyn, item._debug_key, item));
            }

            if (readingDyn) {
                readingDyn.innerHTML = '';
                if (sortedGroups.length === 0) {
                    readingDyn.innerHTML = `<div style="padding:40px;text-align:center;color:#999;">No Highlights Found.<br><small style="opacity:0.5;">(Total entries: ${Object.keys(allData).length})</small></div>`;
                } else {
                    sortedGroups.forEach(group => this.renderCard(readingDyn, group.id, group));
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

    openReaderDetail(group) {
        // If it's a single item not wrapped in a group, wrap it
        if (!group.isGroup) {
            group = { items: [group], title: group.title || 'Highlight', hostname: group.hostname || 'Web Clip' };
        }

        const view = document.getElementById('view-reader-detail');
        if (!view) return;

        const titleEl = view.querySelector('.editor-title');
        const metaEl = view.querySelector('.note-time');
        const bodyEl = view.querySelector('.editor-body');

        if (titleEl) titleEl.textContent = group.title || 'Web Highlights';
        if (metaEl) metaEl.textContent = (group.hostname || 'Web Clip') + ' • ' + group.items.length + ' highlights';

        if (bodyEl) {
            let html = '';

            group.items.forEach((item, idx) => {
                const text = item.content || item.text || item.quote || item.highlight || item.body || '';
                html += `<div style="margin-bottom: 32px; position: relative;">
                    <div style="font-size: 12px; color: #8e8e93; margin-bottom: 8px;">HIGHLIGHT #${idx + 1}</div>
                    <blockquote style="border-left:4px solid #007aff; padding-left:16px; margin:0; font-size:18px; line-height:1.6; color:#333;">${text}</blockquote>`;

                if (item.comment || item.note) {
                    const comment = item.comment || item.note;
                    html += `<div style="margin-top:16px; padding:12px; background:#f2f2f7; border-radius:10px; font-size:16px;">
                        <span style="font-weight:600; font-size:12px; color:#007aff; display:block; margin-bottom:4px;">NOTE</span>
                        ${comment}
                    </div>`;
                }
                html += `</div>`;
            });

            if (group.url) {
                html += `<div style="margin-top:40px; text-align:center; padding-bottom: 40px;">
                    <a href="${group.url}" target="_blank" style="display:inline-block; padding:12px 24px; background:#007aff; color:white; text-decoration:none; border-radius:24px; font-weight:500;">Visit Source Website</a>
                </div>`;
            }

            bodyEl.innerHTML = html;
        }

        this.navigateTo('reader-detail');
    }

    renderCard(container, key, item) {
        if (!container) return;

        const isGroup = !!item.isGroup;
        const text = isGroup
            ? (item.items[0].content || item.items[0].text || '')
            : (item.content || item.text || item.quote || item.highlight || item.body || '');

        const title = item.title || item.pageTitle || (text ? text.substring(0, 50) : 'Untitled');
        const date = isGroup
            ? (new Date(item.updatedAt).toLocaleDateString())
            : (item.date || item.createdAt || (item.timestamp ? new Date(item.timestamp).toLocaleDateString() : 'Just now'));

        const card = document.createElement('div');
        card.className = 'note-card';

        card.onclick = () => {
            if (isGroup) {
                this.openReaderDetail(item);
            } else {
                const hasUrl = item.url || item.uri || item.pageUrl || (key && key.startsWith('http'));
                let isNote = !hasUrl;
                if (item.type === 'note') isNote = true;
                if (item.type === 'highlight') isNote = false;

                if (isNote) {
                    if (window.mobileEditor && typeof window.mobileEditor.loadNote === 'function') {
                        window.mobileEditor.loadNote(key, item);
                    }
                } else {
                    this.openReaderDetail(item);
                }
            }
        };

        const badge = isGroup ? `<span style="background: #007aff; color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px; margin-left:8px;">${item.items.length}</span>` : '';

        card.innerHTML = `
            <div class="note-row-top">
                <span class="note-title" style="flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${title}</span>
                <span class="note-time">${date}</span>
            </div>
            <div class="note-preview">${badge} ${text ? text.substring(0, 100) : 'No content available'}</div>
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
