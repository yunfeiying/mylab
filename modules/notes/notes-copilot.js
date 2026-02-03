/**
 * notes-copilot.js
 * Implements "Passive Retrieval" for writing.
 * Watches the editor and suggests relevant notes, highlights, and memories in the sidebar.
 */

class NotesCopilot {
    constructor() {
        this.isActive = false;
        this.debounceTimer = null;
        this.lastTopic = "";
        this.suggestions = [];
        this.init();
    }

    init() {
        console.log('[NotesCopilot] Initializing...');
        this.setupTabs();
        this.setupEditorObserver();
    }

    setupTabs() {
        const tabNotes = document.getElementById('tab-notes');
        const tabCopilot = document.getElementById('tab-copilot');
        const notesListHeader = document.getElementById('notes-list-header');
        const notesList = document.getElementById('notes-list');
        const copilotSuggestions = document.getElementById('copilot-suggestions');

        if (!tabNotes || !tabCopilot) return;

        tabNotes.onclick = () => {
            this.isActive = false;
            tabNotes.classList.add('active');
            tabCopilot.classList.remove('active');
            notesListHeader.style.display = 'block';
            notesList.style.display = 'block';
            copilotSuggestions.style.display = 'none';
        };

        tabCopilot.onclick = () => {
            this.isActive = true;
            tabNotes.classList.remove('active');
            tabCopilot.classList.add('active');
            notesListHeader.style.display = 'none';
            notesList.style.display = 'none';
            copilotSuggestions.style.display = 'block';
            this.triggerSearch(true); // Immediate update when switching to tab
        };
    }

    setupEditorObserver() {
        const editor = document.getElementById('note-body');
        if (!editor) return;

        editor.addEventListener('input', () => {
            // Only trigger if we are actively writing and enough text exists
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => this.triggerSearch(), 2500);
        });
    }

    async triggerSearch(force = false) {
        const editor = document.getElementById('note-body');
        if (!editor) return;

        const text = editor.innerText.trim();
        if (text.length < 20) return;

        // Extract last few paragraphs for context
        const lines = text.split('\n').filter(l => l.trim().length > 5);
        const contextText = lines.slice(-3).join(' '); // Last 3 lines

        if (!force && contextText === this.lastTopic) return;
        this.lastTopic = contextText;

        console.log('[NotesCopilot] Searching for context:', contextText.substring(0, 50));

        try {
            // 1. Memory Search (Scheme B)
            const memoryContext = window.memoryAgent ? await window.memoryAgent.retrieveContext(contextText) : "";

            // 2. Library/Highlights Search
            const libraryDocs = typeof fetchLibraryData === 'function' ? await fetchLibraryData(contextText) : [];

            // 3. Current Notes Search (Title-based)
            const keywords = contextText.toLowerCase().match(/[\w\u4e00-\u9fa5]{2,}/g) || [];
            const relatedNotes = (window.notes || []).filter(n => {
                if (n.id === window.currentNoteId || n.isDeleted) return false;
                const title = (n.title || "").toLowerCase();
                return keywords.some(kw => title.includes(kw));
            }).slice(0, 5);

            this.renderSuggestions({
                memories: memoryContext,
                highlights: libraryDocs,
                notes: relatedNotes
            });

        } catch (err) {
            console.error('[NotesCopilot] Search error:', err);
        }
    }

    renderSuggestions(data) {
        const container = document.getElementById('copilot-suggestions');
        if (!container) return;

        container.innerHTML = '';
        let count = 0;

        // A. Memories
        if (data.memories) {
            const memoryLines = data.memories.split('\n').slice(0, 5);
            memoryLines.forEach(line => {
                const card = this.createCard('Memory', '🧠 Learned Insight', line);
                container.appendChild(card);
                count++;
            });
        }

        // B. Notes
        data.notes.forEach(note => {
            const card = this.createCard('Note', note.title || 'Untitled', (note.content || "").substring(0, 100));
            card.onclick = () => {
                if (window.selectNote) window.selectNote(note.id);
            };
            container.appendChild(card);
            count++;
        });

        // C. Highlights
        data.highlights.forEach(h => {
            const card = this.createCard('Highlight', h.title, h.content.substring(0, 100));
            card.onclick = () => this.showPreview(h.title, h.content);
            container.appendChild(card);
            count++;
        });

        if (count === 0) {
            container.innerHTML = '<div class="copilot-empty">Nothing related found yet. Try writing more.</div>';
        }
    }

    createCard(type, title, body) {
        const div = document.createElement('div');
        div.className = 'suggestion-card';
        div.innerHTML = `
            <div class="suggestion-type">${type}</div>
            <div class="suggestion-title">${title}</div>
            <div class="suggestion-body">${body}</div>
        `;
        return div;
    }

    showPreview(title, content) {
        // Simple modal preview for non-editable materials
        const overlay = document.createElement('div');
        overlay.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.4); z-index:9000; display:flex; align-items:center; justify-content:center;";

        const modal = document.createElement('div');
        modal.style = "background:white; padding:30px; border-radius:12px; max-width:600px; width:90%; max-height:80vh; overflow-y:auto; box-shadow:0 10px 30px rgba(0,0,0,0.2);";

        modal.innerHTML = `
            <h2 style="margin-top:0;">${title}</h2>
            <div style="font-size:14px; line-height:1.6; color:#333; margin-bottom:20px;">${content}</div>
            <button id="close-preview" style="background:#1976d2; color:white; border:none; padding:8px 20px; border-radius:6px; cursor:pointer;">Close</button>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        modal.querySelector('#close-preview').onclick = () => document.body.removeChild(overlay);
        overlay.onclick = (e) => { if (e.target === overlay) document.body.removeChild(overlay); };
    }
}

// Initialize on Load
window.addEventListener('DOMContentLoaded', () => {
    window.notesCopilot = new NotesCopilot();
});
