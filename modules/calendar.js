/**
 * Calendar Module
 * 
 * Provides a monthly calendar view that can be embedded in notes.
 * Supports event management and integration with notes.
 * 
 * @module options/modules/calendar
 * @version 1.0.0
 */

// ---------------------------------------------------------
// Calendar Data Manager
// ---------------------------------------------------------

class CalendarManager {
    constructor() {
        this.events = [];
        this.listeners = new Set();
    }

    /**
     * Load events from storage
     */
    async load() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['calendar_events'], (result) => {
                this.events = result.calendar_events || [];
                resolve(this.events);
            });
        });
    }

    /**
     * Save events to storage
     */
    async save() {
        return new Promise((resolve) => {
            chrome.storage.local.set({ calendar_events: this.events }, () => {
                this._notify('save');
                resolve();
            });
        });
    }

    /**
     * Create a calendar event
     */
    async createEvent(title, date, options = {}) {
        const event = {
            id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            title: title,
            date: date, // YYYY-MM-DD
            time: options.time || null,
            noteId: options.noteId || null,
            color: options.color || '#6366f1',
            createdAt: Date.now()
        };

        this.events.push(event);
        await this.save();
        this._notify('create', event);
        return event;
    }

    /**
     * Get events for a specific month
     */
    getEventsForMonth(year, month) {
        const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
        return this.events.filter(e => e.date.startsWith(prefix));
    }

    /**
     * Get events for a specific day
     */
    getEventsForDay(dateStr) {
        return this.events.filter(e => e.date === dateStr);
    }

    _notify(event, data) {
        this.listeners.forEach(cb => cb(event, data));
    }

    onChange(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }
}

// ---------------------------------------------------------
// Calendar UI Renderer
// ---------------------------------------------------------

class CalendarRenderer {
    constructor(manager) {
        this.manager = manager;
        this.currentDate = new Date();
    }

    /**
     * Render the calendar HTML
     */
    render(year = null, month = null) {
        if (year === null) year = this.currentDate.getFullYear();
        if (month === null) month = this.currentDate.getMonth();

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const prevLastDay = new Date(year, month, 0);

        const daysInMonth = lastDay.getDate();
        const startDay = firstDay.getDay(); // 0 (Sun) to 6 (Sat)

        const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(firstDay);

        const events = this.manager.getEventsForMonth(year, month);
        const eventsByDay = {};
        events.forEach(e => {
            const day = parseInt(e.date.split('-')[2]);
            if (!eventsByDay[day]) eventsByDay[day] = [];
            eventsByDay[day].push(e);
        });

        let html = `
            <div class="calendar-widget" data-year="${year}" data-month="${month}">
                <div class="calendar-header">
                    <div class="calendar-title">${monthName} ${year}</div>
                    <div class="calendar-nav">
                        <button class="cal-prev">←</button>
                        <button class="cal-today">Today</button>
                        <button class="cal-next">→</button>
                    </div>
                </div>
                <div class="calendar-grid">
                    <div class="calendar-day-label">Sun</div>
                    <div class="calendar-day-label">Mon</div>
                    <div class="calendar-day-label">Tue</div>
                    <div class="calendar-day-label">Wed</div>
                    <div class="calendar-day-label">Thu</div>
                    <div class="calendar-day-label">Fri</div>
                    <div class="calendar-day-label">Sat</div>
        `;

        // Previous month padding
        for (let i = startDay - 1; i >= 0; i--) {
            html += `<div class="calendar-day padding">${prevLastDay.getDate() - i}</div>`;
        }

        // Current month days
        const today = new Date();
        const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

        for (let day = 1; day <= daysInMonth; day++) {
            const isToday = isCurrentMonth && today.getDate() === day;
            const dayEvents = eventsByDay[day] || [];

            html += `
                <div class="calendar-day ${isToday ? 'today' : ''}" data-day="${day}">
                    <div class="day-number">${day}</div>
                    <div class="day-events">
                        ${dayEvents.map(e => `
                            <div class="event-dot" title="${e.title}" style="background: ${e.color}"></div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Next month padding
        const totalCells = 42; // 6 rows
        const currentCells = startDay + daysInMonth;
        for (let i = 1; i <= totalCells - currentCells; i++) {
            html += `<div class="calendar-day padding">${i}</div>`;
        }

        html += `</div></div>`;
        return html;
    }
}

// ---------------------------------------------------------
// Calendar Module
// ---------------------------------------------------------

const CalendarModule = {
    name: 'calendar',
    commands: ['/calendar'],
    commandDescriptions: {
        '/calendar': 'Insert a monthly calendar view'
    },

    manager: null,
    renderer: null,

    async init() {
        this.manager = new CalendarManager();
        await this.manager.load();
        this.renderer = new CalendarRenderer(this.manager);
    },

    async handleCommand(command, args, context) {
        const html = this.renderer.render();
        return {
            success: true,
            html: html,
            message: 'Calendar inserted'
        };
    }
};

// Exports
const calendarManager = new CalendarManager();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CalendarManager, CalendarRenderer, CalendarModule, calendarManager };
}

if (typeof window !== 'undefined') {
    window.CalendarManager = CalendarManager;
    window.CalendarRenderer = CalendarRenderer;
    window.CalendarModule = CalendarModule;
    window.calendarManager = calendarManager;
}
