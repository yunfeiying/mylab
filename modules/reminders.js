/**
 * Reminders Module
 * 
 * Provides scheduled reminder functionality with Chrome notifications.
 * Supports one-time and recurring reminders.
 * 
 * @module options/modules/reminders
 * @version 1.0.0
 */

// ---------------------------------------------------------
// Reminder Data Structure
// ---------------------------------------------------------

class ReminderManager {
    constructor() {
        this.reminders = [];
        this.listeners = new Set();
    }

    // ==================== CRUD Operations ====================

    /**
     * Load reminders from storage
     * @returns {Promise<Array>}
     */
    async load() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['reminders'], (result) => {
                this.reminders = result.reminders || [];
                resolve(this.reminders);
            });
        });
    }

    /**
     * Save reminders to storage
     * @returns {Promise<void>}
     */
    async save() {
        return new Promise((resolve) => {
            chrome.storage.local.set({ reminders: this.reminders }, () => {
                this._notify('save');
                resolve();
            });
        });
    }

    /**
     * Create a new reminder
     * @param {string} content - Reminder content
     * @param {number} time - Trigger timestamp
     * @param {Object} options - Additional options
     * @returns {Object} The created reminder
     */
    async createReminder(content, time, options = {}) {
        const reminder = {
            id: `remind-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            content: content.trim(),
            time: time,
            repeat: options.repeat || 'none', // 'none', 'daily', 'weekly'
            noteId: options.noteId || null,
            completed: false,
            createdAt: Date.now()
        };

        this.reminders.push(reminder);
        await this.save();

        // Schedule Chrome alarm
        await this._scheduleAlarm(reminder);

        this._notify('create', reminder);
        return reminder;
    }

    /**
     * Complete a reminder
     * @param {string} reminderId - Reminder ID
     * @returns {Promise<boolean>}
     */
    async completeReminder(reminderId) {
        const reminder = this.reminders.find(r => r.id === reminderId);
        if (!reminder) return false;

        if (reminder.repeat === 'none') {
            reminder.completed = true;
            await this._cancelAlarm(reminder.id);
        } else {
            // Reschedule for next occurrence
            reminder.time = this._getNextOccurrence(reminder);
            await this._scheduleAlarm(reminder);
        }

        await this.save();
        this._notify('complete', reminder);
        return true;
    }

    /**
     * Delete a reminder
     * @param {string} reminderId - Reminder ID
     * @returns {Promise<boolean>}
     */
    async deleteReminder(reminderId) {
        const idx = this.reminders.findIndex(r => r.id === reminderId);
        if (idx === -1) return false;

        const reminder = this.reminders[idx];
        await this._cancelAlarm(reminder.id);

        this.reminders.splice(idx, 1);
        await this.save();

        this._notify('delete', reminder);
        return true;
    }

    /**
     * Snooze a reminder
     * @param {string} reminderId - Reminder ID
     * @param {number} minutes - Minutes to snooze
     * @returns {Promise<boolean>}
     */
    async snoozeReminder(reminderId, minutes = 10) {
        const reminder = this.reminders.find(r => r.id === reminderId);
        if (!reminder) return false;

        reminder.time = Date.now() + (minutes * 60 * 1000);
        await this._scheduleAlarm(reminder);
        await this.save();

        this._notify('snooze', reminder);
        return true;
    }

    // ==================== Query Methods ====================

    /**
     * Get all active (non-completed) reminders
     * @returns {Array}
     */
    getActive() {
        return this.reminders
            .filter(r => !r.completed)
            .sort((a, b) => a.time - b.time);
    }

    /**
     * Get reminders for today
     * @returns {Array}
     */
    getToday() {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const endOfDay = startOfDay + 86400000;

        return this.reminders
            .filter(r => !r.completed && r.time >= startOfDay && r.time < endOfDay)
            .sort((a, b) => a.time - b.time);
    }

    /**
     * Get overdue reminders
     * @returns {Array}
     */
    getOverdue() {
        const now = Date.now();
        return this.reminders
            .filter(r => !r.completed && r.time < now)
            .sort((a, b) => a.time - b.time);
    }

    /**
     * Get upcoming reminders (next 7 days)
     * @returns {Array}
     */
    getUpcoming() {
        const now = Date.now();
        const week = now + (7 * 86400000);
        return this.reminders
            .filter(r => !r.completed && r.time >= now && r.time < week)
            .sort((a, b) => a.time - b.time);
    }

    // ==================== Time Parsing ====================

    /**
     * Parse time string to timestamp
     * @param {string} timeStr - Time string (e.g., "30min", "2h", "2024-02-01 14:00")
     * @returns {number|null} Timestamp or null if invalid
     */
    static parseTime(timeStr) {
        if (!timeStr) return null;
        const str = timeStr.trim().toLowerCase();

        // Relative time: 30min, 2h, 1d
        const relMatch = str.match(/^(\d+)\s*(min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)$/i);
        if (relMatch) {
            const value = parseInt(relMatch[1]);
            const unit = relMatch[2].toLowerCase();

            let ms = 0;
            if (unit.startsWith('min')) ms = value * 60 * 1000;
            else if (unit.startsWith('h')) ms = value * 60 * 60 * 1000;
            else if (unit.startsWith('d')) ms = value * 24 * 60 * 60 * 1000;

            return Date.now() + ms;
        }

        // Time today: 14:00, 2:30pm
        const timeMatch = str.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
        if (timeMatch) {
            let hours = parseInt(timeMatch[1]);
            const mins = parseInt(timeMatch[2]);
            const ampm = timeMatch[3];

            if (ampm?.toLowerCase() === 'pm' && hours < 12) hours += 12;
            if (ampm?.toLowerCase() === 'am' && hours === 12) hours = 0;

            const now = new Date();
            const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, mins);

            // If time has passed today, set for tomorrow
            if (target.getTime() < Date.now()) {
                target.setDate(target.getDate() + 1);
            }

            return target.getTime();
        }

        // Full date time: 2024-02-01 14:00
        const dateTimeMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
        if (dateTimeMatch) {
            const [, year, month, day, hour, min] = dateTimeMatch.map(Number);
            const date = new Date(year, month - 1, day, hour, min);
            return date.getTime();
        }

        // Date only: 2024-02-01 (default to 9:00)
        const dateMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (dateMatch) {
            const [, year, month, day] = dateMatch.map(Number);
            const date = new Date(year, month - 1, day, 9, 0);
            return date.getTime();
        }

        // Chinese relative: 明天, 后天
        if (str.includes('明天') || str.includes('tomorrow')) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(9, 0, 0, 0);
            return tomorrow.getTime();
        }

        return null;
    }

    // ==================== Chrome Alarm Integration ====================

    async _scheduleAlarm(reminder) {
        if (typeof chrome !== 'undefined' && chrome.alarms) {
            await chrome.alarms.create(reminder.id, {
                when: reminder.time
            });
            console.log(`[Reminders] Scheduled alarm for ${reminder.id} at ${new Date(reminder.time)}`);
        }
    }

    async _cancelAlarm(alarmId) {
        if (typeof chrome !== 'undefined' && chrome.alarms) {
            await chrome.alarms.clear(alarmId);
            console.log(`[Reminders] Cancelled alarm ${alarmId}`);
        }
    }

    _getNextOccurrence(reminder) {
        const current = reminder.time;
        const now = Date.now();

        if (reminder.repeat === 'daily') {
            // Next day at same time
            return Math.max(now, current) + 86400000;
        } else if (reminder.repeat === 'weekly') {
            // Next week at same time
            return Math.max(now, current) + (7 * 86400000);
        }

        return current;
    }

    // ==================== Notification ====================

    /**
     * Show notification for a reminder
     * @param {Object} reminder - Reminder object
     */
    static showNotification(reminder) {
        if (typeof chrome !== 'undefined' && chrome.notifications) {
            chrome.notifications.create(reminder.id, {
                type: 'basic',
                iconUrl: '../icons/icon128.png',
                title: '⏰ Reminder',
                message: reminder.content,
                priority: 2,
                requireInteraction: true,
                buttons: [
                    { title: '✓ Complete' },
                    { title: '⏰ Snooze 10min' }
                ]
            });
        }
    }

    // ==================== Event Subscription ====================

    _notify(event, data) {
        this.listeners.forEach(cb => {
            try {
                cb(event, data);
            } catch (e) {
                console.error('[ReminderManager] Listener error:', e);
            }
        });
    }

    onChange(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }
}

// ---------------------------------------------------------
// Reminder Module for ModuleLoader Integration
// ---------------------------------------------------------

const ReminderModule = {
    name: 'reminders',
    version: '1.0.0',
    commands: ['/ai:remind', '/ai:remind:list', '/ai:remind:today'],
    commandDescriptions: {
        '/ai:remind': 'Create a reminder (e.g., /ai:remind 30min 喝水)',
        '/ai:remind:list': 'Show all active reminders',
        '/ai:remind:today': 'Show today\'s reminders'
    },

    manager: null,

    async init() {
        this.manager = new ReminderManager();
        await this.manager.load();
        console.log('[ReminderModule] Initialized with', this.manager.reminders.length, 'reminders');
    },

    destroy() {
        this.manager = null;
    },

    async handleCommand(command, args, context, subCommand) {
        if (subCommand === 'list') {
            return this._renderList(this.manager.getActive());
        }

        if (subCommand === 'today') {
            return this._renderList(this.manager.getToday(), 'Today\'s Reminders');
        }

        // Parse: /remind 30min 喝水
        const match = args.match(/^(\S+)\s+(.+)$/);
        if (!match) {
            return {
                success: false,
                error: 'Format: /ai:remind 时间 内容 (e.g., /ai:remind 30min 喝水)'
            };
        }

        const [, timeStr, content] = match;
        const time = ReminderManager.parseTime(timeStr);

        if (!time) {
            return {
                success: false,
                error: `无法解析时间: ${timeStr}`
            };
        }

        const reminder = await this.manager.createReminder(content, time, {
            noteId: context.noteId
        });

        const timeDisplay = new Date(time).toLocaleString('zh-CN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        return {
            success: true,
            html: this._renderReminder(reminder),
            message: `⏰ 已设置提醒: ${content} (${timeDisplay})`
        };
    },

    _renderReminder(reminder) {
        const time = new Date(reminder.time).toLocaleString('zh-CN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
            <div class="reminder-card" data-reminder-id="${reminder.id}">
                <div class="reminder-icon">⏰</div>
                <div class="reminder-content">
                    <div class="reminder-text">${reminder.content}</div>
                    <div class="reminder-time">${time}</div>
                </div>
                <div class="reminder-actions">
                    <button class="reminder-complete" title="Complete">✓</button>
                    <button class="reminder-delete" title="Delete">×</button>
                </div>
            </div>
        `;
    },

    _renderList(reminders, title = 'Reminders') {
        if (reminders.length === 0) {
            return {
                success: true,
                html: `<div class="reminder-empty">No reminders</div>`
            };
        }

        let html = `<div class="reminder-list"><div class="reminder-list-title">${title}</div>`;
        reminders.forEach(r => {
            html += this._renderReminder(r);
        });
        html += '</div>';

        return { success: true, html };
    }
};

// ---------------------------------------------------------
// Exports
// ---------------------------------------------------------

const reminderManager = new ReminderManager();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ReminderManager, ReminderModule, reminderManager };
}

if (typeof window !== 'undefined') {
    window.ReminderManager = ReminderManager;
    window.ReminderModule = ReminderModule;
    window.reminderManager = reminderManager;
}
