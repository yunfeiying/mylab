/**
 * notes-events.js
 * Handles event listeners and inputs for the Notes module
 */

function setupEvents() {
    console.log('[Notes] Setting up events...');

    const btnNewNote = document.getElementById('btn-new-note');
    if (btnNewNote) btnNewNote.onclick = createNewNote;

    const btnTrash = document.getElementById('btn-trash-view');
    if (btnTrash) {
        btnTrash.onclick = () => {
            window.isTrashMode = !window.isTrashMode;
            renderNotesList();
            if (window.isTrashMode) selectNote(null);
        };
    }

    const btnNewFolder = document.getElementById('btn-new-folder');
    if (btnNewFolder) {
        btnNewFolder.onclick = async () => {
            const name = await showPrompt("Enter folder name:");
            if (name && name.trim() && window.folderManager) {
                await window.folderManager.createFolder(name.trim(), window.currentFolderId);
                renderNotesList();
            }
        };
    }

    const titleEl = document.getElementById('note-title');
    const bodyEl = document.getElementById('note-body');
    const searchInput = document.getElementById('search-notes');

    if (titleEl) {
        titleEl.oninput = debounce(() => saveCurrentNote(), 800);
    }

    if (bodyEl) {
        bodyEl.oninput = debounce(() => saveCurrentNote(), 1500);
        bodyEl.onblur = () => saveCurrentNote();

        bodyEl.addEventListener('paste', (e) => window.handlePaste ? window.handlePaste(e) : null);
        bodyEl.addEventListener('drop', (e) => window.handleDrop ? window.handleDrop(e) : null);
        bodyEl.addEventListener('dragover', (e) => window.handleDragOver ? window.handleDragOver(e) : null);
        bodyEl.addEventListener('dragstart', (e) => window.handleDragStart ? window.handleDragStart(e) : null);

        if (window.handleAutoList) bodyEl.addEventListener('keydown', window.handleAutoList);

        if (window.SlashMenu) new window.SlashMenu(bodyEl);

        bodyEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                const sel = window.getSelection();
                if (!sel || !sel.rangeCount) return;

                let range = sel.getRangeAt(0);
                let container = range.startContainer;
                let block = container;
                if (block.nodeType === 3) block = block.parentNode;
                while (block && block.parentNode !== bodyEl && block !== bodyEl) {
                    block = block.parentNode;
                }

                if (block === bodyEl || !block) {
                    document.execCommand('formatBlock', false, 'div');
                    block = sel.getRangeAt(0).startContainer;
                    while (block && block.parentNode !== bodyEl && block !== bodyEl) block = block.parentNode;
                }

                const cleanText = block.textContent.trim();
                const isCommand = cleanText.startsWith('/');

                if (isCommand) {
                    e.preventDefault();
                    if (window.performCommandAction) window.performCommandAction(cleanText, block, sel);
                }
            }
        });
    }

    if (searchInput) {
        searchInput.oninput = (e) => {
            renderNotesList(e.target.value);
        };
    }

    // Global cleanup for internal drag state
    window.addEventListener('dragend', () => {
        window.isDraggingInternal = false;
        const listEl = document.getElementById('notes-list');
        if (listEl) {
            listEl.classList.remove('drag-over-list');
            listEl.classList.remove('internal-drag-over');
        }
    });

    // --- Sidebar Drag & Drop Logic ---
    const listEl = document.getElementById('notes-list');
    if (listEl) {
        listEl.ondragover = (e) => {
            e.preventDefault(); // MANDATORY for any drop to work
            if (window.isDraggingInternal) {
                // Internal drag over list (root drop zone)
                listEl.classList.add('internal-drag-over');
            } else {
                // External drag (Highlights from other tabs)
                listEl.classList.add('drag-over-list');
            }
        };

        listEl.ondragleave = () => {
            listEl.classList.remove('drag-over-list');
            listEl.classList.remove('internal-drag-over');
        };

        listEl.ondrop = async (e) => {
            e.preventDefault();
            listEl.classList.remove('drag-over-list');
            listEl.classList.remove('internal-drag-over');

            // 1. Internal Move (to Root)
            if (window.isDraggingInternal) {
                try {
                    const data = JSON.parse(e.dataTransfer.getData('application/json'));
                    if (data.type === 'note') {
                        await window.folderManager.moveNoteToFolder(data.id, null);
                    } else if (data.type === 'folder') {
                        await window.folderManager.moveFolder(data.id, null);
                    }
                    if (window.loadNotes) await window.loadNotes();
                } catch (err) { console.error('Internal move to root failed:', err); }
                window.isDraggingInternal = false;
                return;
            }

            // 2. External Drop (Highlighti Page)
            const highlightiData = e.dataTransfer.getData('application/highlighti-page');
            if (highlightiData) {
                try {
                    const pageData = JSON.parse(highlightiData);
                    if (pageData.type === 'highlighti-page') {
                        await createNoteFromHighlight(pageData);
                    }
                } catch (err) { console.error('[Notes] Drop Error:', err); }
            }
        };
    }
}
