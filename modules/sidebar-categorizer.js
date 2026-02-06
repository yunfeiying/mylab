/**
 * SidebarCategorizer - Handles time-based grouping for the sidebar
 * Special Logic: Funnel-style expansion
 */
class SidebarCategorizer {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = Object.assign({
            onItemClick: null,
            createPageItemFn: null,
            initiallyExpanded: 'today'
        }, options);

        this.expandedCategory = this.options.initiallyExpanded;
        this.data = [];
    }

    setData(newData) {
        // Sort data by timestamp (newest first) to ensure consistent grouping and display
        const safeTs = (val) => window.safeParseDate ? window.safeParseDate(val) : Number(val || 0);
        this.data = [...newData].sort((a, b) => safeTs(b.timestamp) - safeTs(a.timestamp));
        this.render();
    }

    setExpanded(category) {
        this.expandedCategory = category;
        this.render();
    }

    groupData() {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), diff).setHours(0, 0, 0, 0); // Fix date bug

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

        const groups = {
            today: [],
            week: [],
            month: [],
            all: [] // "Year" equivalent for all time
        };

        this.data.forEach(item => {
            const ts = window.safeParseDate ? window.safeParseDate(item.timestamp) : Number(item.timestamp || 0);
            if (ts <= 0) {
                groups.all.push(item);
                return;
            }
            if (ts >= startOfToday) groups.today.push(item);
            if (ts >= startOfWeek) groups.week.push(item);
            if (ts >= startOfMonth) groups.month.push(item);
            groups.all.push(item); // All data
        });

        return groups;
    }

    render() {
        if (!this.container) return;
        this.container.innerHTML = '';
        this.container.className = 'sidebar-categorized active-cat-' + this.expandedCategory;

        const groups = this.groupData();
        const categories = [
            { id: 'today', label: '今日' },
            { id: 'week', label: '本周' },
            { id: 'month', label: '本月' },
            { id: 'all', label: '全部' } // Represents "Year and earlier"
        ];

        // Layout: Single scrollable flow
        const scrollContainer = document.createElement('div');
        scrollContainer.className = 'sidebar-cat-scroll-container';

        categories.forEach(cat => {
            const isVisible = this.isCategoryHeaderVisible(cat.id);
            if (!isVisible) return;

            if (this.expandedCategory === cat.id) {
                // Main Expanding Section
                scrollContainer.appendChild(this.createMainSection(cat, groups[cat.id]));
            } else {
                // Stacked Header (now part of the flow)
                scrollContainer.appendChild(this.createStackHeader(cat, groups[cat.id]));
            }
        });

        this.container.appendChild(scrollContainer);
        this.bindScrollSwitch(scrollContainer);
    }

    bindScrollSwitch(container) {
        let lastScrollTop = 0;
        let wheelTimeout = null;

        // 1. Traditional OnScroll (for long lists)
        container.onscroll = () => {
            const st = container.scrollTop;
            const scrollHeight = container.scrollHeight;
            const clientHeight = container.clientHeight;
            const isScrollingDown = st > lastScrollTop;

            // Scroll Down -> Next
            if (isScrollingDown && (scrollHeight - st <= clientHeight + 5)) {
                this.switchToNext();
            }
            // Scroll Up -> Prev
            else if (!isScrollingDown && st <= 5) {
                this.switchToPrev();
            }

            lastScrollTop = st <= 0 ? 0 : st;
        };

        // 2. Wheel Event (for short lists or aggressive switching)
        container.onwheel = (e) => {
            const scrollHeight = container.scrollHeight;
            const clientHeight = container.clientHeight;
            const st = container.scrollTop;

            if (e.deltaY > 0) {
                // Scroll Down -> Next
                if (st + clientHeight >= scrollHeight - 5) {
                    if (wheelTimeout) return;
                    wheelTimeout = setTimeout(() => {
                        this.switchToNext();
                        wheelTimeout = null;
                    }, 150);
                }
            } else if (e.deltaY < 0) {
                // Scroll Up -> Prev
                if (st <= 5) {
                    if (wheelTimeout) return;
                    wheelTimeout = setTimeout(() => {
                        this.switchToPrev();
                        wheelTimeout = null;
                    }, 150);
                }
            }
        };
    }

    switchToNext() {
        const nextMap = { 'today': 'week', 'week': 'month', 'month': 'all' };
        const nextCat = nextMap[this.expandedCategory];
        if (nextCat) {
            this.setExpanded(nextCat);
        }
    }

    switchToPrev() {
        const prevMap = { 'all': 'month', 'month': 'week', 'week': 'today' };
        const prevCat = prevMap[this.expandedCategory];
        if (prevCat) {
            this.setExpanded(prevCat);
        }
    }

    isCategoryHeaderVisible(catId) {
        // Hiding logic based on priority: Today > Week > Month > All
        const priorities = { 'today': 1, 'week': 2, 'month': 3, 'all': 4 };
        const currentPriority = priorities[this.expandedCategory];
        const targetPriority = priorities[catId];

        // Show current and those strictly HIGHER priority (greater index)
        return targetPriority >= currentPriority;
    }

    createMainSection(cat, items) {
        const section = document.createElement('div');
        section.className = 'main-section';

        const header = document.createElement('div');
        header.className = 'main-header';
        header.innerHTML = `
            <span class="main-title">${cat.label}</span>
            <span class="main-count">${items.length}</span>
            <svg class="main-arrow" viewBox="0 0 24 24" width="16" height="16"><path d="M7 10l5 5 5-5H7z" fill="currentColor"/></svg>
        `;
        // Back to top/today logic
        header.onclick = () => this.setExpanded('today');

        const list = document.createElement('div');
        list.className = 'main-list';
        if (items.length === 0) {
            list.innerHTML = `<div class="empty-section">暂无${cat.label}高亮</div>`;
        } else {
            items.forEach(item => {
                const dom = this.options.createPageItemFn(item);
                list.appendChild(dom);
            });
        }

        section.appendChild(header);
        section.appendChild(list);
        return section;
    }

    createStackHeader(cat, items) {
        const header = document.createElement('div');
        header.className = 'stack-header';
        header.dataset.cat = cat.id;
        header.innerHTML = `
            <span class="stack-title">${cat.label}</span>
            <span class="stack-count">${items.length}</span>
            <svg class="stack-arrow" viewBox="0 0 24 24" width="14" height="14" style="transform: rotate(-90deg);"><path d="M7 10l5 5 5-5H7z" fill="currentColor"/></svg>
        `;
        header.onclick = () => this.setExpanded(cat.id);
        return header;
    }
}

window.SidebarCategorizer = SidebarCategorizer;
