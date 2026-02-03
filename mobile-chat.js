/**
 * mobile-chat.js - Gemini-style Chat Controller
 */

class MobileChat {
    constructor() {
        this.input = document.getElementById('chat-input');
        this.sendBtn = document.getElementById('btn-send');
        this.messagesContainer = document.getElementById('messages-container');
        this.titleEl = document.getElementById('chat-title');
        this.sparkIndicator = document.getElementById('ai-spark-indicator');

        this.setupEvents();
    }

    setupEvents() {
        // Send button click
        if (this.sendBtn) {
            this.sendBtn.onclick = () => this.handleSend();
        }

        // Enter to send
        if (this.input) {
            this.input.onkeydown = (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.handleSend();
                }
            };
        }

        // Tools (Delegation or check existence)
        const micBtn = document.querySelector('.tool-btn:nth-child(3)'); // Approximate if no ID
        if (micBtn) {
            micBtn.onclick = () => this.toggleVoiceInput();
        }
    }

    async handleSend() {
        const text = this.input.value.trim();
        if (!text) return;

        // Hide spark indicator on first message
        if (this.sparkIndicator) {
            this.sparkIndicator.classList.add('hidden');
        }

        // Update title with topic preview
        this.titleEl.textContent = text.length > 15 ? text.substring(0, 15) + '...' : text;

        // Add user message
        this.addUserMessage(text);
        this.input.value = '';

        // Show AI thinking
        const thinkingEl = this.showAIThinking();

        // Get AI response
        try {
            await this.getAIResponse(text, thinkingEl);
        } catch (e) {
            thinkingEl.remove();
            this.addAIResponse('抱歉，出现了错误: ' + e.message);
        }
    }

    addUserMessage(text) {
        const row = document.createElement('div');
        row.className = 'user-message';
        row.innerHTML = `<div class="user-bubble">${this.escapeHtml(text)}</div>`;
        this.messagesContainer.appendChild(row);
        this.scrollToBottom();
    }

    showAIThinking() {
        const el = document.createElement('div');
        el.className = 'ai-response';
        el.innerHTML = `
            <div class="ai-response-header">
                <span class="spark-icon">✦</span>
                <span>Thinking...</span>
            </div>
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        this.messagesContainer.appendChild(el);
        this.scrollToBottom();
        return el;
    }

    addAIResponse(content, thinkingEl = null) {
        if (thinkingEl) thinkingEl.remove();

        const el = document.createElement('div');
        el.className = 'ai-response';
        el.innerHTML = `
            <div class="ai-response-header">
                <span class="spark-icon">✦</span>
            </div>
            <div class="ai-response-content">${this.formatMarkdown(content)}</div>
        `;
        this.messagesContainer.appendChild(el);
        this.scrollToBottom();
    }

    async getAIResponse(query, thinkingEl) {
        // Get memory context
        const memoryContext = window.memoryAgent ? await window.memoryAgent.retrieveContext(query) : "";

        const systemPrompt = `你是 Highlighti 数字助手，智慧、专业、高效。
请用简洁清晰的中文回答问题。
适当使用 Markdown 格式（如标题、列表）来组织内容。
上下文: ${memoryContext}`;

        if (!window.aiCore) {
            thinkingEl.remove();
            this.addAIResponse('请先在设置中配置 API Key。');
            return;
        }

        let fullText = '';
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: query }
        ];

        const stream = window.aiCore.streamChat(messages);
        for await (const chunk of stream) {
            if (chunk.type === 'token') {
                fullText = chunk.fullText;
                // Update thinking element with streaming content
                const contentEl = thinkingEl.querySelector('.ai-response-content');
                if (!contentEl) {
                    thinkingEl.innerHTML = `
                        <div class="ai-response-header">
                            <span class="spark-icon">✦</span>
                        </div>
                        <div class="ai-response-content">${this.formatMarkdown(fullText)}</div>
                    `;
                } else {
                    contentEl.innerHTML = this.formatMarkdown(fullText);
                }
                this.scrollToBottom();
            }
        }

        // Memory update
        if (window.memoryAgent) {
            window.memoryAgent.processInteraction(query, fullText);
        }
    }

    formatMarkdown(text) {
        // Simple markdown parsing
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n### (.*)/g, '<h3>$1</h3>')
            .replace(/\n## (.*)/g, '<h3>$1</h3>')
            .replace(/\n# (.*)/g, '<h3>$1</h3>')
            .replace(/\n\* (.*)/g, '<li>$1</li>')
            .replace(/\n- (.*)/g, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)+/gs, '<ul>$&</ul>')
            .replace(/\n/g, '<br>');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    scrollToBottom() {
        const content = document.getElementById('chat-content');
        if (content) {
            content.scrollTop = content.scrollHeight;
        }
    }

    toggleVoiceInput() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('当前浏览器不支持语音输入');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'zh-CN';
        recognition.start();

        const micBtn = document.getElementById('btn-mic');
        if (micBtn) micBtn.textContent = '🔴';

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            this.input.value = transcript;
            this.handleSend();
        };

        recognition.onend = () => {
            if (micBtn) micBtn.textContent = '🎙';
        };
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.mobileChat = new MobileChat();
});
