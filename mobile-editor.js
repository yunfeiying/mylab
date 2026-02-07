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
        if (this.headerTitle) this.headerTitle.value = noteData.title || '';
        if (this.editor) this.editor.innerHTML = noteData.content || '';
        this.isSaved = true;
        if (window.mobileCore) window.mobileCore.navigateTo('editor');
    }

    initNewNote() {
        this.currentNoteId = 'note-' + Date.now();
        if (this.headerTitle) this.headerTitle.value = '';
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

        // Slash button handler
        const slashBtn = document.getElementById('btn-editor-ai-slash');
        if (slashBtn) {
            slashBtn.onclick = () => {
                if (this.editor) {
                    this.editor.focus();
                    // Insert @ai at the end or current position
                    const selection = window.getSelection();
                    if (selection.rangeCount > 0) {
                        const range = selection.getRangeAt(0);
                        range.deleteContents();
                        document.execCommand('insertText', false, '@ai ');
                    } else {
                        this.editor.innerText += '@ai ';
                    }
                }
            };
        }
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
        // Match @ai or /ai to be backwards compatible, but prioritize @
        const match = text.match(/[@/]ai(?:\s+(.*))?\s*$/);
        if (match) {
            e.preventDefault();
            const prompt = (match[1] || "").trim();
            // Remove the command text
            this.editor.innerHTML = this.editor.innerHTML.replace(/[@/]ai(?:\s+.*)?\s*$/, '');
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
            const context = this.editor.innerText.slice(-800);
            const messages = [
                { role: 'system', content: '你是一个擅长逻辑架构与创意激发的笔记助手。请为用户构建结构清晰、有深度的内容框架。直接输出纯文字，不带任何 Markdown 源码符号。' },
                { role: 'user', content: `上下文：${context}\n指令：${prompt}` }
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
        if (!this.currentNoteId) return;
        // Allow saving even if isSaved is true, to force update timestamp/structure if needed
        // But for optimization, we usually return. However, "New Note" starts with isSaved=false.
        if (this.isSaved) return;

        let title = this.headerTitle?.value?.trim();
        const content = this.editor.innerHTML;
        const text = this.editor.innerText.trim();

        // If completely empty, don't save yet unless it's an old note being cleared? 
        // No, we should save empty notes to avoid data loss illusion
        // BUT, if it is a NEW note and empty, maybe skip?
        // Let's save if there is ANY content or title.
        if (!title && !text) {
            console.log('[Editor] Empty note, skipping auto-save');
            return;
        }

        // Auto-extract title
        if (!title && text) {
            const firstLine = text.split('\n')[0].substring(0, 25).trim();
            if (firstLine) {
                title = firstLine;
                if (this.headerTitle) this.headerTitle.value = title;
            }
        }

        const noteData = {
            id: this.currentNoteId,
            title: title || 'Untitled Note',
            content: content,
            type: 'note',
            timestamp: Date.now(), // Keep original creation time? Ideally yes, but here we simplify
            updatedAt: Date.now()
        };

        // Preserve original timestamp if possible (requires fetching old data or storing it in memory)
        // For now, simple update.

        if (window.appStorage) {
            try {
                await window.appStorage.set({ [this.currentNoteId]: noteData });
                this.isSaved = true;
                if (!isSilent) this.showToast('Saved');

                // Update MobileCore Cache
                if (window.mobileCore) {
                    window.mobileCore.cacheDirty = true; // Mark dirty
                    window.mobileCore.renderApp(); // Refresh UI
                }
            } catch (e) {
                console.error('[Editor] Save failed:', e);
                this.showToast('Save Failed');
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.mobileEditor = new MobileEditor();
});
