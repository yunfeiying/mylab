/**
 * options-resources.js - 资源管理器逻辑
 * 包含: 资源表格渲染, 资源格渲染, 拖拽选择, 数据库管理等
 */

// --- Database Manager Integration ---
window.resDatabase = null;

// ==========================================
// 1. 资源管理器主逻辑
// ==========================================

window.openResourceManager = function () {
    // 1. 清除选中状态
    window.selectedResources.clear();
    window.currentFolderId = null;

    // 2. 切换界面显示
    const emptyState = document.getElementById('empty-state');
    const contentView = document.getElementById('content-view');
    const searchContainer = document.getElementById('search-container');
    const chatView = document.getElementById('chat-view');
    const resView = document.getElementById('resource-view');

    if (emptyState) emptyState.style.display = 'none';
    if (contentView) contentView.style.display = 'none';
    if (searchContainer) searchContainer.style.display = 'none';
    if (chatView) chatView.style.display = 'none';
    if (resView) resView.style.display = 'flex';

    // 3. 重置侧边栏高亮
    document.querySelectorAll('.page-item, .folder-container').forEach(el => el.classList.remove('active'));

    const btnCreateFolder = document.getElementById('btn-create-folder');
    if (btnCreateFolder) btnCreateFolder.classList.add('active');

    // 4. 恢复正常的资源管理器头部
    const headerTitle = resView ? resView.querySelector('h1') : null;
    if (headerTitle) headerTitle.innerText = window.getI18nMsg('ui_resourceManager') || "Resources";

    const headerActions = resView ? resView.querySelector('.content-header > div:last-child') : null;
    if (headerActions) {
        headerActions.innerHTML = `
            <div style="display:flex; gap:10px; align-items:center;">
                <button class="icon-btn meta-action-btn" id="btn-res-preview" title="Preview Webpage">
                    <svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                <button class="icon-btn meta-action-btn" id="btn-res-ai" title="AI Generate">
                    <svg viewBox="0 0 24 24"><path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"/></svg>
                </button>
                <button class="icon-btn meta-action-btn" id="btn-res-select-all" title="Select All">
                    <svg viewBox="0 0 24 24"><path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"/></svg>
                </button>
                <button class="icon-btn meta-action-btn" id="btn-res-delete" title="Delete">
                    <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                </button>
                <span id="res-selection-count" style="font-size:16px; color:#5f6368; min-width:20px; text-align:center; font-weight:bold;"></span>
            </div>
        `;
        if (typeof window.setupResourceHeaderEvents === 'function') window.setupResourceHeaderEvents();
    }

    document.querySelectorAll('.page-item').forEach(el => el.classList.remove('active'));
    window.selectedUrl = null;
    const countEl = document.getElementById('res-selection-count');
    if (countEl) countEl.innerText = '';

    window.renderResourceGrid();
    window.enableBoxSelection();
};

window.initResourceDatabase = function () {
    if (window.resDatabase) return;

    window.resDatabase = new window.DatabaseManager('resource-grid', {
        idField: 'id',
        columns: [
            { title: '序号', className: 'col-index', field: 'index', render: (item, id) => item.index || '' },
            {
                title: '文章名称', className: 'col-name', field: 'title', render: (item, id) => {
                    const icon = item.type === 'folder'
                        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="#fbc02d" style="margin-right:8px;"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>'
                        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5f6368" stroke-width="2" style="margin-right:8px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>';
                    return `<div style="display:flex; align-items:center;">${icon} ${window.escapeHtml(item.title)}</div>`;
                }
            },
            { title: '标签', className: 'col-color', field: 'color', render: (item) => item.type === 'file' ? `<span class="res-tag-pill" style="background:${item.color || '#e0e0e0'}"></span>` : '' },
            { title: '灵感', className: 'col-inspo', field: 'inspoCount', render: (item) => item.type === 'file' ? `<span class="res-count-badge">${item.inspoCount || 0}</span>` : `<span class="res-count-badge">${item.itemCount || 0}</span>` },
            { title: '标亮内容', className: 'col-highlights', field: 'highlightCount', render: (item) => item.type === 'file' ? `<span class="res-count-badge">${item.highlightCount || 0}</span>` : '' },
            { title: '网址', className: 'col-url', field: 'url', render: (item) => item.type === 'file' ? `<a href="${item.url}" class="res-link" target="_blank">${item.url}</a>` : '目录' },
            { title: '智能预读', className: 'col-preread', field: 'aiStatus', render: (item) => item.type === 'file' ? `<span class="res-ai-status">Done</span>` : '' },
            { title: '备注', className: 'col-remark', field: 'note', render: (item) => item.type === 'file' ? window.escapeHtml(item.note || '') : '' },
            { title: '类别', className: 'col-category', field: 'category', render: (item) => item.type === 'file' ? window.escapeHtml(item.category || '未分类') : '分类' },
            { title: '时间', className: 'col-time', field: 'timestamp', render: (item) => item.timeStr || '' },
            { title: '', className: 'col-empty', sortable: false, render: () => '' }
        ],
        onRowClick: (item) => {
            if (item.id === 'back-btn') {
                window.currentFolderId = null;
                window.renderResourceGrid();
            }
        },
        onRowDoubleClick: (item) => {
            if (item.type === 'file') {
                window.selectPage(item.id);
            } else if (item.type === 'folder') {
                window.currentFolderId = item.id;
                window.resDatabase.clearSelection();
                window.renderResourceGrid();
            }
        },
        onSelectionChange: (ids) => {
            window.selectedResources = ids;
            const countEl = document.getElementById('res-selection-count');
            if (countEl) countEl.innerText = ids.size > 0 ? ids.size : '';

            // Sync with AI Chat if visible
            const chatView = document.getElementById('chat-view');
            const isChatVisible = chatView && chatView.style.display !== 'none';

            if (isChatVisible && window.resDatabase && window.resDatabase.data) {
                window.resDatabase.data.forEach(item => {
                    if (item.type === 'file') {
                        const isSelected = ids.has(item.id);
                        const isInChat = window.chatSources ? window.chatSources.some(s => s.url === item.id) : false;

                        if (isSelected && !isInChat) {
                            if (typeof window.addChatSource === 'function') window.addChatSource(item.id);
                        } else if (!isSelected && isInChat) {
                            if (typeof window.removeChatSource === 'function') window.removeChatSource(item.id);
                        }
                    }
                });
            }
        }
    });
};

window.renderResourceGrid = function () {
    const grid = document.getElementById('resource-grid');
    if (!grid) return;

    if (!window.resDatabase) window.initResourceDatabase();

    const displayItems = [];
    let currentIndex = 1;

    // 1. Back Button
    if (window.currentFolderId) {
        displayItems.push({ id: 'back-btn', title: '返回上级', type: 'folder', index: '' });
    }

    // 2. Folders
    if (!window.currentFolderId) {
        window.folderStructure.forEach(f => {
            displayItems.push({
                id: f.id,
                title: f.title,
                type: 'folder',
                index: currentIndex++,
                itemCount: f.items.length,
                timeStr: ''
            });
        });
    }

    // 3. Files
    const urlsInFolders = new Set();
    if (!window.currentFolderId) {
        window.folderStructure.forEach(f => f.items.forEach(u => urlsInFolders.add(u)));
    }

    const itemsToProcess = window.currentFolderId
        ? (window.folderStructure.find(f => f.id === window.currentFolderId)?.items || [])
            .map(url => window.groupedData.find(p => p.url === url)).filter(Boolean)
        : window.groupedData.filter(page => !urlsInFolders.has(page.url));

    itemsToProcess.forEach(page => {
        const folder = window.folderStructure.find(f => f.items.includes(page.url));
        const date = new Date(page.timestamp);
        const timeStr = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;

        displayItems.push({
            id: page.url,
            title: page.title,
            type: 'file',
            index: currentIndex++,
            color: page.color,
            inspoCount: page.inspirations ? page.inspirations.length : 0,
            highlightCount: page.items ? page.items.length : 0,
            url: page.url,
            note: page.note,
            category: folder ? folder.title : '未分类',
            timeStr: timeStr
        });
    });

    window.resDatabase.setData(displayItems);
};

window.setupResourceItemEvents = function (el) {
    const id = el.dataset.id;
    if (!id) return;
};

window.updateGridSelection = function () {
    if (window.resDatabase) window.resDatabase.syncUI();
};

window.setupGridDragEvents = function (el, type) {
    el.ondragstart = (e) => {
        const currentId = el.dataset.id;
        let dragIds = [];

        if (window.selectedResources.has(currentId)) {
            dragIds = Array.from(window.selectedResources);
        } else {
            dragIds = [currentId];
            window.selectedResources.clear();
            window.selectedResources.add(currentId);
            window.updateGridSelection();
        }

        e.dataTransfer.setData('application/json', JSON.stringify(dragIds));
        e.dataTransfer.setData('text/type', type);
        e.dataTransfer.effectAllowed = 'move';
        el.style.opacity = '0.5';
    };

    el.ondragend = () => {
        el.style.opacity = '1';
        window.removeDragStyles();
    };

    el.ondragover = (e) => {
        e.preventDefault();
        el.classList.add('drag-over-target');
    };

    el.ondragleave = () => {
        el.classList.remove('drag-over-target');
    };

    el.ondrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.remove('drag-over-target');

        const rawData = e.dataTransfer.getData('application/json');
        if (!rawData) return;

        const draggedIds = JSON.parse(rawData);
        const targetId = el.dataset.id;
        const targetType = el.dataset.type;

        if (draggedIds.includes(targetId)) return;

        if (targetType === 'folder') {
            for (const id of draggedIds) {
                if (!id.startsWith('f_')) {
                    await window.movePageToFolder(id, targetId);
                }
            }
            window.renderResourceGrid();
        }

        if (targetType === 'file') {
            const validSourceIds = draggedIds.filter(id => !id.startsWith('f_') && id !== targetId);
            if (validSourceIds.length > 0) {
                await window.createNewFolderWithItems(targetId, validSourceIds);
                window.renderResourceGrid();
            }
        }
    };
};

window.removeDragStyles = function () {
    document.querySelectorAll('.drag-over-target').forEach(el => el.classList.remove('drag-over-target'));
};

window.enableBoxSelection = function () {
    const grid = document.getElementById('resource-grid');
    if (!grid) return;

    if (grid.dataset.selectionEnabled) return;
    grid.dataset.selectionEnabled = 'true';

    const marquee = document.createElement('div');
    marquee.id = 'selection-marquee';
    grid.appendChild(marquee);

    grid.addEventListener('mousedown', (e) => {
        if (e.target.closest('.res-item') || e.button !== 0) return;

        if (!e.ctrlKey && !e.metaKey) {
            window.selectedResources.clear();
            window.updateGridSelection();
        }

        const rect = grid.getBoundingClientRect();
        const startX = e.clientX - rect.left;
        const startY = e.clientY - rect.top + grid.scrollTop;

        marquee.style.left = startX + 'px';
        marquee.style.top = startY + 'px';
        marquee.style.width = '0px';
        marquee.style.height = '0px';
        marquee.style.display = 'block';

        const initialSelection = new Set(window.selectedResources);

        const onMove = (em) => {
            const currentX = em.clientX - rect.left;
            const currentY = em.clientY - rect.top + grid.scrollTop;

            const left = Math.min(startX, currentX);
            const top = Math.min(startY, currentY);
            const width = Math.abs(currentX - startX);
            const height = Math.abs(currentY - startY);

            marquee.style.left = left + 'px';
            marquee.style.top = top + 'px';
            marquee.style.width = width + 'px';
            marquee.style.height = height + 'px';

            document.querySelectorAll('.res-item').forEach(item => {
                const itemLeft = item.offsetLeft;
                const itemTop = item.offsetTop;
                const itemRight = itemLeft + item.offsetWidth;
                const itemBottom = itemTop + item.offsetHeight;

                const isIntersecting = !(left + width < itemLeft ||
                    left > itemRight ||
                    top + height < itemTop ||
                    top > itemBottom);

                const id = item.dataset.id;

                if (isIntersecting) {
                    window.selectedResources.add(id);
                } else {
                    if (!e.ctrlKey && !e.metaKey) {
                        window.selectedResources.delete(id);
                    } else {
                        if (initialSelection.has(id)) window.selectedResources.add(id);
                        else window.selectedResources.delete(id);
                    }
                }
            });
            window.updateGridSelection();
        };

        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            marquee.style.display = 'none';
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
};

console.log('[options-resources.js] Loaded: Resource manager logic');
