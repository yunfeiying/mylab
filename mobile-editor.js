/**
 * mobile-editor.js - Plain Text Optimized & Auto-Save (V7.0)
 */

class MobileEditor {
    constructor() {
        this.editor = document.querySelector('.editor-body');
        this.headerTitle = document.querySelector('.editor-header-title');
        this.currentNoteId = null;
        this.isSaved = true;
        this.autoSaveTimer = null;
        this.setupEditorEvents();
    }

    loadNote(noteId, noteData) {
        this.currentNoteId = noteId;
        if (this.headerTitle) this.headerTitle.textContent = noteData.title || 'Untitled Note';
        if (this.editor) this.editor.innerHTML = noteData.content || '';
        this.isSaved = true;
        if (window.mobileCore) window.mobileCore.navigateTo('editor');
    }

    initNewNote() {
        this.currentNoteId = Date.now().toString();
        if (this.headerTitle) this.headerTitle.textContent = 'New Note';
        if (this.editor) {
            this.editor.innerHTML = '';
            this.editor.focus();
        }
        this.isSaved = false;
        if (window.mobileCore) window.mobileCore.navigateTo('editor');
    }

    setupEditorEvents() {
        if (!this.editor) return;

        // Auto-save on input
        this.editor.oninput = () => {
            if (this.currentNoteId) {
                this.isSaved = false;
                this.triggerAutoSave();
            }
        };

        this.editor.onkeydown = (e) => {
            if (e.key === 'Enter') {
                if (this.checkSlashCommand(e)) return;
                this.handleAutoList(e);
            }
        };
    }

    triggerAutoSave() {
        if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
        this.autoSaveTimer = setTimeout(() => {
            this.saveNote(true);
        }, 1500); // Auto-save after 1.5s of no typing
    }

    handleAutoList(e) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        const line = range.startContainer.textContent || '';
        if (line.match(/^\d+\.\s/)) {
            const num = parseInt(line.match(/^(\d+)\./)[1]);
            document.execCommand('insertHTML', false, `<br>${num + 1}.&nbsp;`);
            e.preventDefault();
        } else if (line.match(/^[\*\-]\s/)) {
            document.execCommand('insertHTML', false, '<br>•&nbsp;');
            e.preventDefault();
        }
    }

    checkSlashCommand(e) {
        const text = this.editor.innerText;
        const match = text.match(/\/ai(?:\s+(.*))?\s*$/);
        if (match) {
            e.preventDefault();
            const prompt = (match[1] || "").trim();
            this.editor.innerHTML = this.editor.innerHTML.replace(/\/ai(?:\s+.*)?\s*$/, '');
            this.streamAIContent(prompt || "整理内容并排版");
            return true;
        }
        return false;
    }

    // 纯黑白 Markdown 转换
    formatMarkdown(text) {
        return text
            .replace(/### (.*)/g, '<div style="margin:8px 0; font-weight:bold; font-size:17px;">$1</div>')
            .replace(/## (.*)/g, '<div style="margin:10px 0; font-weight:bold; font-size:18px;">$1</div>')
            .replace(/# (.*)/g, '<div style="margin:12px 0; font-weight:bold; font-size:20px;">$1</div>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/^- (.*)/gm, '<div style="margin-left:4px;">• $1</div>')
            .replace(/^\d+\. (.*)/gm, '<div style="margin-left:4px;">$1</div>')
            .replace(/\n/g, '<br>');
    }

    async streamAIContent(prompt) {
        if (!window.aiCore || !window.aiCore.config.apiKey) {
            this.showToast('⚠️ 未设置 API Key', 3000);
            return;
        }

        const responseDiv = document.createElement('div');
        responseDiv.className = 'ai-response';
        responseDiv.style.cssText = 'color: #000; padding: 4px 0; margin: 8px 0; font-size: 16px; line-height: 1.6;';
        responseDiv.innerHTML = '<span class="typing-indicator">●●●</span>';
        this.editor.appendChild(responseDiv);
        this.editor.scrollTop = this.editor.scrollHeight;

        try {
            const context = this.editor.innerText.slice(-1000);
            const messages = [
                { role: 'system', content: '你是笔记助手。请直接输出纯文本正文，使用分段和列表。不要输出任何```符号或其他Markdown源码符号。' },
                { role: 'user', content: `上下文：${context}\n\n指令：${prompt}` }
            ];

            const stream = window.aiCore.streamChat(messages);
            let fullText = '';
            let hasToken = false;

            for await (const chunk of stream) {
                if (chunk.type === 'token') {
                    if (!hasToken) {
                        hasToken = true;
                        responseDiv.innerHTML = '';
                    }
                    fullText = chunk.fullText;
                    responseDiv.innerHTML = this.formatMarkdown(fullText);
                    this.editor.scrollTop = this.editor.scrollHeight;
                }
            }
            // Trigger auto-save after AI finishes
            this.isSaved = false;
            this.saveNote(true);
        } catch (err) {
            responseDiv.innerHTML = `<div style="color:red; font-size:12px;">❌ 错误: ${err.message}</div>`;
        }
    }

    showToast(msg, duration = 2000) {
        let toast = document.getElementById('editor-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'editor-toast';
            toast.style.cssText = 'position:fixed; bottom:100px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:white; padding:8px 16px; border-radius:20px; z-index:5000; font-size:14px; transition: opacity 0.3s;';
            document.body.appendChild(toast);
        }
        toast.innerText = msg;
        toast.style.display = 'block';
        toast.style.opacity = '1';
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => { toast.style.display = 'none'; }, 300);
        }, duration);
    }

    async saveNote(isSilent = false) {
        if (!this.currentNoteId || this.isSaved) return;

        const noteData = {
            id: this.currentNoteId,
            title: this.headerTitle?.textContent || 'Untitled',
            content: this.editor.innerHTML,
            timestamp: Date.now()
        };

        if (window.appStorage) {
            try {
                // Using standard .set() method from storage-bridge.js
                await window.appStorage.set({ [this.currentNoteId]: noteData });
                this.isSaved = true;
                if (!isSilent) this.showToast('Saved');

                // If we have mobileCore, refresh the home list
                if (window.mobileCore) window.mobileCore.renderApp();
            } catch (e) {
                console.error('[Editor] Save failed:', e);
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.mobileEditor = new MobileEditor();
});
