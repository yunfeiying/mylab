/**
 * tool-dispatcher.js
 * The "Hand" of the AI Agent. Parses AI responses for action directives
 * and executes them against the UI/Data layer.
 * 
 * Protocol: AI outputs JSON block or special markdown tag like:
 * [[ACTION:INSERT_TABLE|{"data":...}]]
 */

class ToolDispatcher {
    constructor() {
        this.tools = new Map();
        this.registerDefaultTools();
    }

    registerDefaultTools() {
        // 1. Table Creator
        this.register('INSERT_TABLE', async (args) => {
            console.log('[ToolDispatcher] Executing INSERT_TABLE', args);
            if (window.smartTable && args.data) {
                // Find the active block or append
                const editor = document.getElementById('note-body');
                if (!editor) return;

                // If it's a simple headers/rows format
                if (args.headers && args.rows) {
                    window.smartTable.createTableAtCursor(args.headers, args.rows);
                } else {
                    // Fallback to raw data handling if implemented
                    window.smartTable.createTableFromData(args.data);
                }
                if (typeof showToast === 'function') showToast('AI Created a Table');
            }
        });

        // 2. Task List Extractor
        this.register('ADD_TODO', async (args) => {
            console.log('[ToolDispatcher] Executing ADD_TODO', args);
            const editor = document.getElementById('note-body');
            if (!editor || !args.tasks) return;

            const todoHtml = args.tasks.map(t => `<div class="todo-item"><input type="checkbox"> <span>${t}</span></div>`).join('');
            document.execCommand('insertHTML', false, `<div class="ai-todo-group">${todoHtml}</div><p></p>`);
        });

        // 3. Memory Committer (Manual trigger from AI)
        this.register('UPDATE_CORE_MEMORY', async (args) => {
            if (window.memoryAgent && args.fact) {
                await window.memoryAgent.saveMemory('long', args.fact, args.tags || []);
                if (typeof showToast === 'function') showToast('Core Memory Updated');
            }
        });
    }

    register(name, fn) {
        this.tools.set(name, fn);
    }

    /**
     * Scan text for action patterns and execute them
     * Patterns: 
     * 1. [[ACTION:NAME|JSON_ARGS]]
     * 2. JSON blocks if requested specifically
     */
    async dispatch(text) {
        if (!text) return;

        // Pattern: [[ACTION:NAME|{...}]]
        const regex = /\[\[ACTION:(\w+)\|(.*?)\]\]/g;
        let match;

        while ((match = regex.exec(text)) !== null) {
            const toolName = match[1];
            const rawArgs = match[2];

            try {
                const args = JSON.parse(rawArgs);
                if (this.tools.has(toolName)) {
                    await this.tools.get(toolName)(args);
                } else {
                    console.warn(`[ToolDispatcher] Unknown tool: ${toolName}`);
                }
            } catch (e) {
                console.error(`[ToolDispatcher] Failed to parse args for ${toolName}:`, e);
            }
        }
    }
}

// Global Singleton
window.toolDispatcher = new ToolDispatcher();
console.log('[ToolDispatcher] Ready to execute AI instructions');
