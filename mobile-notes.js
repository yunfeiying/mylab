/**
 * mobile-notes.js
 * Mobile-specific note management.
 */

class MobileNotes {
    constructor() {
        this.listEl = document.getElementById('notes-list');
        this.editorOverlay = document.getElementById('note-editor-overlay');
        this.currentNoteId = null;

        this.init();
    }

    async init() {
        this.setupEvents();
        await this.renderNotesList();
    }

    setupEvents() {
        document.getElementById('btn-new-note').onclick = () => this.openEditor();
        document.getElementById('btn-editor-back').onclick = () => this.closeEditor();
        document.getElementById('btn-editor-save').onclick = () => this.saveNote();

        const contentDiv = document.getElementById('note-editor-content');
        if (contentDiv) {
            contentDiv.addEventListener('keydown', (e) => this.handleEditorKeydown(e));
        }
    }

    handleEditorKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            const sel = window.getSelection();
            if (!sel.rangeCount) return;

            const range = sel.getRangeAt(0);
            let node = range.startContainer;
            if (node.nodeType === 3) node = node.parentNode;

            // Get current line text
            const lineText = node.innerText.trim();
            if (lineText.startsWith('/ai')) {
                e.preventDefault();
                this.performAIAction(lineText.substring(3).trim(), node);
            }
        }
    }

    async performAIAction(query, block) {
        const uniqueId = 'ai-m-' + Date.now();

        // UI: Replace /ai line with a styled indicator
        block.innerHTML = `<span style="color:var(--ios-blue); font-weight:700;">✨ ${query}</span>`;

        const aiBlock = document.createElement('div');
        aiBlock.className = 'ai-block-mobile';
        aiBlock.innerHTML = `<span id="${uniqueId}" class="ai-m-loading">数字孪生正在思考...</span>`;
        block.parentNode.insertBefore(aiBlock, block.nextSibling);

        try {
            // 1. Sync Logic with AI Chat Component
            const memoryContext = window.memoryAgent ? await window.memoryAgent.retrieveContext(query) : "";

            const systemPrompt = `
你是一个拥有个性的数字孪生助手。
性格：智慧、幽默、高效。你现在正在协助用户在笔记编辑器中直接创作。
能力：你可以自主决定如何处理用户的信息。

指令协议：
- To create a table: [[ACTION:INSERT_TABLE|{"headers":["H1","H2"],"rows":[["R1C1","R1C2"]]}]]
- To add tasks: [[ACTION:ADD_TODO|{"tasks":["Task 1","Task 2"]}]]

上下文记忆：
${memoryContext}
`;

            const messages = [
                { role: "system", content: systemPrompt },
                { role: "user", content: query }
            ];

            let fullRes = "";
            const stream = window.aiCore.streamChat(messages);
            const el = document.getElementById(uniqueId);

            for await (const chunk of stream) {
                if (chunk.type === 'token') {
                    fullRes = chunk.fullText;
                    if (el) {
                        // Filter out action tags from visible content
                        const visibleText = fullRes.replace(/\[\[ACTION:.*?\]\]/g, '').trim();
                        el.innerHTML = this.simpleMarkdown(visibleText);
                    }
                }
            }

            // 2. Action Dispatching (Compatibility with notes-table/dispatcher)
            this.handleInlineActions(fullRes, aiBlock);

            // 3. Memory Update
            if (window.memoryAgent) {
                window.memoryAgent.processInteraction(query, fullRes);
            }

            if (el) el.removeAttribute('id');
            this.saveNote(false);
        } catch (err) {
            const el = document.getElementById(uniqueId);
            if (el) el.innerText = `[Error]: ${err.message}`;
        }
    }

    handleInlineActions(text, container) {
        // Handle Table Extraction (Simplified for Mobile)
        const tableMatch = text.match(/\[\[ACTION:INSERT_TABLE\|(.*?)]]/);
        if (tableMatch) {
            try {
                const data = JSON.parse(tableMatch[1]);
                let tableHtml = `<table style="width:100%; border-collapse:collapse; margin-top:10px; border:1px solid #ddd;">`;
                if (data.headers) {
                    tableHtml += `<tr style="background:#f2f2f7;">` + data.headers.map(h => `<th style="border:1px solid #ddd; padding:8px; text-align:left; font-size:14px;">${h}</th>`).join('') + `</tr>`;
                }
                data.rows.forEach(row => {
                    tableHtml += `<tr>` + row.map(c => `<td style="border:1px solid #ddd; padding:8px; font-size:14px;">${c}</td>`).join('') + `</tr>`;
                });
                tableHtml += `</table>`;
                container.innerHTML += tableHtml;
            } catch (e) { console.error('Table parse failed', e); }
        }

        // Handle TODOs
        const todoMatch = text.match(/\[\[ACTION:ADD_TODO\|(.*?)]]/);
        if (todoMatch) {
            try {
                const data = JSON.parse(todoMatch[1]);
                let todoHtml = `<div style="margin-top:10px;">` + data.tasks.map(t => `<div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;"><input type="checkbox"> <span>${t}</span></div>`).join('') + `</div>`;
                container.innerHTML += todoHtml;
            } catch (e) { console.error('TODO parse failed', e); }
        }
    }

    simpleMarkdown(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
            .replace(/\n/g, '<br>');
    }

    async renderNotesList() {
        const data = await window.appStorage.get('user_notes');
        let notes = data.user_notes || [];

        // Mock data if empty to show rich UI
        if (notes.length === 0) {
            notes = [
                { id: 'm1', title: 'Antigravity 界面规划与审美指令 (S...', content: 'Studio 1 Plan...', updated: Date.now() - 86400000 },
                { id: 'm2', title: '第五阶段：避免代码堆砌 (保持架构...', content: 'Complexity Control...', updated: Date.now() - 400000000 },
                { id: 'm3', title: '乔诺薪酬测算核心逻辑', content: 'Calculation logical...', updated: Date.now() - 800000000 }
            ];
        }

        const list7d = document.getElementById('notes-list-7d');
        const listAll = document.getElementById('notes-list-all');
        if (!list7d || !listAll) return;

        list7d.innerHTML = '';
        listAll.innerHTML = '';

        notes.sort((a, b) => b.updated - a.updated).forEach(note => {
            const div = document.createElement('div');
            div.className = 'note-item-v2';
            div.innerHTML = `
                <span class="title">${note.title || 'Untitled'}</span>
                <span class="meta">${new Date(note.updated).toLocaleDateString()}  ${note.content.substring(0, 30)}...</span>
            `;
            div.onclick = () => this.openEditor(note);

            const isRecent = (Date.now() - note.updated) < (7 * 24 * 60 * 60 * 1000);
            if (isRecent) list7d.appendChild(div);
            else listAll.appendChild(div);
        });

        // Update counts
        const header = document.querySelector('#notes-view .mobile-header h1');
        if (header) header.innerText = `备忘录 (${notes.length}个备忘录)`;
    }

    openEditor(note = null) {
        this.editorOverlay.classList.remove('hidden');
        const titleInput = document.getElementById('note-editor-title');
        const contentDiv = document.getElementById('note-editor-content');

        if (note) {
            this.currentNoteId = note.id;
            titleInput.value = note.title;
            contentDiv.innerHTML = note.content;
        } else {
            this.currentNoteId = 'note_' + Date.now();
            titleInput.value = '';
            contentDiv.innerHTML = '';
        }
    }

    closeEditor() {
        this.editorOverlay.classList.add('hidden');
        this.currentNoteId = null;
    }

    async saveNote(shouldClose = true) {
        const title = document.getElementById('note-editor-title').value;
        const content = document.getElementById('note-editor-content').innerHTML;

        const data = await window.appStorage.get('user_notes');
        let notes = data.user_notes || [];

        const index = notes.findIndex(n => n.id === this.currentNoteId);
        if (index > -1) {
            notes[index] = { id: this.currentNoteId, title, content, updated: Date.now() };
        } else {
            notes.unshift({ id: this.currentNoteId, title, content, updated: Date.now() });
        }

        await window.appStorage.set({ 'user_notes': notes });
        this.renderNotesList();
        if (shouldClose) this.closeEditor();
        if (shouldClose && typeof window.showToast === 'function') window.showToast('Note Saved');
    }

    // Agentic API
    async createNote(title, content) {
        console.log('[MobileNotes] AI Creating Note:', title);
        const data = await window.appStorage.get('user_notes');
        let notes = data.user_notes || [];
        notes.unshift({ id: 'note_' + Date.now(), title, content, updated: Date.now() });
        await window.appStorage.set({ 'user_notes': notes });
        this.renderNotesList();
    }

    async appendNote(content) {
        console.log('[MobileNotes] AI Appending Note');
        const data = await window.appStorage.get('user_notes');
        let notes = data.user_notes || [];
        if (notes.length > 0) {
            notes[0].content += `<br><br><b>AI Update:</b><br>${content}`;
            await window.appStorage.set({ 'user_notes': notes });
            this.renderNotesList();
        }
    }
}

window.mobileNotes = new MobileNotes();
