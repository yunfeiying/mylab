/**
 * AI Mindmap Module
 * 
 * Generates visual tree structures (mindmaps) using AI.
 * 
 * @module options/modules/mindmap
 * @version 1.0.0
 */

const MindmapModule = {
    name: 'mindmap',
    commands: ['/ai:mindmap', '/mindmap'],
    commandDescriptions: {
        '/ai:mindmap': 'Generate an AI mindmap for a topic',
        '/mindmap': 'Create a basic mindmap structure'
    },

    async init() {
        console.log('[MindmapModule] Initialized');
    },

    async handleCommand(command, args, context) {
        if (!args && command === '/ai:mindmap') {
            return { success: false, error: 'Please provide a topic' };
        }

        const prompt = `Generate a hierarchical mindmap structure for: ${args}. 
        Return ONLY valid JSON in this format:
        {
          "label": "Root Topic",
          "children": [
            {
              "label": "Subtopic 1",
              "children": [{ "label": "Detail 1.1" }, ...]
            },
            ...
          ]
        }
        Limit to 3 levels deep and max 4 branches per level for clarity.`;

        try {
            let data;
            if (command === '/mindmap') {
                data = { label: args || 'Main Topic', children: [{ label: 'Subtopic' }] };
            } else {
                data = await window.aiCore.generateJSON(prompt, 'Hierarchical object');
            }

            if (!data || !data.label) {
                throw new Error('Invalid AI response format');
            }

            return {
                success: true,
                html: this._renderMindmap(data),
                message: `Generated mindmap for ${data.label}`
            };
        } catch (e) {
            console.error('[MindmapModule] AI Error:', e);
            return { success: false, error: 'Failed to generate mindmap: ' + e.message };
        }
    },

    _renderMindmap(node, level = 0) {
        let html = '';
        if (level === 0) {
            html += `<div class="mindmap-container">`;
        }

        html += `
            <div class="mindmap-node level-${level}">
                <div class="node-content" contenteditable="true">${node.label}</div>
                ${node.children && node.children.length > 0 ? `
                    <div class="node-children">
                        ${node.children.map(child => this._renderMindmap(child, level + 1)).join('')}
                    </div>
                ` : ''}
            </div>
        `;

        if (level === 0) {
            html += `</div>`;
        }
        return html;
    }
};

if (typeof window !== 'undefined') {
    window.MindmapModule = MindmapModule;
}
