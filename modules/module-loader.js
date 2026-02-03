/**
 * Module Loader - Command Router & Module Manager
 * 
 * This module handles:
 * - Loading and initializing feature modules
 * - Routing commands to appropriate modules
 * - Managing module lifecycle
 * 
 * @module options/modules/module-loader
 * @version 1.0.0
 */

// ---------------------------------------------------------
// Module Registry
// ---------------------------------------------------------

class ModuleRegistry {
    constructor() {
        this.modules = new Map();
        this.commandMap = new Map();
        this.initialized = false;
    }

    /**
     * Register a module
     * @param {Object} module - Module object with name, commands, handleCommand, etc.
     */
    register(module) {
        if (!module.name) {
            console.error('[ModuleLoader] Module must have a name');
            return;
        }

        this.modules.set(module.name, module);

        // Register commands
        if (module.commands && Array.isArray(module.commands)) {
            module.commands.forEach(cmd => {
                this.commandMap.set(cmd.toLowerCase(), module.name);
            });
        }

        console.log(`[ModuleLoader] Registered module: ${module.name}`);
    }

    /**
     * Get a module by name
     * @param {string} name - Module name
     * @returns {Object|undefined} The module
     */
    get(name) {
        return this.modules.get(name);
    }

    /**
     * Get module by command
     * @param {string} command - Command string (e.g., '/remind')
     * @returns {Object|undefined} The module
     */
    getByCommand(command) {
        const moduleName = this.commandMap.get(command.toLowerCase());
        return moduleName ? this.modules.get(moduleName) : undefined;
    }

    /**
     * Get all registered modules
     * @returns {Array} Array of modules
     */
    getAll() {
        return Array.from(this.modules.values());
    }

    /**
     * Initialize all modules
     * @returns {Promise<void>}
     */
    async initAll() {
        if (this.initialized) return;

        for (const [name, module] of this.modules) {
            try {
                if (typeof module.init === 'function') {
                    await module.init();
                    console.log(`[ModuleLoader] Initialized: ${name}`);
                }
            } catch (e) {
                console.error(`[ModuleLoader] Failed to init ${name}:`, e);
            }
        }

        this.initialized = true;
    }

    /**
     * Destroy all modules
     */
    destroyAll() {
        for (const [name, module] of this.modules) {
            try {
                if (typeof module.destroy === 'function') {
                    module.destroy();
                }
            } catch (e) {
                console.error(`[ModuleLoader] Failed to destroy ${name}:`, e);
            }
        }
        this.initialized = false;
    }
}

// ---------------------------------------------------------
// Command Parser
// ---------------------------------------------------------

class CommandParser {
    /**
     * Parse a command string
     * @param {string} text - Raw text (e.g., "/remind 30min 喝水")
     * @returns {Object|null} Parsed command { command, subCommand, args, raw }
     */
    static parse(text) {
        if (!text || !text.startsWith('/')) return null;

        const trimmed = text.trim();

        // Match pattern: /command:subCommand args
        // or: /command args
        const match = trimmed.match(/^\/(\w+)(?::(\w+))?(?:[:：\s]+(.*))?$/i);

        if (!match) return null;

        return {
            command: `/${match[1].toLowerCase()}`,
            subCommand: match[2] ? match[2].toLowerCase() : null,
            args: match[3] ? match[3].trim() : '',
            raw: trimmed
        };
    }

    /**
     * Check if text is a command
     * @param {string} text - Text to check
     * @returns {boolean}
     */
    static isCommand(text) {
        return text && text.trim().startsWith('/');
    }

    /**
     * Get all known commands with descriptions
     * @param {ModuleRegistry} registry - Module registry
     * @returns {Array} Array of { command, description, module }
     */
    static getCommandHelp(registry) {
        const help = [];

        for (const module of registry.getAll()) {
            if (module.commands) {
                module.commands.forEach(cmd => {
                    help.push({
                        command: cmd,
                        description: module.commandDescriptions?.[cmd] || '',
                        module: module.name
                    });
                });
            }
        }

        return help.sort((a, b) => a.command.localeCompare(b.command));
    }
}

// ---------------------------------------------------------
// Module Loader (Main Orchestrator)
// ---------------------------------------------------------

class ModuleLoader {
    constructor() {
        this.registry = new ModuleRegistry();
        this.context = {};
    }

    /**
     * Set context for modules (e.g., current note ID, editor element)
     * @param {Object} ctx - Context object
     */
    setContext(ctx) {
        this.context = { ...this.context, ...ctx };
    }

    /**
     * Register a module
     * @param {Object} module - Module to register
     */
    register(module) {
        this.registry.register(module);
    }

    /**
     * Initialize all modules
     * @returns {Promise<void>}
     */
    async init() {
        await this.registry.initAll();
    }

    /**
     * Handle a command
     * @param {string} text - Command text
     * @param {Object} context - Additional context
     * @returns {Promise<Object>} Result { handled, result, error }
     */
    async handleCommand(text, context = {}) {
        const parsed = CommandParser.parse(text);

        if (!parsed) {
            return { handled: false, error: 'Invalid command format' };
        }

        // Build full command for lookup
        const lookupCmd = parsed.subCommand
            ? `${parsed.command}:${parsed.subCommand}`
            : parsed.command;

        // Try to find exact match first, then base command
        let module = this.registry.getByCommand(lookupCmd);
        if (!module) {
            module = this.registry.getByCommand(parsed.command);
        }

        if (!module) {
            return {
                handled: false,
                error: `Unknown command: ${parsed.command}`
            };
        }

        if (typeof module.handleCommand !== 'function') {
            return {
                handled: false,
                error: `Module ${module.name} does not handle commands`
            };
        }

        try {
            const mergedContext = { ...this.context, ...context };
            const result = await module.handleCommand(
                parsed.command,
                parsed.args,
                mergedContext,
                parsed.subCommand
            );

            return { handled: true, result };
        } catch (e) {
            console.error(`[ModuleLoader] Command error:`, e);
            return { handled: false, error: e.message };
        }
    }

    /**
     * Check if text is a known command
     * @param {string} text - Text to check
     * @returns {boolean}
     */
    isKnownCommand(text) {
        const parsed = CommandParser.parse(text);
        if (!parsed) return false;

        return !!this.registry.getByCommand(parsed.command);
    }

    /**
     * Get command help
     * @returns {Array} Command help array
     */
    getHelp() {
        return CommandParser.getCommandHelp(this.registry);
    }

    /**
     * Notify all modules of an event
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    broadcast(event, data) {
        for (const module of this.registry.getAll()) {
            const handler = module[`on${event.charAt(0).toUpperCase()}${event.slice(1)}`];
            if (typeof handler === 'function') {
                try {
                    handler.call(module, data);
                } catch (e) {
                    console.error(`[ModuleLoader] Event broadcast error:`, e);
                }
            }
        }
    }
}

// ---------------------------------------------------------
// Default Modules (Built-in Commands)
// ---------------------------------------------------------

/**
 * Help Module - Shows available commands
 */
const HelpModule = {
    name: 'help',
    commands: ['/help', '/commands'],
    commandDescriptions: {
        '/help': 'Show available commands',
        '/commands': 'List all commands'
    },

    init() { },

    handleCommand(command, args, context) {
        const loader = context.moduleLoader;
        if (!loader) {
            return { success: false, error: 'No loader in context' };
        }

        const commands = loader.getHelp();
        let html = '<div class="command-help">';
        html += '<strong>Available Commands:</strong><br><br>';

        commands.forEach(cmd => {
            html += `<code>${cmd.command}</code>`;
            if (cmd.description) {
                html += ` - ${cmd.description}`;
            }
            html += '<br>';
        });

        html += '</div>';

        return { success: true, html };
    }
};

// ---------------------------------------------------------
// Exports
// ---------------------------------------------------------

// Create singleton instance
const moduleLoader = new ModuleLoader();

// Register built-in modules
moduleLoader.register(HelpModule);

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ModuleLoader,
        ModuleRegistry,
        CommandParser,
        moduleLoader,
        HelpModule
    };
}

// Export for browser global scope
if (typeof window !== 'undefined') {
    window.ModuleLoader = ModuleLoader;
    window.ModuleRegistry = ModuleRegistry;
    window.CommandParser = CommandParser;
    window.moduleLoader = moduleLoader;
}
