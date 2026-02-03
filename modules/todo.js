/**
 * Smart Todo Module
 * 
 * Generates actionable todo lists using AI.
 * 
 * @module options/modules/todo
 * @version 1.0.0
 */

const TodoModule = {
    name: 'todo',
    commands: ['/ai:todo', '/todo'],
    commandDescriptions: {
        '/ai:todo': 'Generate an AI-powered todo list for a topic',
        '/todo': 'Create an empty todo list'
    },

    async init() {
        console.log('[TodoModule] Initialized');
    },

    async handleCommand(command, args, context) {
        if (!args && command === '/ai:todo') {
            return { success: false, error: 'Please provide a topic (e.g., /ai:todo Launching a podcast)' };
        }

        if (command === '/todo') {
            return {
                success: true,
                html: this._renderEmptyTodo()
            };
        }

        // Handle AI Todo
        const prompt = `Generate a comprehensive, actionable todo list for: ${args}. 
        Format as a JSON array of strings. Each item should be clear and concise.`;

        try {
            const items = await window.aiCore.generateJSON(prompt, 'Array of strings');

            if (!items || !Array.isArray(items)) {
                throw new Error('Invalid AI response format');
            }

            return {
                success: true,
                html: this._renderTodoItems(items, args),
                message: `Generated ${items.length} tasks for ${args}`
            };
        } catch (e) {
            console.error('[TodoModule] AI Error:', e);
            return { success: false, error: 'Failed to generate todo list: ' + e.message };
        }
    },

    _renderTodoItems(items, title) {
        let html = `
            <div class="todo-container">
                <div class="todo-header">
                    <span class="todo-icon">✅</span>
                    <span class="todo-title">Tasks: ${title}</span>
                </div>
                <div class="todo-list">
        `;

        items.forEach((item, index) => {
            html += `
                <div class="todo-item">
                    <input type="checkbox" id="todo-${Date.now()}-${index}">
                    <label for="todo-${Date.now()}-${index}">${item}</label>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
        return html;
    },

    _renderEmptyTodo() {
        return `
            <div class="todo-container">
                <div class="todo-header">
                    <span class="todo-icon">✅</span>
                    <span class="todo-title">Tasks</span>
                </div>
                <div class="todo-list">
                    <div class="todo-item">
                        <input type="checkbox">
                        <label contenteditable="true">New Task...</label>
                    </div>
                </div>
            </div>
        `;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TodoModule };
}

if (typeof window !== 'undefined') {
    window.TodoModule = TodoModule;
}
