/**
 * notes-sidebar.js
 * Handles sidebar note list, tree rendering, and Drag & Drop between folders.
 */

// Global accessors for clarity
const getNotes = () => window.notes || [];
const isTrash = () => window.isTrashMode || false;

function renderNotesList(filterText = '') {
    const listEl = document.getElementById('notes-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const titleEl = document.querySelector('.sidebar-title');
    if (titleEl) titleEl.innerText = isTrash() ? 'Trash Bin' : 'Notes';

    const btnTrash = document.getElementById('btn-trash-view');
    if (btnTrash) btnTrash.classList.toggle('active', isTrash());

    const query = filterText.toLowerCase();
    const relevantNotes = getNotes().filter(n => isTrash() ? n.isDeleted : !n.isDeleted);

    // 1. Search Mode
    if (query) {
        relevantNotes.filter(n => (n.title?.toLowerCase().includes(query)) || (n.content?.toLowerCase().includes(query)))
            .forEach(note => {
                const el = renderTreeRow({ ...note, type: 'note', name: note.title || 'Untitled', level: 0 }, false);
                el.onclick = (e) => { if (!e.target.closest('button')) selectNote(note.id); };
                listEl.appendChild(el);
            });
        return;
    }

    // 2. Trash Mode
    if (isTrash()) {
        relevantNotes.sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0))
            .forEach(note => {
                const el = renderTreeRow({ ...note, type: 'note', name: note.title || 'Untitled', level: 0, isDeleted: true }, false);
                el.onclick = () => selectNote(note.id);
                listEl.appendChild(el);
            });
        return;
    }

    // 3. Normal Mode with Multi-level Folders
    const treeContainer = document.createElement('div');
    treeContainer.className = 'notes-tree-container';
    listEl.appendChild(treeContainer);

    // If we have the Categorizer (Time + Folder mix)
    if (window.SidebarCategorizer) {
        if (!window.noteCategorizer) {
            window.noteCategorizer = new SidebarCategorizer(treeContainer, {
                createPageItemFn: (item) => {
                    if (item.type === 'folder') {
                        const wrapper = document.createElement('div');
                        wrapper.className = 'tree-folder-wrapper';
                        renderSharedFolder(wrapper, item, 0);
                        return wrapper;
                    }
                    const el = renderTreeRow({ ...item, type: 'note', name: item.title || 'Untitled', level: 0 }, true);
                    el.onclick = (e) => { e.stopPropagation(); if (!e.target.closest('button')) selectNote(item.id); };
                    if (window.currentNoteId === item.id) el.classList.add('active');
                    return el;
                },
                initiallyExpanded: 'today'
            });
        } else {
            window.noteCategorizer.container = treeContainer;
        }

        const rootItems = [];
        if (window.folderManager) {
            window.folderManager.getChildren(null).forEach(f => {
                rootItems.push({ ...f, type: 'folder', timestamp: f.createdAt || Date.now() });
            });
        }
        getNotes().filter(n => !n.isDeleted && !n.folderId).forEach(n => {
            rootItems.push({ ...n, type: 'note', timestamp: n.updatedAt || n.createdAt || Date.now() });
        });

        window.noteCategorizer.setData(rootItems);
    } else {
        renderSharedFolderRecursive(treeContainer, null, 0);
    }
}

function renderSharedFolderRecursive(container, parentId, level) {
    if (window.folderManager) {
        const folders = window.folderManager.getChildren(parentId);
        folders.forEach(f => {
            const wrapper = document.createElement('div');
            wrapper.className = 'tree-folder-wrapper';
            renderSharedFolder(wrapper, f, level);
            container.appendChild(wrapper);
        });
    }
    if (parentId === null) {
        getNotes().filter(n => !n.isDeleted && !n.folderId).forEach(note => {
            const el = renderTreeRow({ ...note, type: 'note', name: note.title || 'Untitled', level: level }, true);
            el.onclick = (e) => { e.stopPropagation(); if (!e.target.closest('button')) selectNote(note.id); };
            container.appendChild(el);
        });
    }
}

function renderSharedFolder(container, folder, level) {
    const isExpanded = window.folderManager ? window.folderManager.isExpanded(folder.id) : false;
    const row = renderTreeRow({ ...folder, type: 'folder', name: folder.name, expanded: isExpanded, level: level }, true);

    row.onclick = (e) => {
        e.stopPropagation();
        window.toggleFolder(folder.id);
    };

    container.appendChild(row);

    if (isExpanded) {
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'tree-children visible';
        childrenContainer.style.marginLeft = '16px';
        container.appendChild(childrenContainer);

        if (window.folderManager) {
            const subFolders = window.folderManager.getChildren(folder.id);
            subFolders.forEach(sf => renderSharedFolder(childrenContainer, sf, level + 1));
        }

        getNotes().filter(n => n.folderId === folder.id && !n.isDeleted).forEach(note => {
            const el = renderTreeRow({ ...note, type: 'note', name: note.title || 'Untitled', level: level + 1 }, true);
            el.onclick = (e) => { e.stopPropagation(); if (!e.target.closest('button')) selectNote(note.id); };
            if (window.currentNoteId === note.id) el.classList.add('active');
            childrenContainer.appendChild(el);
        });
    }
}

function renderTreeRow(item, isTree) {
    const div = document.createElement('div');
    const isActive = item.type === 'note' && window.currentNoteId === item.id;

    div.className = `tree-row ${item.type} ${isActive ? 'active' : ''}`;
    div.dataset.id = item.id;
    div.dataset.type = item.type;
    div.draggable = true;
    div.style.paddingLeft = '8px';

    // --- Drag Start ---
    div.ondragstart = (e) => {
        window.isDraggingInternal = true;
        const dragData = { type: item.type, id: item.id };
        if (item.type === 'note') {
            dragData.title = item.title || item.name;
            dragData.content = item.content || '';
        }
        e.dataTransfer.setData('application/json', JSON.stringify(dragData));
        e.dataTransfer.effectAllowed = 'all';
        div.classList.add('dragging');
    };

    div.ondragend = () => {
        div.classList.remove('dragging');
    };

    // --- Drop Target ---
    if (item.type === 'folder') {
        div.ondragover = (e) => {
            e.preventDefault();
            e.stopPropagation();
            div.classList.add('drag-over');
        };
        div.ondragleave = (e) => {
            e.stopPropagation();
            div.classList.remove('drag-over');
        };
        div.ondrop = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            div.classList.remove('drag-over');
            try {
                const rawData = e.dataTransfer.getData('application/json');
                if (!rawData) return;
                const data = JSON.parse(rawData);
                if (!data || data.id === item.id) return;

                if (data.type === 'note') {
                    await window.folderManager.moveNoteToFolder(data.id, item.id);
                } else if (data.type === 'folder') {
                    await window.folderManager.moveFolder(data.id, item.id);
                }
                if (window.loadNotes) await window.loadNotes();
                window.isDraggingInternal = false;
            } catch (err) { console.error('Drop failed:', err); }
        };
    }

    let toggleBtn = item.type === 'folder' ? `<div class="tree-toggle ${item.expanded ? 'expanded' : ''}">▸</div>` : '<div class="tree-toggle invisible"></div>';
    let icon = item.type === 'folder' ? '📁' : '📄';

    const trashIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
    const restoreIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>`;
    const editIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;

    const dateStr = (item.type === 'note' && typeof formatShortDate === 'function') ? formatShortDate(item.updatedAt || item.createdAt) : '';

    div.innerHTML = `
        ${toggleBtn}
        <span class="tree-icon">${icon}</span>
        <span class="tree-label">${escapeHtml(item.name || 'Untitled')}</span>
        ${dateStr ? `<span class="tree-date">${dateStr}</span>` : ''}
        <div class="tree-actions" onclick="event.stopPropagation()">
            ${item.type === 'folder' ? `<button class="tree-btn btn-rename" title="Rename">${editIcon}</button>` : ''}
            ${item.isDeleted ? `<button class="tree-btn btn-restore" title="Restore">${restoreIcon}</button>` : ''}
            <button class="tree-btn btn-delete" title="Delete">${trashIcon}</button>
        </div>
    `;

    // --- Button Events ---
    const btnRename = div.querySelector('.btn-rename');
    if (btnRename) btnRename.onclick = (e) => { e.stopPropagation(); if (window.renameFolderUI) window.renameFolderUI(item.id); };

    const btnDel = div.querySelector('.btn-delete');
    if (btnDel) {
        btnDel.onclick = (e) => {
            e.stopPropagation();
            if (item.type === 'folder') {
                if (window.deleteFolderUI) window.deleteFolderUI(item.id);
            } else {
                if (typeof deleteNote === 'function') deleteNote(item.id);
            }
        };
    }

    const btnRes = div.querySelector('.btn-restore');
    if (btnRes) btnRes.onclick = (e) => { e.stopPropagation(); if (typeof restoreNote === 'function') restoreNote(item.id); };

    return div;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
