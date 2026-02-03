/**
 * Visual Modules - Slash commands for premium layouts
 * 
 * Maps commands like /bento and /timeline to VisualComponents rendering.
 * 
 * @module options/modules/visual-modules
 * @version 1.0.0
 */

const VisualModule = {
    name: 'visual',
    commands: ['/ai:bento', '/ai:timeline', '/ai:steps'],
    commandDescriptions: {
        '/ai:bento': 'AI-assisted Bento Grid (e.g., /ai:bento feature1, feature2, ...)',
        '/ai:timeline': 'AI-assisted Timeline (e.g., /ai:timeline phase1: intro, phase2: development, ...)',
        '/ai:steps': 'AI-assisted Step Progress'
    },

    async init() {
        console.log('[VisualModule] Initialized');
    },

    async handleCommand(command, args, context) {
        if (!args) {
            return { success: false, error: 'Please provide content or a topic' };
        }

        // Remove /ai: prefix for prompt logic
        const type = command.replace('/ai:', '');
        const prompt = `Generate a structured list for a ${type} layout based on: ${args}. 
        Return ONLY valid JSON array of objects: [{ "title": "...", "desc": "..." }].
        Max 4 items.`;

        try {
            const items = await window.aiCore.generateJSON(prompt, 'Array of {title, desc}');

            if (!items || !Array.isArray(items)) {
                throw new Error('Invalid AI response format');
            }

            let html = '';
            switch (command) {
                case '/ai:bento':
                    html = window.VisualComponents.renderBento(items);
                    break;
                case '/ai:timeline':
                    html = window.VisualComponents.renderTimeline(items);
                    break;
                case '/ai:steps':
                    html = window.VisualComponents.renderSteps(items);
                    break;
            }

            return {
                success: true,
                html: html,
                message: `Generated ${command} layout`
            };
        } catch (e) {
            console.error('[VisualModule] Error:', e);
            return { success: false, error: 'Failed to generate layout: ' + e.message };
        }
    }
};

if (typeof window !== 'undefined') {
    window.VisualModule = VisualModule;
}
