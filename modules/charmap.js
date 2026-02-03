/**
 * Character Map Module
 * 
 * Manages character extraction, relationship mapping, and persistence.
 * 
 * @module options/modules/charmap
 */

const CharacterMapModule = {
    name: 'charmap',
    commands: ['/ai:charmap', '/ai:characters'],
    commandDescriptions: {
        '/ai:charmap': 'Generate/Update a visual character relationship map',
        '/ai:characters': 'List and analyze characters in the current story'
    },

    async init() {
        console.log('[CharacterMapModule] Initialized');
    },

    /**
     * Handle commands
     */
    async handleCommand(command, args, context) {
        const { noteId, fullText, block } = context;
        if (!fullText || fullText.length < 50) {
            return { success: false, error: 'Not enough content to analyze characters.' };
        }

        const prompt = `Analyze the following story content and extract a comprehensive character map.
        Identify:
        1. Character names
        2. Their roles/traits
        3. Their relationships to other characters.
        
        STORY CONTENT:
        ${fullText.substring(0, 10000)}

        Return ONLY a JSON object in this format:
        {
          "characters": [
            { "id": "char1", "name": "Name", "description": "Traits...", "relations": [{ "target": "char2", "type": "Relationship" }] }
          ]
        }`;

        try {
            const data = await window.aiCore.generateJSON(prompt, 'Character Graph JSON');
            if (!data || !data.characters) throw new Error('Invalid character data format');

            // Store metadata back to note if possible (via helper function in notes.js)
            if (window.updateNoteMetadata) {
                await window.updateNoteMetadata(noteId, { characters: data.characters });
            }

            return {
                success: true,
                html: this._renderCharacterMap(data.characters),
                message: `Character map analyzed and updated for ${data.characters.length} characters.`
            };
        } catch (e) {
            console.error('[CharacterMapModule] Error:', e);
            return { success: false, error: 'Character analysis failed: ' + e.message };
        }
    },

    /**
     * Visual rendering for characters
     */
    _renderCharacterMap(characters) {
        let html = '<div class="charmap-container" style="border:1px solid #e2e8f0; border-radius:12px; padding:16px; background:#f8fafc; margin:10px 0;">';
        html += '<h3 style="margin-top:0; color:#1e293b; display:flex; align-items:center; gap:8px;">👥 Character Relationship Map</h3>';

        html += '<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:12px;">';

        characters.forEach(char => {
            html += `
                <div class="char-card" style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:12px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                    <div style="font-weight:700; color:#4f46e5; margin-bottom:4px;">${char.name}</div>
                    <div style="font-size:11px; color:#64748b; margin-bottom:8px;">${char.description || 'No description'}</div>
                    ${char.relations && char.relations.length > 0 ? `
                        <div style="border-top:1px solid #f1f5f9; padding-top:6px;">
                            ${char.relations.map(rel => `
                                <div style="font-size:10px; color:#475569;">
                                    <span style="color:#94a3b8;">→</span> ${rel.type}: <b>${rel.target}</b>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        });

        html += '</div></div>';
        return html;
    }
};

if (typeof window !== 'undefined') {
    window.CharacterMapModule = CharacterMapModule;
}
