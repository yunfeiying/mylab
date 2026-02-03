/**
 * ai-core-mobile.js
 * Bridges AI settings and provides a unified window.aiCore for mobile.
 */

class AICoreMobile {
    constructor() {
        this.config = {
            apiKey: '',
            baseUrl: 'https://api.deepseek.com',
            model: 'deepseek-chat'
        };
    }

    async init() {
        const settings = await window.appStorage.get(['ai_api_key', 'ai_base_url', 'ai_model']);
        this.config.apiKey = settings.ai_api_key || '';
        this.config.baseUrl = settings.ai_base_url || 'https://api.deepseek.com';
        this.config.model = settings.ai_model || 'deepseek-chat';
        console.log('[AICoreMobile] Config loaded.');
    }

    async *streamChat(messages) {
        if (!this.config.apiKey) {
            yield { type: 'token', fullText: 'Error: API Key is missing. Please set it in PC version or local storage.' };
            return;
        }

        try {
            const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify({
                    model: this.config.model,
                    messages: messages,
                    stream: true
                })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullText = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataText = line.slice(6);
                        if (dataText === '[DONE]') break;
                        try {
                            const data = JSON.parse(dataText);
                            const token = data.choices[0].delta.content;
                            if (token) {
                                fullText += token;
                                yield { type: 'token', fullText: fullText };
                            }
                        } catch (e) { /* partial json */ }
                    }
                }
            }
        } catch (e) {
            yield { type: 'token', fullText: `Error: ${e.message}` };
        }
    }

    async generateText(prompt) {
        const it = this.streamChat([{ role: 'user', content: prompt }]);
        let last = "";
        for await (const chunk of it) {
            last = chunk.fullText;
        }
        return last;
    }
}

window.aiCore = new AICoreMobile();
window.aiCore.init();
