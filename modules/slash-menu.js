/**
 * slash-menu.js - 斜杠命令菜单组件
 * 包含: class SlashMenu
 */

/**
 * Slash Command Menu - Floating UI for command suggestions
 */
class SlashMenu {
    constructor(editor) {
        this.editor = editor;
        this.el = null;
        this.active = false;
        this.commands = [];
        this.filteredCommands = [];
        this.selectedIndex = 0;
        this.query = '';

        this.init();
    }

    init() {
        const rawCommands = window.moduleLoader ? window.moduleLoader.getHelp() : [];
        // Filter out irrelevant commands for this context
        this.commands = rawCommands.filter(cmd =>
            cmd.command !== '/folder' &&
            cmd.command !== '/commands' &&
            cmd.command !== '/help'
        );

        // Utility Commands
        const utils = [
            { command: '/image', description: 'Insert an image' },
            { command: '/divider', description: 'Insert a divider' }
        ];

        // Add both direct and /ai prefixed versions
        utils.forEach(u => {
            this.commands.push(u);
            this.commands.push({
                command: u.command.replace('/', '/ai '),
                description: u.description
            });
        });

        // Add AI Skills
        if (window.AISkills) {
            window.AISkills.forEach(skill => {
                this.commands.push({
                    command: `/ai:${skill.id}`,
                    description: skill.description,
                    icon: skill.icon,
                    isSkill: true
                });
            });
        }

        this.editor.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.editor.addEventListener('input', (e) => this.handleInput(e));

        // Close menu on click elsewhere
        document.addEventListener('mousedown', (e) => {
            if (this.el && !this.el.contains(e.target)) {
                this.hide();
            }
        });
    }

    show() {
        if (this.active) return;

        this.el = document.createElement('div');
        this.el.className = 'slash-menu';
        document.body.appendChild(this.el);

        this.active = true;
        this.selectedIndex = 0;
        this.query = '';
        this.updatePosition();
        this.render();
    }

    hide() {
        if (!this.active) return;
        if (this.el) {
            this.el.remove();
            this.el = null;
        }
        this.active = false;
    }

    updatePosition() {
        if (!this.el) return;

        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0).cloneRange();

        // Create a temporary span to measure the exact caret position
        const marker = document.createElement('span');
        marker.textContent = '\u200b'; // Zero-width space
        range.insertNode(marker);

        const rect = marker.getBoundingClientRect();

        // Remove marker immediately
        marker.parentNode.removeChild(marker);

        // Position fixed relative to viewport for maximum reliability
        this.el.style.position = 'fixed';
        this.el.style.top = `${rect.bottom + 8}px`;
        this.el.style.left = `${rect.left}px`;

        // Check if it goes off bottom
        const menuRect = this.el.getBoundingClientRect();
        if (menuRect.bottom > window.innerHeight) {
            // Flip up if no space below
            this.el.style.top = `${rect.top - menuRect.height - 8}px`;
        }

        // Check if it goes off right
        if (rect.left + 240 > window.innerWidth) {
            this.el.style.left = `${window.innerWidth - 260}px`;
        }
    }

    getCaretRect() {
        return null; // Deprecated
    }

    handleInput(e) {
        // Detect "/" at the start of a line or after a space
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const textBefore = range.startContainer.textContent.substring(0, range.startOffset);

        if (textBefore.endsWith('/')) {
            this.show();
        } else if (this.active) {
            // Update query based on text after last /
            const lastSlash = textBefore.lastIndexOf('/');
            if (lastSlash === -1) {
                this.hide();
            } else {
                this.query = textBefore.substring(lastSlash + 1);
                this.render();
            }
        }
    }

    handleKeyDown(e) {
        if (!this.active) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectedIndex = (this.selectedIndex + 1) % this.filteredCommands.length;
                this.render();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.selectedIndex = (this.selectedIndex - 1 + this.filteredCommands.length) % this.filteredCommands.length;
                this.render();
                break;
            case 'Enter':
            case 'Tab':
                e.preventDefault();
                this.selectCommand();
                break;
            case 'Escape':
                e.preventDefault();
                this.hide();
                break;
            case 'Backspace':
                // Handled by input event mostly, but if we delete the /, hide it
                break;
        }
    }

    render() {
        if (!this.el) return;

        // Filter commands based on query
        this.filteredCommands = this.commands.filter(cmd =>
            cmd.command.toLowerCase().includes(this.query.toLowerCase())
        );

        if (this.filteredCommands.length === 0) {
            this.hide();
            return;
        }

        // Handle index bounds safety
        if (this.selectedIndex >= this.filteredCommands.length) {
            this.selectedIndex = 0;
        }

        let html = '';
        this.filteredCommands.forEach((cmd, idx) => {
            const isActive = idx === this.selectedIndex;
            const icon = cmd.icon || this.getIconForCommand(cmd.command);
            html += `
                <div class="slash-menu-item ${isActive ? 'active' : ''}" data-index="${idx}">
                    <div class="slash-menu-icon">${icon}</div>
                    <div class="slash-menu-content">
                        <div class="slash-menu-name">${cmd.command}</div>
                        <div class="slash-menu-desc">${cmd.description || ''}</div>
                    </div>
                </div>
            `;
        });

        this.el.innerHTML = html;

        // Add click listeners
        this.el.querySelectorAll('.slash-menu-item').forEach(item => {
            item.onclick = () => {
                this.selectedIndex = parseInt(item.dataset.index);
                this.selectCommand();
            };
        });

        // Ensure selected item is visible
        const activeItem = this.el.querySelector('.slash-menu-item.active');
        if (activeItem) {
            activeItem.scrollIntoView({ block: 'nearest' });
        }
    }

    selectCommand() {
        const cmd = this.filteredCommands[this.selectedIndex];
        if (!cmd) return;

        // Replace the "/query" with nothing, then trigger command
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        const node = range.startContainer;

        // Find the start of the command (the /)
        const textContent = node.textContent;
        const textBefore = textContent.substring(0, range.startOffset);
        const lastSlash = textBefore.lastIndexOf('/');

        if (lastSlash !== -1) {
            // Delete the "/query" part
            const newRange = document.createRange();
            newRange.setStart(node, lastSlash);
            newRange.setEnd(node, range.startOffset);
            newRange.deleteContents();

            // Focus and trigger
            this.editor.focus();

            const cleanCmd = cmd.command.replace('/ai ', '/');
            if (cleanCmd === '/image') {
                triggerImageUpload();
            } else if (cleanCmd === '/divider') {
                insertDivider();
            } else {
                let cmdText = cmd.command;
                // Add separator based on command type
                if (cmd.isSkill) {
                    cmdText += ': ';
                } else if (cmd.description && cmd.description.includes('topic')) {
                    cmdText += ': ';
                } else {
                    cmdText += ' ';
                }
                document.execCommand('insertText', false, cmdText);
            }
        }

        this.hide();
    }

    getIconForCommand(cmd) {
        if (cmd.includes('todo')) return '✅';
        if (cmd.includes('table')) return '📊';
        if (cmd.includes('mindmap')) return '🧠';
        if (cmd.includes('calendar')) return '📅';
        if (cmd.includes('remind')) return '⏰';
        if (cmd.includes('image')) return '🖼️';
        if (cmd.includes('divider')) return '➖';
        if (cmd.includes('ppt')) return '📽️';
        if (cmd.includes('report')) return '📄';
        if (cmd.includes('bento')) return '🍱';
        if (cmd.includes('steps')) return '🐾';
        if (cmd.includes('charmap') || cmd.includes('character')) return '👥';
        if (cmd.includes('ai')) return '✨';
        return '🔹';
    }
}

// Export to global scope
window.SlashMenu = SlashMenu;

console.log('[slash-menu.js] Loaded: SlashMenu class');
