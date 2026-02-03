/**
 * Folder Manager Module - Simplified & Robust
 * VS Code-style hierarchical folder structure for notes
 * Updated to use IndexedDB for storage.
 * 
 * @module options/modules/folder-manager
 * @version 2.1.0
 */

class FolderManager {
    constructor() {
        this.folders = [];
        this.expandedIds = new Set();
        this._loaded = false;
    }

    // ==================== Core CRUD ====================

    async load() {
        if (this._loaded) return this.folders;

        console.log('[FolderManager] Loading from IndexedDB...');

        // 1. Try IndexedDB
        let folders = await window.idb.get('note_folders');
        let expanded = await window.idb.get('note_folders_expanded');

        // 2. Migration from chrome.storage.local
        if (folders === undefined) {
            console.log('[FolderManager] IndexedDB empty, checking chrome.storage.local...');
            const res = await chrome.storage.local.get(['note_folders', 'note_folders_expanded', 'folders', 'folderState']);
            folders = res.note_folders || res.folders || [];

            if (res.note_folders_expanded) {
                expanded = res.note_folders_expanded;
            } else if (res.folderState) {
                expanded = Object.keys(res.folderState).filter(k => res.folderState[k] !== false);
            } else {
                expanded = [];
            }

            // Save migrated data to IDB
            await window.idb.set('note_folders', folders);
            await window.idb.set('note_folders_expanded', expanded);
        }

        this.folders = folders || [];
        this.expandedIds = new Set(expanded || []);

        // Normalize: ensure parentId is null (not undefined)
        this.folders.forEach(f => {
            if (f.parentId === undefined) f.parentId = null;
        });

        this._loaded = true;
        console.log('[FolderManager] Loaded', this.folders.length, 'folders');
        return this.folders;
    }

    async save() {
        await window.idb.set('note_folders', this.folders);
        await window.idb.set('note_folders_expanded', Array.from(this.expandedIds));
    }

    async createFolder(name, parentId = null) {
        const folder = {
            id: 'folder_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            name: (name || '').trim() || 'New Folder',
            parentId: parentId ?? null,
            createdAt: Date.now()
        };

        this.folders.push(folder);
        this.expandedIds.add(folder.id);
        await this.save();

        console.log('[FolderManager] Created folder:', folder.name);
        return folder;
    }

    async renameFolder(id, newName) {
        const folder = this.folders.find(f => f.id === id);
        if (folder) {
            folder.name = (newName || '').trim() || 'Untitled';
            await this.save();
        }
        return folder;
    }

    async deleteFolder(id) {
        const folder = this.folders.find(f => f.id === id);
        if (!folder) return;

        const targetParent = folder.parentId;
        this.folders.forEach(f => {
            if (f.parentId === id) f.parentId = targetParent;
        });

        this.folders = this.folders.filter(f => f.id !== id);
        this.expandedIds.delete(id);
        await this.save();

        return targetParent;
    }

    async moveFolder(id, newParentId) {
        const folder = this.folders.find(f => f.id === id);
        if (!folder) return false;

        if (newParentId === id) return false;
        if (this._isDescendant(newParentId, id)) return false;

        folder.parentId = newParentId ?? null;
        await this.save();
        return true;
    }

    async moveNoteToFolder(noteId, folderId) {
        // Updated to use window.notes and common saveNotes
        const note = (window.notes || []).find(n => n.id === noteId);
        if (!note) return false;

        note.folderId = folderId ?? null;
        if (typeof window.saveNotes === 'function') {
            await window.saveNotes();
        } else {
            // Fallback for direct IDB access if saveNotes orchestrator isn't ready
            const notes = await window.idb.get('user_notes') || [];
            const n = notes.find(it => it.id === noteId);
            if (n) {
                n.folderId = folderId ?? null;
                await window.idb.set('user_notes', notes);
            }
        }
        console.log('[FolderManager] Moved note', noteId, 'to folder', folderId);
        return true;
    }

    // ==================== Query ====================

    getFolder(id) {
        return this.folders.find(f => f.id === id);
    }

    getChildren(parentId = null) {
        const normalizedParent = parentId ?? null;
        return this.folders.filter(f => (f.parentId ?? null) === normalizedParent);
    }

    getTree(parentId = null) {
        return this.getChildren(parentId).map(folder => ({
            ...folder,
            children: this.getTree(folder.id)
        }));
    }

    isExpanded(id) {
        return this.expandedIds.has(id);
    }

    async toggleExpanded(id) {
        if (this.expandedIds.has(id)) {
            this.expandedIds.delete(id);
        } else {
            this.expandedIds.add(id);
        }
        await this.save();
        return this.expandedIds.has(id);
    }

    _isDescendant(childId, ancestorId) {
        let current = this.getFolder(childId);
        while (current) {
            if (current.parentId === ancestorId) return true;
            current = current.parentId ? this.getFolder(current.parentId) : null;
        }
        return false;
    }

    async getNoteCounts() {
        const notes = (window.notes && window.notes.length > 0) ? window.notes : (await window.idb.get('user_notes') || []);
        const counts = {};
        notes.forEach(note => {
            const fId = note.folderId || 'root';
            counts[fId] = (counts[fId] || 0) + 1;
        });
        return counts;
    }
}

const folderManager = new FolderManager();

if (typeof window !== 'undefined') {
    window.FolderManager = FolderManager;
    window.folderManager = folderManager;
}
