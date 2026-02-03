/**
 * Memory Agent - AI Long-term & Short-term Memory System
 * 
 * Implements a "SQLite-style" (simulated via Chrome Storage) memory system.
 * - MEMORY.md: Long, persistent facts (User Profile, Projects).
 * - Memory+Date.md: Daily logs.
 * - Hybrid Retrieval: Keywords (BM25-like) + Vector (Simulated/Future).
 */

class MemoryAgent {
    constructor() {
        this.longTermKey = 'memory_long_term';
        this.enabled = true;
        this.backupKeys = ['memory_long_term', 'chat_history_persistent', 'library_metadata_index'];
    }

    /**
     * Get today's short-term memory key
     */
    getTodayKey() {
        const today = new Date().toISOString().split('T')[0];
        return `memory_short_${today}`;
    }

    /**
     * Initialize/Load memory system
     */
    async init() {
        console.log('[MemoryAgent] Initializing...');
        // Ensure long-term memory exists
        const data = await window.appStorage.get(this.longTermKey);
        if (!data[this.longTermKey]) {
            await window.appStorage.set({
                [this.longTermKey]: '# MEMORY.md\n\n> This file contains long-term facts about the user, their preferences, and active projects.\n\n'
            });
        }

        // Start periodic backup loop
        this.startBackupService();
    }

    /**
     * Periodically syncs white-listed chrome.storage.local keys to IDB
     */
    startBackupService() {
        if (this._backupInterval) return;

        // Run first backup immediately
        this.performIDBBackup();

        // Every 5 minutes (300,000ms) perform a sync while the window is active
        this._backupInterval = setInterval(() => {
            this.performIDBBackup();
        }, 300000);
    }

    async performIDBBackup() {
        if (!window.idb) return;
        console.log('[MemoryAgent] Performing periodic IDB backup...');
        try {
            const data = await window.appStorage.get(this.backupKeys);
            for (const [key, val] of Object.entries(data)) {
                await window.idb.set(`backup_${key}`, val);
            }
            await window.idb.set('last_idb_backup_ts', Date.now());

            // NEW: After backup, check if we need to compact memory
            this.checkMemoryCompaction();
        } catch (e) {
            console.warn('[MemoryAgent] IDB Backup failed:', e);
        }
    }

    /**
     * Check if memory is too bloated and needs AI summarizing
     */
    async checkMemoryCompaction() {
        const res = await window.appStorage.get(this.longTermKey);
        const content = res[this.longTermKey] || "";

        // If > 20,000 chars (roughly 100-200 entries), trigger compaction
        if (content.length > 20000) {
            console.log('[MemoryAgent] Memory bloat detected. Initializing AI Compaction...');
            this.compactMemory(content);
        }
    }

    async compactMemory(content) {
        if (!window.aiCore) return;

        const compactionPrompt = `
You are the Memory Architect. The current Long-term Memory file is getting too large. 
Your task is to summarize and deduplicate the historical facts without losing core user identity and project info.
Combine related chronological logs into single high-level facts.

Current MEMORY.md Content:
${content}

Return the NEW, compacted MEMORY.md content (Markdown). Keep it under 50% of the original size.
`;

        try {
            const compacted = await window.aiCore.generateText(compactionPrompt);
            if (compacted && compacted.length > 500) {
                await window.appStorage.set({ [this.longTermKey]: compacted });
                console.log('[MemoryAgent] Memory Compacted successfully.');
                if (typeof showToast === 'function') showToast('🧠 Memory Optimized');
            }
        } catch (e) {
            console.warn('[MemoryAgent] Compaction failed:', e);
        }
    }
    /**
     * Update Memory based on an interaction
     * This is called AFTER the AI responds to the user.
     * @param {string} userQuery 
     * @param {string} aiResponse 
     */
    async processInteraction(userQuery, aiResponse) {
        if (!this.enabled || !window.aiCore) return;

        // 1. Analyze if we should save this + Extract Semantic Tags
        const validationPrompt = `
You are the Memory Manager for an AI Assistant. 
Analyze the following interaction to decide if it contains **new, valuable information** worth remembering.
ignore: casual chit-chat, simple greetings, or temporary questions.

Interaction:
User: "${userQuery}"
AI: "${aiResponse.substring(0, 500)}..."

Criteria:
- **Long-term**: User preferences, project definitions, career info, core beliefs.
- **Short-term**: Specific decisions made today, progress on tasks, unique ideas.

If saving, extract 3-5 **Semantic Tags**. 
Tags should include: 
- Broad topics (e.g., "Management")
- Specific entities (e.g., "Drucker")
- Implicit themes (e.g., "Leadership Style" even if the word wasn't used)

Return JSON only:
{
    "save": boolean,
    "type": "long" | "short",
    "content": "concise fact or summary (markdown)",
    "tags": ["tag1", "tag2", ...]
}`;

        try {
            const decision = await window.aiCore.generateJSON(validationPrompt, '{ "save": boolean, "type": "long"|"short", "content": "string", "tags": [] }');

            if (decision && decision.save && decision.content) {
                await this.saveMemory(decision.type, decision.content, decision.tags || []);
                console.log(`[MemoryAgent] Saved ${decision.type} memory with tags:`, decision.tags);
                if (typeof showToast === 'function') showToast(`🧠 Memory Linked`);

                // Immediately backup after important changes
                this.performIDBBackup();
            }
        } catch (e) {
            console.warn('[MemoryAgent] Auto-save failed:', e);
        }
    }

    /**
     * Commit memory to storage
     */
    async saveMemory(type, content, tags = []) {
        const key = type === 'long' ? this.longTermKey : this.getTodayKey();
        const res = await window.appStorage.get(key);
        let current = res[key] || (type === 'long' ? '# MEMORY.md\n' : `# Memory Log ${new Date().toLocaleDateString()}\n`);

        const timestamp = new Date().toLocaleTimeString();
        // Native Format: - [Time] [Tags: t1, t2] Content
        const tagStr = tags.length > 0 ? ` [Tags: ${tags.join(', ')}]` : '';
        const entry = `\n- [${timestamp}]${tagStr} ${content}`;

        await window.appStorage.set({ [key]: current + entry });

        // NEW: If short-term, update the Mid-term Index in MEMORY.md
        if (type === 'short') {
            await this.updateMidTermIndex(tags, content);
        }
    }

    /**
     * Update the index section in MEMORY.md to prevent memory fragmentation
     */
    async updateMidTermIndex(tags, content) {
        const res = await window.appStorage.get(this.longTermKey);
        let longTermContent = res[this.longTermKey] || '# MEMORY.md\n';

        const todayStr = new Date().toISOString().split('T')[0];
        const indexHeader = '\n## 🧠 中期索引 (Mid-term Index)';

        if (!longTermContent.includes(indexHeader)) {
            longTermContent += `\n${indexHeader}\n> 这个区域存储了每日碎片的索引，用于跨日期检索。\n`;
        }

        const tagStr = tags.length > 0 ? ` [Tags: ${tags.join(', ')}]` : '';
        const summary = content.substring(0, 50).replace(/\n/g, ' ') + (content.length > 50 ? '...' : '');
        const indexEntry = `- [${todayStr}]${tagStr} ${summary}`;

        // Add to the top of Index section for recency
        const sections = longTermContent.split(indexHeader);
        longTermContent = sections[0] + indexHeader + '\n' + indexEntry + '\n' + sections[1].trim();

        await window.appStorage.set({ [this.longTermKey]: longTermContent });
        console.log('[MemoryAgent] Mid-term Index updated for', todayStr);
    }

    /**
     * Retrieve relevant context for a query
     * Simulates "Hybrid Search" (Keyword + Semantic Tagging)
     */
    async retrieveContext(query) {
        const longTerm = await window.appStorage.get(this.longTermKey);
        const todayKey = this.getTodayKey();
        const shortTerm = await window.appStorage.get(todayKey);

        const memoryPool = [
            { source: 'Long-term', content: longTerm[this.longTermKey] || '' },
            { source: 'Today', content: shortTerm[todayKey] || '' }
        ];

        const keywords = query.toLowerCase().match(/[\w\u4e00-\u9fa5]+/g) || [];
        let relevantChunks = [];

        memoryPool.forEach(doc => {
            const lines = doc.content.split('\n');
            lines.forEach(line => {
                if (!line.trim() || line.startsWith('#')) return;

                let score = 0;
                const lowerLine = line.toLowerCase();

                // Extraction: Check if line has [Tags: ...]
                const tagMatch = line.match(/\[Tags: (.*?)\]/);
                const tags = tagMatch ? tagMatch[1].toLowerCase() : "";

                keywords.forEach(kw => {
                    // Tag match gets higher weight (Semantic hit)
                    if (tags.includes(kw)) score += 3;
                    // Content match
                    if (lowerLine.includes(kw)) score += 1;
                });

                if (score > 1) {
                    relevantChunks.push({
                        source: doc.source,
                        content: line.replace(/\[Tags: .*?\]/, '').trim(), // Clean for AI eye
                        score: score
                    });
                }
            });
        });

        // 3. Sort by score
        relevantChunks.sort((a, b) => b.score - a.score);

        // 4. Take top 5
        const topMemories = relevantChunks.slice(0, 10);

        if (topMemories.length === 0) return "";

        return topMemories.map(m => `[${m.source}] ${m.content}`).join('\n');
    }

    showToast(msg) {
        // reuse existing toast if available or log
        // implementation depends on ui-utils
    }
}

// Singleton
window.memoryAgent = new MemoryAgent();
console.log('MemoryAgent loaded');
