/**
 * Smart Table Module
 * 
 * Generates structured HTML tables using AI.
 * 
 * @module options/modules/smart-table
 * @version 1.0.0
 */

const SmartTableModule = {
    name: 'smart-table',
    commands: ['/ai:table', '/table'],
    commandDescriptions: {
        '/ai:table': 'Generate a structured table via AI (e.g., /ai:table comparison of iPhone 15 vs 16)',
        '/table': 'Insert an empty 3x3 table'
    },

    async init() {
        console.log('[SmartTableModule] Initialized');
    },

    async handleCommand(command, args, context) {
        if (command === '/table') {
            return {
                success: true,
                html: this._renderEmptyTable(3, 3)
            };
        }

        if (!args) {
            return { success: false, error: 'Please provide table description' };
        }

        const prompt = `Generate a structured table about: ${args}. 
        Return ONLY a JSON object with:
        {
          "title": "Table Title",
          "headers": ["Col 1", "Col 2", ...],
          "rows": [
            ["Row 1 Col 1", "Row 1 Col 2", ...],
            ...
          ]
        }`;

        try {
            const data = await window.aiCore.generateJSON(prompt, 'Object with title, headers, rows');

            if (!data || !data.headers || !data.rows) {
                throw new Error('Invalid AI response format');
            }

            return {
                success: true,
                html: this._renderTable(data),
                message: `Generated table: ${data.title}`
            };
        } catch (e) {
            console.error('[SmartTableModule] AI Error:', e);
            return { success: false, error: 'Failed to generate table: ' + e.message };
        }
    },

    _renderTable(data) {
        let html = `
            <div class="smart-table-container">
                ${data.title ? `<div class="table-title">${data.title}</div>` : ''}
                <table class="smart-table">
                    <thead>
                        <tr>
                            ${data.headers.map(h => `<th>${h}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${data.rows.map(row => `
                            <tr>
                                ${row.map(cell => `<td contenteditable="true">${cell}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        return html;
    },

    _renderEmptyTable(cols, rows) {
        const headers = Array(cols).fill('Header');
        const rowData = Array(rows).fill(Array(cols).fill('...'));
        return this._renderTable({ title: 'New Table', headers, rows: rowData });
    }
};

if (typeof window !== 'undefined') {
    window.SmartTableModule = SmartTableModule;
}
