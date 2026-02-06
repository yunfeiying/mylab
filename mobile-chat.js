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
        this.pendingFiles = []; // For the global dock preview

        this.setupEvents();
        window.mobileChat = this;
        setTimeout(() => this.loadHistory(), 100);
    }

    handleExternalSend(text) {
        if (!text) return;
        // If a new session is needed, initialize it here
        if (!this.currentSessionId) {
            this.initNewSession();
        }
        this.addUserMessage(text);
        const thinkingEl = this.showAIThinking();
        this.isGenerating = true;
        this.getAIResponse(text, thinkingEl).finally(() => {
            this.isGenerating = false;
        });
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

        // Image Modal Events
        const modal = document.getElementById('image-modal-overlay');
        const closeBtn = document.getElementById('btn-close-image-modal');
        if (modal && closeBtn) {
            closeBtn.onclick = () => modal.classList.add('hidden');
            modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
        }
    }

    showImageModal(src) {
        const modal = document.getElementById('image-modal-overlay');
        const img = document.getElementById('modal-image-full');
        if (modal && img) {
            img.src = src;
            modal.classList.remove('hidden');
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
            const fileName = file.name || `attachment_${Date.now()}.${file.type.split('/')[1] || 'png'}`;
            const fileType = file.type;

            try {
                let extractedText = "";
                let base64 = null;

                if (fileType.startsWith('image/')) {
                    // Image OCR logic
                    const reader = new FileReader();
                    const result = await new Promise((resolve, reject) => {
                        reader.onload = async (e) => {
                            const b64 = e.target.result;
                            // Show thumbnail immediately
                            this.addUserMessage(`[Image] ${fileName} - Processing...`, true, b64);
                            if (window.showToast) window.showToast('Extracting text...', 2000);

                            try {
                                const TESS = await this.loadLibrary('Tesseract', '../tesseract.min.js');

                                // Configure Tesseract to use local worker and core
                                const worker = await TESS.createWorker('chi_sim+eng', 1, {
                                    workerPath: '../worker.min.js',
                                    corePath: '../tesseract-core.wasm.js',
                                    langPath: '../', // Assuming traineddata is in root
                                    logger: m => console.log('[Tesseract]', m)
                                });

                                let { data: { text } } = await worker.recognize(file);
                                await worker.terminate();

                                if (text) text = text.replace(/\s+/g, '').replace(/[|｜_]/g, '');
                                resolve({ text, base64: b64 });
                            } catch (err) { reject(err); }
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                    extractedText = result.text;
                    base64 = result.base64;
                } else {
                    this.addUserMessage(`[Attachment] ${fileName} - Analyzing...`, true);
                    extractedText = await this.processFile(file);
                }

                // SAVE AS PERMANENT RECORD
                await this.saveAttachmentAsRecord(file, extractedText, base64);

                if (extractedText) {
                    // 1. Show the extracted content clearly
                    this.addAIMessage(`**${fileName}** 文本提取成功:\n\n${extractedText.substring(0, 500)}${extractedText.length > 500 ? '...' : ''}`, true);

                    // 2. Perform automated analysis without RAG interference
                    const prompt = `分析下文提取自 "${fileName}" 的内容，并给出核心摘要（3-5点）：\n\n${extractedText}`;
                    const thinkingEl = this.showAIThinking();
                    this.isGenerating = true;
                    // Pass skipKnowledge option
                    await this.getAIResponse(prompt, thinkingEl, { skipKnowledge: true });
                    this.isGenerating = false;
                } else {
                    this.addAIMessage(`已收到文件 "${fileName}"，但未能提取到有效文字内容。`, false);
                }
            } catch (err) {
                console.error('File Processing Error:', err);
                this.addAIMessage(`Error processing "${fileName}": ` + err.message, false);
            }
        }
    }

    async processFile(file) {
        const fileName = file.name.toLowerCase();

        if (fileName.endsWith('.docx')) {
            const mammoth = await this.loadLibrary('mammoth', '../lib/mammoth.browser.min.js');
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
            return result.value;
        }

        if (fileName.endsWith('.pdf')) {
            const arrayBuffer = await file.arrayBuffer();
            const typedarray = new Uint8Array(arrayBuffer);

            // Lazy load PDF.js
            if (!window.pdfjsLib) {
                const pdfjs = await import('../lib/pdf.mjs');
                window.pdfjsLib = pdfjs;
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = '../lib/pdf.worker.mjs';
            }

            const loadingTask = window.pdfjsLib.getDocument(typedarray);
            const pdf = await loadingTask.promise;
            let fullText = "";
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + "\n";
            }
            return fullText;
        }

        if (fileName.endsWith('.pptx')) {
            const JSZip = await this.loadLibrary('JSZip', '../lib/jszip.min.js');
            const zip = await JSZip.loadAsync(file);
            let fullText = "";
            const slideFiles = Object.keys(zip.files).filter(f => f.match(/^ppt\/slides\/slide\d+\.xml$/));
            slideFiles.sort((a, b) => {
                const numA = parseInt(a.match(/slide(\d+)\.xml/)[1]);
                const numB = parseInt(b.match(/slide(\d+)\.xml/)[1]);
                return numA - numB;
            });
            for (const slidePath of slideFiles) {
                const xmlText = await zip.file(slidePath).async("string");
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, "text/xml");
                const textNodes = xmlDoc.getElementsByTagName("a:t");
                for (let i = 0; i < textNodes.length; i++) fullText += textNodes[i].textContent + " ";
                fullText += "\n";
            }
            return fullText;
        }

        if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            const XLSX = await this.loadLibrary('XLSX', '../lib/xlsx.full.min.js');
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            let fullText = "";
            workbook.SheetNames.forEach(sheetName => {
                fullText += `\n[Sheet: ${sheetName}]\n`;
                const sheet = workbook.Sheets[sheetName];
                fullText += XLSX.utils.sheet_to_csv(sheet);
            });
            return fullText;
        }

        if (fileName.endsWith('.txt') || fileName.endsWith('.md') || fileName.endsWith('.js') || fileName.endsWith('.json')) {
            return await file.text();
        }

        throw new Error("Unsupported file format for direct processing.");
    }

    async loadLibrary(globalName, path) {
        if (window[globalName]) return window[globalName];
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = path;
            script.onload = () => resolve(window[globalName]);
            script.onerror = () => reject(new Error(`Failed to load library: ${globalName}`));
            document.head.appendChild(script);
        });
    }

    async saveAttachmentAsRecord(file, extractedText = '', base64 = null) {
        if (!window.appStorage) return;

        const timestamp = Date.now();
        const id = 'attach_' + timestamp;
        const record = {
            id: id,
            type: 'note', // Save as note so it appears in library
            title: `[File] ${file.name}`,
            content: extractedText ? `OCR Content:\n${extractedText}` : `File attached: ${file.name}`,
            timestamp: timestamp,
            updatedAt: timestamp,
            fileType: file.type,
            fileName: file.name,
            fileSize: file.size,
            isAttachment: true
        };

        if (base64) record.imagePreview = base64;

        await window.appStorage.set({ [id]: record });
        if (window.mobileCore) window.mobileCore.renderApp();
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

        // Only add to chatSessions if there are messages
        if (this.chatHistory.length > 0) {
            const sessionIndex = this.chatSessions.findIndex(s => s.id === this.currentSessionId);
            if (sessionIndex !== -1) {
                this.chatSessions[sessionIndex].messages = this.chatHistory;
                this.chatSessions[sessionIndex].timestamp = Date.now();
                if (this.chatSessions[sessionIndex].title === 'New Chat') {
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
        }

        // Filter and save only sessions with content
        const sessionsToSave = this.chatSessions.filter(s => s.messages && s.messages.length > 0);
        await window.idb.set('chat_history_persistent', sessionsToSave);
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
        // We don't add to this.chatSessions here to avoid empty history entries
        if (this.titleEl) this.titleEl.textContent = 'New Chat';
        this.renderCurrentChat();
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
                this.addUserMessage(msg.content, false, msg.image);
            } else {
                this.addAIMessage(msg.content, false);
            }
        });
        setTimeout(() => this.scrollToBottom(), 100);
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

        // First escape HTML to prevent XSS, but keep it as a string for regex
        let escaped = this.escapeHtml(text);

        let html = escaped
            // Handle bold **text**
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Handle headers ###
            .replace(/^### (.*$)/gm, '<h3 style="margin:8px 0; font-size:17px; font-weight:700;">$1</h3>')
            .replace(/^## (.*$)/gm, '<h2 style="margin:10px 0; font-size:18px; font-weight:700;">$1</h2>')
            .replace(/^# (.*$)/gm, '<h1 style="margin:12px 0; font-size:20px; font-weight:700;">$1</h1>')
            // Handle bullet points
            .replace(/^[\-\*]\s+(.*)/gm, '<div style="margin-left:4px; margin-bottom:4px;">• $1</div>')
            // Handle numbered lists
            .replace(/^\d+\.\s+(.*)/gm, '<div style="margin-left:4px; margin-bottom:4px;">$1</div>')
            // Handle URLs - Linkify and make them clickable for Reader
            .replace(/(https?:\/\/[^\s\u4e00-\u9fa5<]+)/g, '<a href="javascript:void(0)" onclick="window.mobileChat.saveUrlToReader(\'$1\')" class="chat-link">$1</a>')
            // Preserve newlines
            .replace(/\n/g, '<br>')
            // Handle Skill Proposals
            .replace(/\[PROPOSE_SKILL: (.*?)\]/g, (match, p1) => {
                try {
                    const skill = JSON.parse(p1);
                    return `<div class="skill-proposal-card" style="margin-top:12px; padding:12px; border:1px solid var(--ios-blue); border-radius:12px; background:rgba(0,122,255,0.05);">
                        <div style="font-weight:600; color:var(--ios-blue); margin-bottom:4px;">✨ 技能提案: ${skill.name}</div>
                        <div style="font-size:12px; color:#666; margin-bottom:8px;">检测到相关需求，是否为 AI 开启此项新技能？</div>
                        <button onclick='window.mobileChat.installSkill(${JSON.stringify(p1)})' 
                                style="background:var(--ios-blue); color:white; border:none; padding:6px 16px; border-radius:20px; font-size:13px; font-weight:600; width:100%;">
                            立即启用
                        </button>
                    </div>`;
                } catch (e) { return ''; }
            });

        return html;
    }

    async installSkill(skillJson) {
        try {
            const config = JSON.parse(skillJson);
            if (window.chatSkillsEngine) {
                await window.chatSkillsEngine.addDynamicSkill(config);
                if (window.showToast) window.showToast(`技能 "${config.name}" 已启用！`, 2000);
                this.addAIMessage(`✅ 技能 **${config.name}** 已成功安装并激活。你现在可以尝试询问相关问题了。`, true);
            }
        } catch (e) {
            console.error('Skill Install Error:', e);
        }
    }

    handleSkillProposal(text) {
        // This is handled via the formatMarkdown/installSkill flow now
        // but we could add logic here for auto-triggers if needed.
    }

    scrollToBottom() {
        // Target the parent view scroller since #messages-container itself might not be the scroller
        const scroller = document.getElementById('chat-content');
        if (scroller) {
            scroller.scrollTop = scroller.scrollHeight;

            // Backup for ultra-long lists: ensure we actually reach the bottom
            requestAnimationFrame(() => {
                scroller.scrollTop = scroller.scrollHeight;
            });
        }
    }

    addUserMessage(text, pushToHistory = true, imageBase64 = null) {
        if (pushToHistory) {
            const msg = { role: 'user', content: text };
            if (imageBase64) msg.image = imageBase64;
            this.chatHistory.push(msg);
            this.saveHistory();
            if (this.chatHistory.length === 1 && this.messagesContainer.firstChild && !this.messagesContainer.firstChild.classList?.contains('message')) {
                this.messagesContainer.innerHTML = '';
            }
        }

        const el = document.createElement('div');
        el.className = 'message user';
        el.style.cssText = 'display:flex; flex-direction:column; align-items:flex-end; margin:8px 0; width: 100%;';

        let content = `<div class="message-bubble" style="background:var(--ios-blue); color:#fff; padding:10px 16px; border-radius:18px; border-bottom-right-radius:4px; max-width:85%; width: fit-content; word-break: break-word; line-height:1.5; font-size:16px;">${this.formatMarkdown(text)}</div>`;

        if (imageBase64) {
            content = `
                <div class="message-bubble" style="background:var(--ios-blue); color:#fff; padding:8px; border-radius:18px; border-bottom-right-radius:4px; max-width:85%; width: fit-content; overflow:hidden;">
                    <img src="${imageBase64}" 
                         style="max-width:100%; border-radius:12px; display:block; margin-bottom:8px; cursor:pointer;"
                         onclick="window.mobileChat.showImageModal('${imageBase64}')">
                    <div style="padding:0 8px 4px; font-size:14px; opacity:0.9;">${this.escapeHtml(text)}</div>
                </div>
            `;
        }

        el.innerHTML = content;
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
            `Role: Highlighti Intelligence (Knowledge Architect & Decision Strategist)`,
            `Time: ${timestamp}`,
            `Core Persona: 你是用户的“第二大脑”和知识策士。你不仅记录信息，更负责连接碎片，提供深度决策支持。`,
            `Communication Style: 专业、凝练、高信息密度。避免废话，直击本质。`,
            `Knowledge Operations:`,
            `- 【连接者】: 主动发现当前问题与历史笔记、阅读快照之间的联系。`,
            `- 【决策者】: 提供基于逻辑和事实的建议，而不仅仅是总结。`,
            `- 【极简主义】: 针对移动端优化，段落短小，重点加粗。`,
            ``
        ];

        if (context.hasMemory) {
            core.push(`[CONTEXT: PERSONAL KNOWLEDGE BASE]`);
            core.push(`- 以下是你从用户的知识库中检索到的相关信息。`);
            core.push(`- 请优先基于这些已知信息进行回答，如果信息冲突，说明理由。`);
        }

        if (context.hasLink) {
            core.push(`[MODE: THE READER (Analysis)]`);
            core.push(`1. Summary: 1-sentence hook.`);
            core.push(`2. Key Takeaways: 3-5 high-value bullet points.`);
            core.push(`3. Impact: Why this matters to the user.`);
        }

        core.push(`[SKILL SYSTEM - MANDATORY]`);
        core.push(`- You possess a growing library of SKILLS. Currently: Weather, Search, News, Movies.`);
        core.push(`- CRITICAL: If a user asks for information you cannot access directly (e.g., Stock prices, Crypto, Flight status, Translation, or specific API data), YOU MUST PROPOSE A NEW SKILL.`);
        core.push(`- To propose, append technical JSON at the end of your response:`);
        core.push(`  [PROPOSE_SKILL: {"id": "crypto", "name": "Crypto Tracker", "patterns": ["btc", "crypto", "price"], "apiUrl": "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"}]`);
        core.push(`- Use "https://m.baidu.com/s?word={query}" as a fallback apiUrl for generic information gathering skills.`);
        core.push(`- Do NOT apologize for lack of data without offering a [PROPOSE_SKILL] solution.`);
        core.push(``);
        core.push(`[STRICT OUTPUT RULES]`);
        core.push(`- NO Markdown Code Blocks (\`\`\`) for text.`);
        core.push(`- Use **Bold** for critical concepts.`);
        core.push(`- Keep it actionable.`);
        if (context.hasRealTime) {
            core.push(`[SYSTEM OVERRIDE]:`);
            core.push(`- YOU HAVE BEEN GIVEN REAL-TIME WEB DATA BELOW.`);
            core.push(`- DO NOT APOLOGIZE OR SAY YOU CANNOT ACCESS THE INTERNET.`);
            core.push(`- INTEGRATE THE DATA SEAMLESSLY INTO YOUR RESPONSE AS IF IT'S YOUR NATIVE KNOWLEDGE.`);
        }

        return core.join('\n');
    }

    async getAIResponse(query, thinkingEl, options = {}) {
        const contentEl = thinkingEl.querySelector('.ai-response-content');
        if (!contentEl) return;

        if (!window.aiCore || !window.aiCore.config.apiKey) {
            contentEl.innerHTML = '<span style="color:red; font-size:12px;">⚠️ 未设置 API Key (请在设置中配置)</span>';
            return;
        }

        try {
            let context = "";
            let knowledgeContext = "";
            let realTimeContext = "";

            // 0. Use the Extensible Skills Engine
            if (window.chatSkillsEngine) {
                const skillContext = await window.chatSkillsEngine.run(query);
                if (skillContext) {
                    realTimeContext += skillContext + "\n";
                    console.log('[SkillsEngine] Merged Context:', realTimeContext.length);
                }
            }

            console.log('[AI Context Check] Real-time data present:', !!realTimeContext);

            // Skip Knowledge Retrieval for automated summaries/tasks
            if (!options.skipKnowledge) {
                knowledgeContext = await this.retrieveLocalKnowledge(query);
            }

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
                    // Attempt real-time fetch via Background Script (CORS-free)
                    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                        try {
                            if (window.showToast) window.showToast('Reading link content...', 1500);
                            const response = await new Promise((resolve) => {
                                chrome.runtime.sendMessage({ action: 'FETCH_URL_CONTENT', url: url }, (res) => {
                                    if (chrome.runtime.lastError) {
                                        resolve({ success: false, error: chrome.runtime.lastError.message });
                                    } else {
                                        resolve(res);
                                    }
                                });
                            });

                            if (response && response.success) {
                                context = `[Context retrieved from URL: ${url}]\n${response.text}\n\n`;
                                console.log('[LinkFetch] Success, content length:', response.text.length);
                            } else {
                                context = `[URL Detected: ${url}]\n(Fetch failed: ${response?.error || 'Access denied'})\n\n`;
                            }
                        } catch (err) {
                            console.error('[LinkFetch] Error:', err);
                            context = `[URL Detected: ${url}]\n(System error during fetch)\n\n`;
                        }
                    } else {
                        context = `[URL Detected: ${url}]\n(Note: Live web browsing is restricted in this environment. Please paste content if possible.)\n\n`;
                    }
                }
            }

            const systemPrompt = this.buildSystemPrompt({
                hasLink: !!urlMatch,
                hasHistory: this.chatHistory.length > 0,
                hasMemory: !!knowledgeContext,
                hasRealTime: !!realTimeContext
            });

            const messages = [{ role: 'system', content: systemPrompt }];

            // Inject Knowledge Context with strict separator
            if (knowledgeContext) {
                messages.push({
                    role: 'system',
                    content: `[用户个人知识库关联内容 - 仅作参考]:\n${knowledgeContext}\n(如果当前问题与此无关，请忽略此背景。优先回答用户当前提到的内容。)`
                });
            }
            const historyForAPI = this.chatHistory.slice(-10).map(m => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content
            }));

            const historicalMsgs = historyForAPI.slice(0, -1);
            messages.push(...historicalMsgs);

            // Combine all contexts
            let finalQuery = query;
            if (realTimeContext) {
                finalQuery = `【注意：以下是实时获取的信息，请根据此回答】\n${realTimeContext}\n\n我的问题是：${finalQuery}`;
            }
            if (context) finalQuery = `上下文：${context}\n问题：${finalQuery}`;

            // Add a mandatory reminder if we are asking a question that might need a skill
            if (!realTimeContext && !context) {
                messages.push({
                    role: 'system',
                    content: `[URGENT REMINDER]: If you cannot answer this query accurately due to missing real-time data or specialized tools, you MUST provide a [PROPOSE_SKILL: {...}] JSON at the end of your response to solve this for the future.`
                });
            }

            messages.push({ role: 'user', content: finalQuery });

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

            // Handle Skill Proposals
            this.handleSkillProposal(fullText);

        } catch (err) {
            contentEl.innerHTML = `<span style="color:red; font-size:12px;">❌ 错误: ${err.message}</span>`;
        }
    }

    async retrieveLocalKnowledge(query) {
        if (!window.mobileCore || !window.mobileCore.dataMap) return "";

        const keywords = query.toLowerCase().match(/[\u4e00-\u9fa5a-zA-Z0-9]+/g) || [];
        if (keywords.length === 0) return "";

        let candidates = [];

        // Search through the main dataMap (Notes & Reader)
        for (let [id, item] of window.mobileCore.dataMap) {
            let score = 0;
            const title = (item.title || "").toLowerCase();
            const content = (item.content || item.text || "").toLowerCase();

            keywords.forEach(kw => {
                if (kw.length < 2) return;
                if (title.includes(kw)) score += 10;
                if (content.includes(kw)) score += 2;
            });

            if (score > 5) {
                candidates.push({
                    title: item.title,
                    content: (item.content || item.text || "").substring(0, 1000),
                    score: score,
                    type: item.type
                });
            }
        }

        // Add context from MemoryAgent 
        if (window.memoryAgent) {
            const memoryContext = await window.memoryAgent.retrieveContext(query);
            if (memoryContext) {
                candidates.push({
                    title: "Memory Agent (Relevant Facts)",
                    content: memoryContext,
                    score: 15, // High priority for explicit memories
                    type: 'memory'
                });
            }
        }

        // Sort by score and take top 3
        candidates.sort((a, b) => b.score - a.score);
        const top = candidates.slice(0, 3);

        if (top.length === 0) return "";

        return top.map(c => `[SOURCE: ${c.title} (${c.type})]\n${c.content}`).join('\n\n---\n\n');
    }

    async saveUrlToReader(url) {
        if (!url) return;

        try {
            if (window.showToast) window.showToast('Extracting snapshot & saving to Reader...', 3000);

            // 1. Fetch content via background
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ action: 'FETCH_URL_CONTENT', url: url }, (res) => {
                    if (chrome.runtime.lastError) resolve({ success: false, error: chrome.runtime.lastError.message });
                    else resolve(res);
                });
            });

            if (!response || !response.success) {
                throw new Error(response?.error || 'Failed to fetch content');
            }

            const timestamp = Date.now();
            let title = response.title || 'Untitled Article';
            let cleanText = response.text;
            let cleanHtml = response.html;

            // 2. Process with Readability if available
            if (typeof Readability !== 'undefined' && response.html) {
                try {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(response.html, 'text/html');
                    // Handle relative URLs by setting a base if needed (though Readability usually does some of this)
                    const reader = new Readability(doc);
                    const article = reader.parse();
                    if (article) {
                        title = article.title || title;
                        cleanText = article.textContent || cleanText;
                        cleanHtml = article.content || cleanHtml;
                    }
                } catch (pe) {
                    console.warn('[Readability] Parsing failed, falling back to raw:', pe);
                }
            }

            // 3. Save metadata & content as "reading" type
            const readerId = 'reading_' + timestamp;
            const readerData = {
                id: readerId,
                type: 'reading',
                url: url,
                title: title,
                text: cleanText,
                timestamp: timestamp,
                updatedAt: timestamp
            };

            await window.appStorage.set({ [readerId]: readerData });

            // 4. Save Cleaned HTML as snapshot
            if (cleanHtml) {
                await window.appStorage.set({
                    ['snapshot_' + url]: {
                        url: url,
                        content: cleanHtml,
                        timestamp: timestamp
                    }
                });
            }

            // 5. Update UI and Navigate
            if (window.mobileCore) {
                await window.mobileCore.renderApp();
                window.mobileCore.loadReader(readerData);
                if (window.showToast) window.showToast('Article Saved (Readability Mode)!', 2000);
            }

        } catch (err) {
            console.error('[ReaderSave] Error:', err);
            alert('Failed to save link: ' + err.message);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.mobileChat = new MobileChat();
});
