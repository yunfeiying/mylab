/**
 * ai-core-mobile.js - Unified AI Controller for Mobile
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
        console.log('[AICore] Initializing...');
        try {
            if (!window.appStorage) {
                console.error('[AICore] window.appStorage is missing! Retrying in 500ms...');
                setTimeout(() => this.init(), 500);
                return;
            }
            // Load from both individual keys (standard) and nested object (legacy/mobile-specific)
            const res = await window.appStorage.get(['ai_api_key', 'ai_base_url', 'ai_model', 'settings']);
            const nested = res.settings || {};

            this.config.apiKey = res.ai_api_key || nested.ai_api_key || '';
            this.config.baseUrl = res.ai_base_url || nested.ai_base_url || 'https://api.deepseek.com';
            this.config.model = res.ai_model || nested.ai_model || 'deepseek-chat';

            console.log('[AICore] Config loaded successfully.');
        } catch (e) {
            console.error('[AICore] Init failed:', e);
        }
    }

    async *streamChat(messages) {
        if (!this.config.apiKey) {
            yield { type: 'token', fullText: 'Error: API Key is missing. Please set it in Settings.' };
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

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
            }

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
                        } catch (e) { }
                    }
                }
            }
        } catch (e) {
            yield { type: 'error', fullText: `Error: ${e.message}` };
        }
    }

    async generateText(prompt) {
        if (!this.config.apiKey) throw new Error("API Key missing");
        const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`
            },
            body: JSON.stringify({
                model: this.config.model,
                messages: [{ role: 'user', content: prompt }],
                stream: false
            })
        });
        const data = await response.json();
        return data.choices[0].message.content;
    }

    async generateJSON(prompt, formatHint = "") {
        const fullPrompt = prompt + (formatHint ? `\n\nReturn ONLY valid JSON matching this structure: ${formatHint}` : "");
        const text = await this.generateText(fullPrompt);
        try {
            // Basic JSON cleaning: remove markdown code blocks
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error('[AICore] JSON Parse failed:', text);
            throw e;
        }
    }
}

// Global Singleton
window.aiCore = new AICoreMobile();
document.addEventListener('DOMContentLoaded', () => {
    window.aiCore.init();
});
