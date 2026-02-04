/**
 * mobile-editor.js - Advanced Editor Logic with OCR (V6.2)
 */

class MobileEditor {
    constructor() {
        this.editor = document.querySelector('.editor-body');
        this.headerTitle = document.querySelector('.editor-header-title');
        this.aiMagicBtn = document.getElementById('btn-ai-magic');
        this.aiQuickInput = document.getElementById('ai-quick-input');
        this.aiQuickSend = document.getElementById('ai-quick-send');
        this.ocrBtn = document.getElementById('btn-ocr-trigger');
        this.ocrInput = document.getElementById('editor-ocr-input');

        if (this.editor) {
            this.setupEditorEvents();
        }

        // Bind AI Magic Button
        if (this.aiMagicBtn) {
            this.aiMagicBtn.onclick = () => this.handleAIToolbarMagic();
        }

        // Bind AI Quick Send
        if (this.aiQuickSend && this.aiQuickInput) {
            this.aiQuickSend.onclick = () => this.handleAIQuickSend();
            this.aiQuickInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.handleAIQuickSend();
            });
        }

        // Bind OCR
        if (this.ocrBtn && this.ocrInput) {
            this.ocrBtn.onclick = () => this.ocrInput.click();
            this.ocrInput.onchange = (e) => this.processOCR(e);
        }
    }

    loadNote(noteId, noteData) {
        if (window.mobileCore) window.mobileCore.navigateTo('editor');

        if (this.headerTitle) this.headerTitle.value = noteData.title || 'Untitled Note';
        if (this.editor) {
            const content = noteData.content || noteData.text || '';
            if (content.includes('<') && content.includes('>')) {
                this.editor.innerHTML = content;
            } else {
                this.editor.innerText = content;
            }
        }
        this.currentNoteId = noteId;
        this.editor.focus();
    }

    initNewNote() {
        this.currentNoteId = null;
        if (this.headerTitle) this.headerTitle.value = '';
        if (this.editor) {
            this.editor.innerHTML = '';
            this.editor.focus();
        }
        if (window.mobileCore) window.mobileCore.navigateTo('editor');
    }

    setupEditorEvents() {
        this.editor.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.handleAutoList(e);
                this.checkSlashCommand(e);
            }
        });

        this.editor.addEventListener('focus', () => {
            if (this.editor.textContent.trim() === 'Start typing...') {
                this.editor.textContent = '';
            }
        });

        // Auto-Save
        let saveTimeout;
        const triggerSave = () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => this.saveNote(true), 2000);
        };
        this.editor.addEventListener('input', triggerSave);
        if (this.headerTitle) this.headerTitle.addEventListener('input', triggerSave);
    }

    handleAutoList(e) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const lineText = range.startContainer.textContent || "";

        // 1. Numbered List (e.g. "1. ")
        const numMatch = lineText.match(/^(\d+)\.\s/);
        if (numMatch) {
            e.preventDefault();
            const nextNum = parseInt(numMatch[1]) + 1;
            document.execCommand('insertHTML', false, `<div>${nextNum}.&nbsp;</div>`);
            return;
        }

        // 2. Bullet List (e.g. "* " or "- ")
        if (lineText.startsWith('* ') || lineText.startsWith('- ')) {
            e.preventDefault();
            const symbol = lineText.startsWith('* ') ? '* ' : '- ';
            document.execCommand('insertHTML', false, `<div>${symbol}&nbsp;</div>`);
            return;
        }
    }

    insertList(command) {
        this.editor.focus();
        document.execCommand(command, false, null);
    }

    toggleTodo() {
        this.editor.focus();
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const todoHtml = `<div class="todo-item" contenteditable="false"><div class="todo-checkbox" onclick="this.parentElement.classList.toggle('checked')"></div><div class="todo-text" contenteditable="true">&nbsp;</div></div>`;

        const div = document.createElement('div');
        div.innerHTML = todoHtml;
        range.insertNode(div);

        // Move focus to the new todo text
        const textNode = div.querySelector('.todo-text');
        const newRange = document.createRange();
        newRange.selectNodeContents(textNode);
        newRange.collapse(false);
        selection.removeAllRanges();
        selection.addRange(newRange);
    }

    async processOCR(e) {
        const file = e.target.files[0];
        if (!file) return;

        const toast = this.showToast('🔍 Analyzing Image...', 0);

        try {
            // Using Tesseract.js directly from window (since added to HTML)
            if (typeof Tesseract === 'undefined') throw new Error('OCR library not loaded.');

            const result = await Tesseract.recognize(file, 'chi_sim+eng', {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        toast.innerText = `🔍 OCR: ${Math.round(m.progress * 100)}%`;
                    }
                }
            });

            const text = result.data.text.trim();
            if (text) {
                this.editor.focus();
                // Append text at the end
                const ocrBlock = document.createElement('div');
                ocrBlock.style.cssText = 'border-left:4px solid #34c759; padding-left:12px; margin:15px 0; color:#555; background:#f9f9f9; padding:8px 12px; border-radius:4px; font-size:16px;';
                ocrBlock.innerText = text;
                this.editor.appendChild(ocrBlock);
                this.showToast('✅ OCR Success', 2000);
            } else {
                this.showToast('⚠️ No text found in image', 3000);
            }
        } catch (err) {
            console.error('OCR Error:', err);
            this.showToast('❌ OCR Failed: ' + err.message, 3000);
        } finally {
            e.target.value = ''; // Reset input
        }
    }

    showToast(msg, duration = 2000) {
        let toast = document.getElementById('editor-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'editor-toast';
            toast.style.cssText = 'position:fixed; bottom:120px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:white; padding:10px 20px; border-radius:24px; font-size:14px; z-index:3000; box-shadow:0 10px 30px rgba(0,0,0,0.3); white-space:nowrap;';
            document.body.appendChild(toast);
        }
        toast.innerText = msg;
        toast.style.display = 'block';
        if (duration > 0) setTimeout(() => toast.style.display = 'none', duration);
        return toast;
    }

    async saveNote(isSilent = false) {
        if (!window.appStorage) return;

        let title = this.headerTitle ? this.headerTitle.value.trim() : 'Untitled Note';
        const content = this.editor.innerHTML;
        const rawText = this.editor.innerText;

        const cleanText = this.clearMarkdownSymbols(rawText);
        if (!title && cleanText) title = cleanText.split('\n')[0].substring(0, 30);

        if (!this.currentNoteId && !title && !cleanText.trim()) return;

        const noteId = this.currentNoteId || `note-${Date.now()}`;
        const noteData = {
            id: noteId,
            title: title || 'Untitled Note',
            content: content,
            text: cleanText,
            date: new Date().toLocaleDateString(),
            timestamp: Date.now(),
            type: 'note'
        };

        await window.appStorage.set({ [noteId]: noteData });
        this.currentNoteId = noteId;

        if (!isSilent) this.showToast('✅ Saved');
        if (window.mobileCore) window.mobileCore.renderApp();
    }

    clearMarkdownSymbols(text) {
        if (!text) return "";
        return text
            .replace(/^#+\s+/gm, '')
            .replace(/^\s*[\*\-]\s+/gm, '')
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/\*([^*]+)\*/g, '$1')
            .replace(/__([^_]+)__/g, '$1')
            .trim();
    }

    async handleAIToolbarMagic() {
        const selection = window.getSelection();
        const selectedText = selection.toString();
        const promptText = prompt('✨ AI Assistant\n(Selected text will be used as context)', 'Summarize this');
        if (promptText) {
            const finalPrompt = selectedText ? `Context: "${selectedText}"\nTask: ${promptText}` : promptText;
            await this.triggerAI(finalPrompt);
        }
    }

    async handleAIQuickSend() {
        const prompt = this.aiQuickInput.value.trim();
        if (!prompt) return;
        this.aiQuickInput.value = '';
        await this.triggerAI(prompt);
    }

    async triggerAI(prompt) {
        this.editor.focus();
        const hr = document.createElement('hr');
        hr.style.cssText = 'border:none; border-top:1px solid #eee; margin:20px 0;';
        this.editor.appendChild(hr);
        await this.streamAIContent(prompt);
    }

    async checkSlashCommand(e) {
        const text = this.editor.innerText;
        const match = text.match(/\/ai\s+(.*)$/);
        if (match) {
            e.preventDefault();
            const prompt = match[1];
            this.editor.innerHTML = this.editor.innerHTML.replace(/\/ai\s+.*$/, '');
            await this.streamAIContent(prompt);
        }
    }

    async streamAIContent(prompt) {
        if (!window.aiCore) {
            alert('Please set AI API Key in Settings first.');
            return;
        }

        const responseSpan = document.createElement('div');
        responseSpan.className = 'ai-response';
        responseSpan.style.color = '#007aff';
        responseSpan.style.whiteSpace = 'pre-wrap';
        this.editor.appendChild(responseSpan);

        try {
            const context = this.editor.innerText.substring(Math.max(0, this.editor.innerText.length - 2000));
            const messages = [
                { role: 'system', content: 'You are an intelligent note-taking assistant. Provide clear, concise help.' },
                { role: 'user', content: `Context:\n${context}\n\nTask: ${prompt}` }
            ];

            const stream = window.aiCore.streamChat(messages);
            for await (const chunk of stream) {
                if (chunk.type === 'token') {
                    responseSpan.innerText = chunk.fullText;
                    this.editor.scrollTop = this.editor.scrollHeight;
                }
            }
            responseSpan.style.color = '#333';
        } catch (err) {
            responseSpan.innerText = `[AI Error: ${err.message}]`;
        }
    }

    showEditorMenu(event) {
        const overlay = document.getElementById('action-sheet-overlay');
        if (overlay) overlay.classList.remove('hidden');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.mobileEditor = new MobileEditor();
});
