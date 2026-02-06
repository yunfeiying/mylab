/**
 * mobile-chat.js - Refined Layout Chat Controller (V7.0)
 * Implemented: Chat History & Session Management, Global Dock Compatibility
 */

class MobileChat {
    constructor() {
        // We now use the global input (#global-input) managed by mobile-core.js
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

        // Session List Click Delegation
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

    /**
     * Called by mobile-core.js when the Global Dock send button is pressed.
     */
    async handleExternalSend(text) {
        if (!text) return;
        if (this.isGenerating) return;

        this.addUserMessage(text, true);

        const thinkingEl = this.showAIThinking();
        this.isGenerating = true;
        await this.getAIResponse(text, thinkingEl);
        this.isGenerating = false;
    }

    /**
     * Public method called by the global '+' button to add attachments.
     */
    addAttachments(files) {
        if (files && files.length > 0) {
            this.handleAttachments(files);
        }
    }

    async handleAttachments(files) {
        for (const file of files) {
            if (file.type.startsWith('image/')) {
                this.addUserMessage(`[Image] ${file.name} - Processing OCR...`, true);
                if (window.showToast) window.showToast('Extracting text from image...', 2000);

                try {
                    let { data: { text } } = await Tesseract.recognize(file, 'chi_sim+eng');
                    if (text) {
                        text = text.replace(/\s+/g, '').replace(/[|｜_]/g, '');
                    }

                    if (text) {
                        this.addAIMessage(`OCR Extracted Text:\n\n${text}`, true);
                        const prompt = `Following is the text extracted from an image. Please provide a concise summary or extract key points:\n\n${text}`;
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
                this.addAIMessage(`I've received your file: "${file.name}". \nCurrently I can only process image OCR directly. For other files, please copy the content here if you need analysis.`, false);
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
        this.startNewChat();
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
                this.addUserMessage(msg.content, false);
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
        return this.escapeHtml(text).replace(/\n/g, '<br>');
    }

    scrollToBottom() {
        if (this.messagesContainer) {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }
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

    buildSystemPrompt(context = {}) {
        const timestamp = new Date().toLocaleString();
        const core = [
            `Role: Highlighti Intelligence (Knowledge Architect)`,
            `Time: ${timestamp}`,
            `Tone: Professional, Crisp, High-Signal, Visual (Mobile-First).`,
            `Philosophy: 'Less is More'. Distill noise, structure chaos.`,
            ``
        ];

        if (context.hasLink) {
            core.push(`[MODE: THE READER (Analysis)]`);
            core.push(`1. Summary: 1-sentence hook.`);
            core.push(`2. Key Takeaways: 3-5 high-value bullet points.`);
            core.push(`3. Critical Analysis: Identify logic gaps or bias.`);
            core.push(`4. The 'So What?': Impact analysis.`);
        } else if (context.hasHistory) {
            core.push(`[MODE: THE THINKER (Contextual)]`);
            core.push(`- Use mental models to structure answers.`);
            core.push(`- Proactively suggest connections.`);
        } else {
            core.push(`[MODE: GENERAL ASSISTANT]`);
            core.push(`- Be radically concise.`);
        }

        core.push(``);
        core.push(`[STRICT OUTPUT RULES]`);
        core.push(`- NO Markdown Code Blocks (\`\`\`) for text.`);
        core.push(`- Paragraphs < 4 lines (Mobile Optimization).`);
        core.push(`- Use **Bold** for emphasis.`);
        core.push(`- End deep analysis with a 'Spark': A provocative follow-up question.`);

        return core.join('\n');
    }

    async getAIResponse(query, thinkingEl) {
        const contentEl = thinkingEl.querySelector('.ai-response-content');
        if (!contentEl) return;

        if (!window.aiCore || !window.aiCore.config.apiKey) {
            contentEl.innerHTML = '<span style="color:red; font-size:12px;">⚠️ 未设置 API Key (请在设置中配置)</span>';
            return;
        }

        try {
            let context = "";
            let urlMatch = query.match(/(https?:\/\/[^\s\u4e00-\u9fa5"'`]+)/i);

            if (urlMatch) {
                const url = urlMatch[0];
                let foundInReader = false;
                if (window.mobileCore && window.mobileCore.dataMap) {
                    for (let [id, val] of window.mobileCore.dataMap) {
                        if (val.url === url || (val.url && url.includes(val.url))) {
                            context = `[Context from Link: ${val.title}]\n${val.content || val.text}\n\n`;
                            foundInReader = true;
                            break;
                        }
                    }
                }
                if (!foundInReader) {
                    context = `[URL Detected: ${url}]\n(Note: I cannot browse the live web autonomously. If this is a deep link, please copy the content. If it is a known concept, I will analyze it.)\n\n`;
                }
            }

            const systemPrompt = this.buildSystemPrompt({
                hasLink: !!urlMatch,
                hasHistory: this.chatHistory.length > 0
            });

            const messages = [{ role: 'system', content: systemPrompt }];
            const historyForAPI = this.chatHistory.slice(-10).map(m => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content
            }));

            const historicalMsgs = historyForAPI.slice(0, -1);
            messages.push(...historicalMsgs);
            messages.push({ role: 'user', content: context ? `上下文：${context}\n问题：${query}` : query });

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
