/**
 * mobile-chat.js - Refined Layout Chat Controller (V6.7)
 * Implemented: Chat History & Session Management
 */

class MobileChat {
    constructor() {
        this.input = document.getElementById('chat-input');
        this.messagesContainer = document.getElementById('messages-container');
        this.titleEl = document.getElementById('chat-title');

        this.chatSessions = [];
        this.currentSessionId = null;
        this.chatHistory = [];
        this.isGenerating = false;

        this.setupEvents();
        setTimeout(() => this.loadHistory(), 100);
    }

    setupEvents() {
        // Toggle History View
        const historyBtn = document.getElementById('btn-chat-history');
        if (historyBtn) {
            historyBtn.onclick = () => {
                this.renderSessions();
                if (window.mobileCore) window.mobileCore.navigateTo('chat-history');
            };
        }

        // Back from History
        const backBtn = document.getElementById('btn-history-back');
        if (backBtn) {
            backBtn.onclick = () => {
                if (window.mobileCore) window.mobileCore.navigateTo('chat');
            };
        }

        // Attachment Handling
        const fileInput = document.getElementById('chat-file-input');
        if (fileInput) {
            fileInput.onchange = (e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                    this.handleAttachments(files);
                }
            };
        }

        const newChatPlus = document.getElementById('btn-new-chat-plus');
        if (newChatPlus) {
            newChatPlus.onclick = (e) => {
                e.stopPropagation();
                if (fileInput) fileInput.click(); // Also use + in chat for attachments as requested
            };
        }

        // Session List Click Delegation (CSP Friendly)
        const sessionsContainer = document.getElementById('chat-sessions-container');
        if (sessionsContainer) {
            sessionsContainer.onclick = (e) => {
                const item = e.target.closest('.session-item');
                if (item) {
                    const sid = item.dataset.sessionId;
                    this.handleSessionClick(sid);
                }
            };
        }

        // Clear History
        const clearBtn = document.getElementById('btn-clear-chat-history');
        if (clearBtn) {
            clearBtn.onclick = async () => {
                if (confirm('Clear all chat history permanently?')) {
                    this.chatSessions = [];
                    this.currentSessionId = null;
                    this.chatHistory = [];
                    await window.idb.delete('chat_history_persistent');
                    await window.idb.delete('chat_current_session_id');
                    this.startNewChat();
                    if (window.mobileCore) window.mobileCore.navigateTo('chat');
                }
            };
        }
    }

    async handleAttachments(files) {
        for (const file of files) {
            if (file.type.startsWith('image/')) {
                this.addUserMessage(`[Image] ${file.name} - Processing OCR...`, true);
                if (window.showToast) window.showToast('Extracting text from image...', 2000);

                try {
                    // Initialize Tesseract if not already (it's globally defined by script)
                    const { data: { text } } = await Tesseract.recognize(file, 'chi_sim+eng');

                    if (text && text.trim()) {
                        this.addAIMessage(`OCR Extracted Text:\n\n${text.trim()}`, true);
                        // Auto-send to AI for summarization
                        const prompt = `Following is the text extracted from an image. Please provide a concise summary or extract key points:\n\n${text.trim()}`;
                        const thinkingEl = this.showAIThinking();
                        this.isGenerating = true;
                        await this.getAIResponse(prompt, thinkingEl);
                        this.isGenerating = false;
                    } else {
                        this.addAIMessage("Sorry, I couldn't find any clear text in this image.", false);
                    }
                } catch (err) {
                    console.error('OCR Error:', err);
                    this.addAIMessage("Error during text extraction: " + err.message, false);
                }
            } else {
                this.addUserMessage(`[Attachment] ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, true);
            }
        }
    }

    async loadHistory() {
        try {
            const sessions = await window.idb.get('chat_history_persistent');
            const savedId = await window.idb.get('chat_current_session_id');

            this.chatSessions = sessions || [];
            this.currentSessionId = savedId || (this.chatSessions.length > 0 ? this.chatSessions[0].id : null);

            if (this.currentSessionId) {
                await this.switchToSession(this.currentSessionId);
            } else {
                this.startNewChat();
            }
        } catch (err) {
            console.error('Failed to load chat history:', err);
            this.startNewChat();
        }
    }

    async saveHistory() {
        if (!this.currentSessionId) return;

        const sessionIndex = this.chatSessions.findIndex(s => s.id === this.currentSessionId);
        if (sessionIndex !== -1) {
            this.chatSessions[sessionIndex].messages = this.chatHistory;
            this.chatSessions[sessionIndex].timestamp = Date.now();
            // Update title if it's the first exchange
            if (this.chatHistory.length > 0 && this.chatSessions[sessionIndex].title === 'New Chat') {
                const firstMsg = this.chatHistory.find(m => m.role === 'user');
                if (firstMsg) {
                    let title = firstMsg.content.substring(0, 20);
                    if (firstMsg.content.length > 20) title += '...';
                    this.chatSessions[sessionIndex].title = title;
                    if (this.titleEl) this.titleEl.textContent = title;
                }
            }
        } else {
            this.chatSessions.unshift({
                id: this.currentSessionId,
                title: this.chatHistory[0] ? this.chatHistory[0].content.substring(0, 20) : 'New Chat',
                timestamp: Date.now(),
                messages: this.chatHistory
            });
        }

        await window.idb.set('chat_history_persistent', this.chatSessions);
        await window.idb.set('chat_current_session_id', this.currentSessionId);
    }

    async switchToSession(id) {
        this.currentSessionId = id;
        const session = this.chatSessions.find(s => s.id === id);
        if (session) {
            this.chatHistory = session.messages || [];
            if (this.titleEl) this.titleEl.textContent = session.title || 'AI Assistant';
        } else {
            this.chatHistory = [];
        }
        this.renderCurrentChat();
        await window.idb.set('chat_current_session_id', id);
    }

    startNewChat() {
        this.currentSessionId = 'session_' + Date.now();
        this.chatHistory = [];
        this.chatSessions.unshift({
            id: this.currentSessionId,
            title: 'New Chat',
            timestamp: Date.now(),
            messages: []
        });
        if (this.titleEl) this.titleEl.textContent = 'New Chat';
        this.renderCurrentChat();
        this.saveHistory();
    }

    clearMessages() {
        // Called by mobile-core to start a fresh interaction or clear current view
        // In session-based mode, we might want to start a new session
        this.startNewChat();
    }

    updateConfig(apiKey, baseUrl, model) {
        if (window.aiCore) {
            window.aiCore.config.apiKey = apiKey;
            window.aiCore.config.baseUrl = baseUrl;
            window.aiCore.config.model = model;
        }
    }

    renderCurrentChat() {
        if (!this.messagesContainer) return;
        this.messagesContainer.innerHTML = '';
        if (this.chatHistory.length === 0) {
            this.messagesContainer.innerHTML = '<div style="text-align:center; color:#999; margin-top:40px; font-size:14px;">How can I help you today?</div>';
            return;
        }

        this.chatHistory.forEach(msg => {
            if (msg.role === 'user') {
                this.addUserMessage(msg.content, false); // false = don't push to history again
            } else {
                this.addAIMessage(msg.content, false);
            }
        });
        this.scrollToBottom();
    }

    renderSessions() {
        const container = document.getElementById('chat-sessions-container');
        if (!container) return;

        if (this.chatSessions.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:#999; margin-top:40px;">No history yet.</div>';
            return;
        }

        container.innerHTML = this.chatSessions.map(s => {
            const date = new Date(s.timestamp).toLocaleDateString();
            const isActive = s.id === this.currentSessionId;
            return `
                <div class="note-item-wrapper session-item" data-session-id="${s.id}">
                    <div class="note-card ${isActive ? 'active-session' : ''}" style="${isActive ? 'border-left: 4px solid var(--ios-blue);' : ''}">
                        <div class="note-title">${this.escapeHtml(s.title || 'Untitled Chat')}</div>
                        <div class="note-preview">${date} • ${s.messages.length} messages</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Helper to prevent XSS
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    handleSessionClick(id) {
        this.switchToSession(id);
        if (window.mobileCore) window.mobileCore.navigateTo('chat');
    }

    formatMarkdown(text) {
        if (!text) return '';
        // 移除所有 Markdown 标记，只保留纯文字
        return this.escapeHtml(text)
            .replace(/\n/g, '<br>');
    }

    scrollToBottom() {
        if (this.messagesContainer) {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }
    }

    async handleSend() {
        if (this.isGenerating) return;
        const text = this.input.value.trim();
        if (!text) return;

        this.addUserMessage(text, true);
        this.input.value = '';
        this.input.style.height = 'auto';

        const thinkingEl = this.showAIThinking();
        this.isGenerating = true;
        await this.getAIResponse(text, thinkingEl);
        this.isGenerating = false;
    }

    addUserMessage(text, pushToHistory = true) {
        if (pushToHistory) {
            this.chatHistory.push({ role: 'user', content: text });
            this.saveHistory();
            if (this.chatHistory.length === 1 && this.messagesContainer.firstChild && !this.messagesContainer.firstChild.classList?.contains('message')) {
                this.messagesContainer.innerHTML = '';
            }
        }

        const el = document.createElement('div');
        el.className = 'message user';
        el.style.cssText = 'display:flex; flex-direction:column; align-items:flex-end; margin:8px 0; width: 100%;';
        el.innerHTML = `
            <div class="message-bubble" style="background:var(--ios-blue); color:#fff; padding:10px 16px; border-radius:18px; border-bottom-right-radius:4px; max-width:85%; width: fit-content; word-break: break-word; line-height:1.5; font-size:16px;">${this.escapeHtml(text)}</div>
        `;
        this.messagesContainer.appendChild(el);
        this.scrollToBottom();
    }

    addAIMessage(text, pushToHistory = false) {
        if (pushToHistory) {
            this.chatHistory.push({ role: 'assistant', content: text });
            this.saveHistory();
        }

        const el = document.createElement('div');
        el.className = 'message assistant';
        el.style.cssText = 'display:flex; flex-direction:column; align-items:flex-start; margin:8px 0; width: 100%;';
        el.innerHTML = `
            <div class="ai-response-content message-bubble" style="background:#fff; color:#444; padding:10px 16px; border-radius:18px; border-bottom-left-radius:4px; max-width:85%; width: fit-content; border:1px solid #eee; line-height:1.5; font-size:16px; word-break: break-word;">${this.formatMarkdown(text)}</div>
        `;
        this.messagesContainer.appendChild(el);
        this.scrollToBottom();
    }

    showAIThinking() {
        const el = document.createElement('div');
        el.className = 'message assistant thinking';
        el.style.cssText = 'display:flex; flex-direction:column; align-items:flex-start; margin:8px 0; width: 100%;';
        el.innerHTML = `
            <div class="ai-response-content message-bubble" style="background:#fff; color:#444; padding:10px 16px; border-radius:18px; border-bottom-left-radius:4px; max-width:85%; width: fit-content; border:1px solid #eee;">
                <span class="typing-indicator">●●●</span>
            </div>
        `;
        this.messagesContainer.appendChild(el);
        this.scrollToBottom();
        return el;
    }

    async getAIResponse(query, thinkingEl) {
        const contentEl = thinkingEl.querySelector('.ai-response-content');
        if (!contentEl) return;

        if (!window.aiCore || !window.aiCore.config.apiKey) {
            contentEl.innerHTML = '<span style="color:red; font-size:12px;">⚠️ 未设置 API Key (请在设置中配置)</span>';
            return;
        }

        try {
            // Link Recognition Logic: Check if query contains a link we already have in Reader
            let context = "";
            const urlMatch = query.match(/https?:\/\/[^\s]+/);
            if (urlMatch && window.mobileCore && window.mobileCore.dataMap) {
                const url = urlMatch[0];
                for (let [id, val] of window.mobileCore.dataMap) {
                    if (val.url === url) {
                        context = `[Context from Link: ${val.title}]\n${val.content || val.text}\n\n`;
                        break;
                    }
                }
            }

            const messages = [
                { role: 'system', content: '你是一个富有创意且擅长架构思维的 AI 助手。请优先构建清晰的逻辑框架，并提供深度的创意建议。直接输出纯文字正文，不使用任何 Markdown 源码符号。' }
            ];

            const historyForAPI = this.chatHistory.slice(-10).map(m => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content
            }));

            const historicalMsgs = historyForAPI.slice(0, -1);
            messages.push(...historicalMsgs);
            messages.push({ role: 'user', content: `上下文：${context}\n问题：${query}` });

            const stream = window.aiCore.streamChat(messages);
            let fullText = '';
            let hasToken = false;

            for await (const chunk of stream) {
                if (chunk.type === 'token') {
                    if (!hasToken) {
                        hasToken = true;
                        contentEl.innerHTML = '';
                    }
                    fullText = chunk.fullText;
                    contentEl.innerHTML = this.formatMarkdown(fullText);
                    this.scrollToBottom();
                }
            }

            this.chatHistory.push({ role: 'assistant', content: fullText });
            this.saveHistory();

            if (window.memoryAgent && fullText) {
                setTimeout(() => window.memoryAgent.processInteraction(query, fullText), 100);
            }
        } catch (err) {
            contentEl.innerHTML = `<span style="color:red; font-size:12px;">❌ 错误: ${err.message}</span>`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.mobileChat = new MobileChat();
});
