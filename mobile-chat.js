/**
 * mobile-chat.js - Advanced AI Chat Controller with OCR (V6.2)
 */

class MobileChat {
    constructor() {
        this.input = document.getElementById('chat-input');
        this.sendBtn = document.getElementById('btn-chat-send');
        this.attachBtn = document.getElementById('btn-chat-attach');
        this.cameraBtn = document.getElementById('btn-chat-camera');
        this.fileInput = document.getElementById('chat-file-input');
        this.cameraInput = document.getElementById('chat-camera-input');
        this.previewContainer = document.getElementById('attachment-preview-container');
        this.messagesContainer = document.getElementById('messages-container');
        this.titleEl = document.getElementById('chat-title');

        this.attachments = [];

        this.setupEvents();
    }

    setupEvents() {
        if (this.sendBtn) this.sendBtn.onclick = () => this.handleSend();

        if (this.input) {
            this.input.onkeydown = (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleSend();
                }
            };
        }

        if (this.attachBtn && this.fileInput) {
            this.attachBtn.onclick = () => this.fileInput.click();
            this.fileInput.onchange = (e) => this.handleFileSelection(e);
        }

        if (this.cameraBtn && this.cameraInput) {
            this.cameraBtn.onclick = () => this.cameraInput.click();
            this.cameraInput.onchange = (e) => this.handleFileSelection(e);
        }
    }

    handleFileSelection(e) {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            const id = Date.now() + Math.random();
            const attachment = { id, file, type: file.type };

            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (prev) => {
                    attachment.preview = prev.target.result;
                    this.attachments.push(attachment);
                    this.renderPreviews();
                };
                reader.readAsDataURL(file);
            } else {
                this.attachments.push(attachment);
                this.renderPreviews();
            }
        });
        e.target.value = '';
    }

    renderPreviews() {
        if (this.attachments.length > 0) {
            this.previewContainer.classList.remove('hidden');
        } else {
            this.previewContainer.classList.add('hidden');
        }

        this.previewContainer.innerHTML = '';
        this.attachments.forEach(att => {
            const div = document.createElement('div');
            div.className = 'attachment-preview';

            if (att.preview) {
                div.innerHTML = `
                    <img src="${att.preview}">
                    <div class="ocr-badge" style="position:absolute; bottom:2px; left:2px; background:rgba(52,199,89,0.9); color:white; font-size:8px; padding:1px 4px; border-radius:4px; font-weight:700;">OCR</div>
                    <div class="attachment-remove-btn">×</div>
                `;
                // Trigger OCR on click of the badge area or just provide a button
                div.onclick = (e) => {
                    if (e.target.classList.contains('ocr-badge')) {
                        this.processAttachmentOCR(att);
                    }
                };
            } else {
                div.innerHTML = `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#eee; font-size:10px; text-align:center; padding:4px;">${att.file.name.substring(0, 10)}</div><div class="attachment-remove-btn">×</div>`;
            }

            div.querySelector('.attachment-remove-btn').onclick = (e) => {
                e.stopPropagation();
                this.attachments = this.attachments.filter(a => a.id !== att.id);
                this.renderPreviews();
            };

            this.previewContainer.appendChild(div);
        });
    }

    async processAttachmentOCR(att) {
        const toast = this.showToast('🔍 Recognizing...', 0);
        try {
            if (typeof Tesseract === 'undefined') throw new Error('OCR Lib error');
            const result = await Tesseract.recognize(att.file, 'chi_sim+eng');
            const text = result.data.text.trim();
            if (text) {
                this.input.value += (this.input.value ? '\n' : '') + text;
                this.showToast('✅ Text extracted', 2000);
            } else {
                this.showToast('⚠️ No text found', 2000);
            }
        } catch (e) {
            this.showToast('❌ OCR Failed', 2000);
        }
    }

    showToast(msg, duration = 2000) {
        let toast = document.getElementById('chat-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'chat-toast';
            toast.style.cssText = 'position:fixed; top:120px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:white; padding:8px 16px; border-radius:20px; font-size:12px; z-index:4000;';
            document.body.appendChild(toast);
        }
        toast.innerText = msg;
        toast.style.display = 'block';
        if (duration > 0) setTimeout(() => toast.style.display = 'none', duration);
        return toast;
    }

    async handleSend() {
        const text = this.input.value.trim();
        if (!text && this.attachments.length === 0) return;

        if (this.titleEl && text) {
            this.titleEl.textContent = text.length > 20 ? text.substring(0, 20) + '...' : text;
        }

        const currentAttachments = [...this.attachments];
        this.addUserMessage(text, currentAttachments);

        this.input.value = '';
        this.attachments = [];
        this.renderPreviews();

        const thinkingEl = this.showAIThinking();

        try {
            await this.getAIResponse(text, thinkingEl, currentAttachments);
        } catch (e) {
            thinkingEl.remove();
            this.addAIResponse('抱歉，发生了错误: ' + e.message);
        }
    }

    addUserMessage(text, attachments = []) {
        const row = document.createElement('div');
        row.className = 'user-message';
        row.style.display = 'flex';
        row.style.flexDirection = 'column';
        row.style.alignItems = 'flex-end';
        row.style.margin = '8px 0';

        let contentHtml = '';

        attachments.forEach(att => {
            if (att.preview) {
                contentHtml += `<img src="${att.preview}" style="max-width:200px; border-radius:12px; margin-bottom:4px; box-shadow:0 2px 8px rgba(0,0,0,0.1);">`;
            } else {
                contentHtml += `<div style="background:#f2f2f7; padding:8px 12px; border-radius:12px; margin-bottom:4px; font-size:12px; border:1px solid #ddd;">📄 ${att.file.name}</div>`;
            }
        });

        if (text) {
            contentHtml += `<div class="user-bubble" style="background:var(--ios-blue); color:white; padding:12px 16px; border-radius:18px; max-width:85%;">${this.escapeHtml(text)}</div>`;
        }

        row.innerHTML = contentHtml;
        this.messagesContainer.appendChild(row);
        this.scrollToBottom();
    }

    showAIThinking() {
        const el = document.createElement('div');
        el.className = 'ai-response';
        el.style.margin = '16px 0';
        el.innerHTML = `
            <div style="font-size:12px; color:#aaa; margin-bottom:4px;">✦ Assistant</div>
            <div class="ai-response-content" style="background:#f2f2f7; padding:12px 16px; border-radius:18px; color:#333; max-width:90%;">Thinking...</div>
        `;
        this.messagesContainer.appendChild(el);
        this.scrollToBottom();
        return el;
    }

    async getAIResponse(query, thinkingEl, attachments = []) {
        if (!window.aiCore) {
            thinkingEl.querySelector('.ai-response-content').innerText = 'Please set API Key in settings.';
            return;
        }

        let attachmentContext = "";
        if (attachments.length > 0) {
            attachmentContext = `\n\n(用户上传了 ${attachments.length} 个附件，请协助处理相关信息。)`;
        }

        const context = window.memoryAgent ? await window.memoryAgent.retrieveContext(query) : "";
        const messages = [
            { role: 'system', content: 'You are Highlighti AI. Answer in Chinese. Use markdown.' },
            { role: 'user', content: `Context:\n${context + attachmentContext}\n\nUser Question: ${query || "请分析附件内容。"}` }
        ];

        let fullText = '';
        const contentEl = thinkingEl.querySelector('.ai-response-content');

        try {
            const stream = window.aiCore.streamChat(messages);
            for await (const chunk of stream) {
                if (chunk.type === 'token') {
                    fullText = chunk.fullText;
                    contentEl.innerHTML = this.formatMarkdown(fullText);
                    this.scrollToBottom();
                }
            }
            if (window.memoryAgent) window.memoryAgent.processInteraction(query, fullText);
        } catch (err) {
            contentEl.innerText = 'Error: ' + err.message;
        }
    }

    formatMarkdown(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n# (.*)/g, '<h2 style="font-size:18px; margin:10px 0;">$1</h2>')
            .replace(/\n## (.*)/g, '<h3 style="font-size:16px; margin:8px 0;">$1</h3>')
            .replace(/\n\* (.*)/g, '<li>$1</li>')
            .replace(/\n- (.*)/g, '<li>$1</li>')
            .replace(/\n/g, '<br>');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    scrollToBottom() {
        const content = document.getElementById('chat-content');
        if (content) content.scrollTop = content.scrollHeight;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.mobileChat = new MobileChat();
});
