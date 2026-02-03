/**
 * mobile-editor.js - Lightweight Editor Logic & Slash Commands
 */

class MobileEditor {
    constructor() {
        this.editor = document.querySelector('.editor-body');
        this.aiBtn = document.getElementById('btn-ai-toolbar');

        if (this.editor) {
            this.setupEditorEvents();
        }

        // Bind AI Toolbar Button
        if (this.aiBtn) {
            this.aiBtn.onclick = () => this.handleAIToolbarClick();
        }
    }

    setupEditorEvents() {
        // Listen for Slash Commands
        this.editor.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.checkSlashCommand(e);
            }
        });

        // Placeholder management
        this.editor.addEventListener('focus', () => {
            if (this.editor.textContent.trim() === 'Start typing...') {
                this.editor.textContent = '';
            }
        });
    }

    async handleAIToolbarClick() {
        const selection = window.getSelection();
        const selectedText = selection.toString();

        let promptText;
        let contextPrefix = "";

        if (selectedText && selectedText.trim().length > 0) {
            // User has selected text -> Contextual Action
            promptText = prompt('✨ AI Command for selection:', 'Summarize this');
            if (promptText) {
                contextPrefix = `Content: "${selectedText}"\n\nTask: `;
            }
        } else {
            // No selection -> Generation
            promptText = prompt('✨ AI Prompt:', 'Write a paragraph about...');
        }

        if (promptText) {
            await this.triggerAI(contextPrefix + promptText);
        }
    }

    async checkSlashCommand(e) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const node = range.startContainer;

        const textStr = node.nodeValue || node.textContent;
        // Check for "/ai <prompt>"
        const match = textStr.match(/\/ai\s+(.*)/);

        if (match) {
            e.preventDefault(); // Stop newline
            const prompt = match[1];

            // Remove the command text
            if (node.nodeType === Node.TEXT_NODE) {
                node.nodeValue = textStr.replace(/\/ai\s+.*$/, '');
            } else {
                this.editor.innerText = this.editor.innerText.replace(/\/ai\s+.*$/, '');
            }

            await this.streamAIContent(prompt);
        }
    }

    async triggerAI(prompt) {
        // Ensure we focus back to editor for insertion
        this.editor.focus();

        // Insert a newline before generating if we are generating new text
        this.insertNewLine();
        await this.streamAIContent(prompt);
    }

    insertNewLine() {
        const div = document.createElement('div');
        div.innerHTML = '<br>';
        this.editor.appendChild(div);

        // Move cursor to new line
        const range = document.createRange();
        range.selectNodeContents(div);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }

    async streamAIContent(prompt) {
        if (!window.aiCore) {
            alert('Settings -> API Key required.');
            return;
        }

        // Create wrapper
        const responseSpan = document.createElement('span');
        responseSpan.className = 'ai-generating';
        responseSpan.style.color = '#007aff';

        // Insert at cursor
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            selection.getRangeAt(0).insertNode(responseSpan);
        } else {
            this.editor.appendChild(responseSpan);
        }

        // Get context (up to 1000 chars)
        const context = this.editor.innerText.substring(0, 1000);

        try {
            const messages = [
                { role: 'system', content: 'You are a helpful writing assistant.' },
                { role: 'user', content: `Context Overview: ${context}\n\nTask: ${prompt}` }
            ];

            const stream = window.aiCore.streamChat(messages);

            let fullText = '';
            for await (const chunk of stream) {
                if (chunk.type === 'token') {
                    fullText = chunk.fullText;
                    responseSpan.innerText = fullText;

                    // Auto-scroll
                    const editorContainer = document.querySelector('.editor-content');
                    if (editorContainer) editorContainer.scrollTop = editorContainer.scrollHeight;
                }
            }

            // Finalize
            responseSpan.classList.remove('ai-generating');
            responseSpan.style.color = '';

            // Add a trailing newline for user to continue typing
            const br = document.createElement('br');
            responseSpan.after(br);

            // Move cursor after
            const range = document.createRange();
            range.setStartAfter(br);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);

        } catch (err) {
            responseSpan.innerText = `[Error: ${err.message}]`;
            responseSpan.style.color = 'red';
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.mobileEditor = new MobileEditor();
});
