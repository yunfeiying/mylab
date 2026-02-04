/**
 * mobile-chat.js - Refined Layout Chat Controller (V6.6)
 */

class MobileChat {
    constructor() {
        this.input = document.getElementById('chat-input');
        this.messagesContainer = document.getElementById('messages-container');
        this.titleEl = document.getElementById('chat-title');
        this.setupEvents();
    }

    setupEvents() {
        const historyBtn = document.getElementById('btn-chat-history');
        if (historyBtn) {
            historyBtn.onclick = () => alert('History feature coming soon!');
        }
    }

    // 纯黑白 Markdown 转换（不含原始符号）
    formatMarkdown(text) {
        return text
            .replace(/### (.*)/g, '<div style="margin:6px 0; font-weight:bold;">$1</div>')
            .replace(/## (.*)/g, '<div style="margin:8px 0; font-weight:bold; font-size:1.1em;">$1</div>')
            .replace(/# (.*)/g, '<div style="margin:10px 0; font-weight:bold; font-size:1.2em;">$1</div>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/^- (.*)/gm, '<div style="margin-left:8px;">• $1</div>')
            .replace(/\n/g, '<br>');
    }

    scrollToBottom() {
        if (this.messagesContainer) {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }
    }

    async handleSend() {
        const text = this.input.value.trim();
        if (!text) return;

        if (this.titleEl) {
            this.titleEl.textContent = text.length > 15 ? text.substring(0, 15) + '...' : text;
        }

        this.addUserMessage(text);
        this.input.value = '';

        const thinkingEl = this.showAIThinking();
        await this.getAIResponse(text, thinkingEl);
    }

    addUserMessage(text) {
        const row = document.createElement('div');
        row.className = 'message user';
        // 优化布局：不再强制居右对齐，改为居左并留出缩进
        row.style.cssText = 'display:flex; flex-direction:column; align-items:flex-start; margin:16px 0; padding-left: 12px;';
        row.innerHTML = `
            <div style="font-size:12px; color:#999; margin-bottom:4px; margin-left:4px;">You</div>
            <div class="message-bubble" style="background:#f9f9f9; color:#000; padding:12px 16px; border-radius:12px; max-width:92%; border:1px solid #eee; line-height:1.5;">${text}</div>
        `;
        this.messagesContainer.appendChild(row);
        this.scrollToBottom();
    }

    showAIThinking() {
        const el = document.createElement('div');
        el.className = 'ai-response';
        el.style.cssText = 'display:flex; flex-direction:column; align-items:flex-start; margin:16px 0; padding-left: 12px;';
        el.innerHTML = `
            <div style="font-size:12px; color:#999; margin-bottom:4px; margin-left:4px;">Assistant</div>
            <div class="ai-response-content" style="background:transparent; color:#000; padding:4px 0; max-width:100%; font-size:16px; line-height:1.6;">
                <span class="typing-indicator">●●●</span>
            </div>
        `;
        this.messagesContainer.appendChild(el);
        this.scrollToBottom();
        return el;
    }

    async getAIResponse(query, thinkingEl) {
        const contentEl = thinkingEl.querySelector('.ai-response-content');
        if (!window.aiCore || !window.aiCore.config.apiKey) {
            contentEl.innerHTML = '<span style="color:red; font-size:12px;">⚠️ 未设置 API Key</span>';
            return;
        }

        try {
            const contextPromise = window.memoryAgent ? window.memoryAgent.retrieveContext(query) : Promise.resolve("");
            const context = await contextPromise;

            const messages = [
                { role: 'system', content: '你是 Highlighti AI。直接回答正文，不要输出源码符号。' },
                { role: 'user', content: `上下文：${context}\n问题：${query}` }
            ];

            const stream = window.aiCore.streamChat(messages);
            let hasToken = false;
            for await (const chunk of stream) {
                if (chunk.type === 'token') {
                    if (!hasToken) {
                        hasToken = true;
                        contentEl.innerHTML = '';
                    }
                    contentEl.innerHTML = this.formatMarkdown(chunk.fullText);
                    this.scrollToBottom();
                }
            }
        } catch (err) {
            contentEl.innerHTML = `<span style="color:red; font-size:12px;">❌ 错误: ${err.message}</span>`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.mobileChat = new MobileChat();
});
