/**
 * sidebar-ui.js - 侧边栏渲染与交互
 * 包含: renderSidebar, createFolderItem, createPageItem, 以及文件夹管理逻辑
 */

// --- Sidebar Categorizer Integration ---
window.sidebarCategorizer = null;

// ==========================================
// 1. 核心渲染函数
// ==========================================

window.renderSidebar = function () {
    const listEl = document.getElementById('page-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    // 1. Prepare Categorized Data (Include both floating pages and folders)
    const urlsInFolders = new Set();
    const folderMapping = [];
    if (Array.isArray(window.folderStructure)) {
        window.folderStructure.forEach(folder => {
            if (!folder || !Array.isArray(folder.items)) return;
            folder.items.forEach(u => urlsInFolders.add(u));

            // Ensure folder has a timestamp for categorizer
            if (!folder.timestamp) {
                const itemTss = folder.items.map(u => window.groupedData.find(p => p.url === u)?.timestamp || 0);
                folder.timestamp = Math.max(...itemTss, 0);
            }

            folderMapping.push({
                ...folder,
                isFolder: true
            });
        });
    }

    const floatingPages = window.groupedData.filter(page => !urlsInFolders.has(page.url));
    const allSortedData = [...floatingPages, ...folderMapping].sort((a, b) => b.timestamp - a.timestamp);

    // 2. Setup/Update SidebarCategorizer
    const catContainer = document.createElement('div');
    catContainer.id = 'sidebar-time-categorizer';
    catContainer.style.flex = '1';
    listEl.appendChild(catContainer);

    if (!window.sidebarCategorizer) {
        window.sidebarCategorizer = new window.SidebarCategorizer('sidebar-time-categorizer', {
            createPageItemFn: (item) => {
                if (item.isFolder) return window.createFolderItem(item);
                return window.createPageItem(item);
            },
            initiallyExpanded: 'today'
        });
    } else {
        window.sidebarCategorizer.container = catContainer;
    }

    window.sidebarCategorizer.setData(allSortedData);
};

// ==========================================
// 2. 项目组件渲染
// ==========================================

window.createFolderItem = function (folder) {
    if (!folder || !Array.isArray(folder.items)) return document.createElement('div');
    const validItems = folder.items.filter(u => window.groupedData.find(p => p.url === u));

    const folderEl = document.createElement('div');
    folderEl.className = `folder-container ${folder.collapsed ? 'collapsed' : ''}`;
    folderEl.dataset.id = folder.id;

    folderEl.innerHTML = `
      <div class="folder-header" style="color:#5f6368;">
        <svg class="folder-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">
            <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/>
        </svg>
        <span class="folder-title" contenteditable="${window.IS_PRO}" title="Rename">${window.escapeHtml(folder.title)}</span>
        <div style="display:flex;align-items:center;gap:5px;margin-left:auto;">
           <span class="folder-count">${validItems.length}</span>
           ${window.IS_PRO ? `<svg class="delete-page-btn folder-del-btn" viewBox="0 0 24 24" style="width:14px;height:14px;cursor:pointer;"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>` : ''}
        </div>
      </div>
      <div class="folder-content"></div>
    `;

    const header = folderEl.querySelector('.folder-header');
    if (header) {
        header.onclick = (e) => {
            if (e.target.isContentEditable || e.target.closest('.folder-del-btn')) return;
            folder.collapsed = !folder.collapsed;
            window.saveFolderStructure();
            window.renderSidebar();
        };
        if (window.IS_PRO) {
            const delBtn = folderEl.querySelector('.folder-del-btn');
            if (delBtn) delBtn.onclick = async (e) => {
                e.stopPropagation();
                window.folderStructure = window.folderStructure.filter(f => f.id !== folder.id);
                await window.saveFolderStructure();
                window.renderSidebar();
            };
            const titleEl = folderEl.querySelector('.folder-title');
            if (titleEl) {
                titleEl.onblur = () => { folder.title = titleEl.innerText; window.saveFolderStructure(); };
                titleEl.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); titleEl.blur(); } };
            }
            window.setupFolderDragEvents(header, folder.id);
            header.draggable = true;
            header.ondragstart = (e) => { e.dataTransfer.setData('text/plain', 'folder:' + folder.id); };
        }
    }

    const contentEl = folderEl.querySelector('.folder-content');
    if (contentEl) {
        validItems.forEach(url => {
            const page = window.groupedData.find(p => p.url === url);
            if (page) contentEl.appendChild(window.createPageItem(page));
        });
    }
    return folderEl;
};

window.createPageItem = function (page) {
    const div = document.createElement('div');
    div.className = `page-item ${window.selectedUrl === page.url ? 'active' : ''}`;
    div.dataset.url = page.url;

    const distinctColors = [...new Set(page.items.map(i => i.color))].slice(0, 5);
    let colorDotsHtml = '<div class="color-dots-container">';
    distinctColors.forEach(c => { colorDotsHtml += `<span class="color-dot" style="background:${c}"></span>`; });
    colorDotsHtml += '</div>';

    div.innerHTML = `
      <div class="page-title" title="${window.escapeHtml(page.title)}">${window.escapeHtml(page.title)}</div>
      <div class="page-meta">
        <span class="page-date">${window.safeFormatDate ? window.safeFormatDate(page.timestamp, false) : new Date(page.timestamp).toLocaleDateString()}</span>
        ${colorDotsHtml}
        <div class="highlight-count">${page.items.length}</div>
      </div>
    `;
    const meta = div.querySelector('.page-meta');
    const delBtn = document.createElement('div');
    delBtn.innerHTML = `<svg class="delete-page-btn" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
    meta.appendChild(delBtn);

    delBtn.onclick = async (e) => {
        e.stopPropagation();

        // 1. 获取数据并存入回收站
        const targetKey = page.url;
        const storageData = await chrome.storage.local.get(targetKey);

        if (storageData[targetKey]) {
            const trashItem = {
                originalKey: targetKey,
                title: page.title,
                deletedAt: Date.now(),
                data: storageData[targetKey] // 完整备份
            };

            const res = await chrome.storage.local.get('trash_bin');
            let trash = res.trash_bin || [];
            trash.push(trashItem);
            await chrome.storage.local.set({ 'trash_bin': trash });

            // 物理删除原数据
            await chrome.storage.local.remove(targetKey);
        }

        // 2. UI 动画与更新
        div.style.opacity = '0';
        setTimeout(() => div.remove(), 200);

        // 从内存数据移除
        window.groupedData = window.groupedData.filter(p => p.url !== page.url);
        if (window.selectedUrl === page.url) { window.showEmptyState(); window.selectedUrl = null; }

        // Update trash count
        if (typeof window.updateTrashCount === 'function') window.updateTrashCount();
        window.showToast('Moved to Trash');
    };
    div.onclick = () => window.selectPage(page.url);

    if (window.IS_PRO) {
        div.draggable = true;
        div.ondragstart = (e) => {
            // Standard data for folder operations
            e.dataTransfer.setData('text/plain', page.url);

            // Rich data for Notes - include title and highlights content
            const noteData = {
                type: 'highlighti-page',
                title: page.title,
                url: page.url,
                items: page.items, // Pass raw items for rich rendering
                timestamp: page.timestamp,
                highlightCount: page.items.length
            };
            e.dataTransfer.setData('application/highlighti-page', JSON.stringify(noteData));

            div.classList.add('dragging');
        };
        div.ondragend = () => { div.classList.remove('dragging'); document.querySelectorAll('.drag-over-folder').forEach(el => el.classList.remove('drag-over-folder')); };
        div.ondragover = (e) => { e.preventDefault(); div.style.background = "#fff9c4"; };
        div.ondragleave = () => { div.style.background = ""; };
        div.ondrop = (e) => {
            e.preventDefault(); e.stopPropagation();
            div.style.background = "";
            const draggedUrl = e.dataTransfer.getData('text/plain');
            if (draggedUrl && draggedUrl !== page.url) {
                window.createNewFolderWithItems(draggedUrl, page.url);
            }
        };
    }
    return div;
};

// ==========================================
// 3. 文件夹管理逻辑
// ==========================================

window.setupFolderDragEvents = function (header, folderId) {
    header.ondragover = (e) => { e.preventDefault(); header.classList.add('drag-over-folder'); };
    header.ondragleave = () => { header.classList.remove('drag-over-folder'); };
    header.ondrop = (e) => { e.preventDefault(); header.classList.remove('drag-over-folder'); const url = e.dataTransfer.getData('text/plain'); window.movePageToFolder(url, folderId); };
};

window.saveFolderStructure = async function () {
    await chrome.storage.local.set({ 'folder_structure': window.folderStructure });
};

window.createNewFolderWithItems = async function (targetUrl, sourceUrls) {
    const sources = Array.isArray(sourceUrls) ? sourceUrls : [sourceUrls];
    window.removeFromAllFolders(targetUrl);
    sources.forEach(url => window.removeFromAllFolders(url));

    const allItems = Array.from(new Set([targetUrl, ...sources]));

    // Calculate folder timestamp based on the newest item
    const itemTss = allItems.map(url => window.groupedData.find(p => p.url === url)?.timestamp || 0);
    const maxTs = Math.max(...itemTss);

    const defaultTitle = window.getI18nMsg('ui_newFolder');
    const newFolder = {
        id: 'f_' + Date.now(),
        title: defaultTitle,
        items: allItems,
        collapsed: false,
        timestamp: maxTs
    };

    window.folderStructure.unshift(newFolder);
    await window.saveFolderStructure();
    window.renderSidebar();
};

window.createNewEmptyFolder = async function () {
    const defaultTitle = window.getI18nMsg('ui_newFolder');
    const newFolder = { id: 'f_' + Date.now(), title: defaultTitle, items: [], collapsed: false, timestamp: Date.now() };
    window.folderStructure.unshift(newFolder);
    await window.saveFolderStructure();
    window.renderSidebar();
};

window.removeFromAllFolders = function (url) {
    window.folderStructure.forEach(f => { f.items = f.items.filter(u => u !== url); });
};

window.movePageToFolder = async function (url, targetFolderId) {
    window.removeFromAllFolders(url);
    const folder = window.folderStructure.find(f => f.id === targetFolderId);
    if (folder) {
        folder.items.push(url);
        folder.collapsed = false;

        // Update folder timestamp if the moved item is newer
        const page = window.groupedData.find(p => p.url === url);
        if (page && page.timestamp > (folder.timestamp || 0)) {
            folder.timestamp = page.timestamp;
        }
    }
    await window.saveFolderStructure();
    window.renderSidebar();
};

console.log('[sidebar-ui.js] Loaded: Sidebar rendering and folder management');

// ==========================================
// 4. Sidebar Toggle Logic
// ==========================================
window.initSidebarToggle = async function () {
    const sidebar = document.querySelector('.sidebar');
    const btnCollapse = document.getElementById('btn-collapse-sidebar');
    const btnExpand = document.getElementById('btn-expand-sidebar');

    if (!sidebar || !btnCollapse || !btnExpand) return;

    const toggle = (show) => {
        if (show) {
            sidebar.classList.remove('collapsed');
            btnExpand.style.display = 'none';
        } else {
            sidebar.classList.add('collapsed');
            btnExpand.style.display = 'flex';
        }
        chrome.storage.local.set({ 'sidebar_collapsed': !show });
    };

    btnCollapse.onclick = (e) => {
        e.stopPropagation(); // Prevent bubbling
        toggle(false);
    };
    btnExpand.onclick = (e) => {
        e.stopPropagation();
        toggle(true);
    };

    // Load initial state
    const res = await chrome.storage.local.get('sidebar_collapsed');
    // If it was collapsed, apply it immediately. Note: layout shift might occur, but it's acceptable.
    if (res.sidebar_collapsed) {
        // We manually set class first to avoid transition on load if possible, but CSS transition is present.
        // To avoid animation on load, we could temporarily disable transition.
        sidebar.style.transition = 'none';
        sidebar.classList.add('collapsed');
        btnExpand.style.display = 'flex';
        // Force reflow
        sidebar.offsetHeight;
        sidebar.style.transition = '';
    }
};
