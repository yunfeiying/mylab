/**
 * DatabaseManager - A Notion-style reusable table component
 * High performance, selection-aware, and extensible.
 */
class DatabaseManager {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = Object.assign({
            columns: [],
            onRowClick: null,
            onRowDoubleClick: null,
            onSelectionChange: null,
            idField: 'id'
        }, options);

        this.data = [];
        this.selectedIds = new Set();
        this.lastSelectedIndex = -1;
        this.sortState = { field: null, direction: 'none' }; // 'asc', 'desc', 'none'

        this.init();
    }

    init() {
        if (!this.container) return;
        this.container.classList.add('db-container');
        this.renderFrame();
    }

    setData(newData) {
        this.data = newData;
        this.renderRows();
    }

    renderFrame() {
        this.container.innerHTML = `
            <table class="res-table">
                <thead class="res-thead">
                    <tr>
                        <th class="res-th col-select">
                            <input type="checkbox" class="db-select-all res-checkbox">
                        </th>
                        ${this.options.columns.map(col => `
                            <th class="res-th ${col.className || ''} ${col.sortable !== false ? 'sortable' : ''}" 
                                style="${col.width ? `width:${col.width}px` : ''}"
                                data-field="${col.field || ''}">
                                <div style="display:flex; align-items:center; gap:4px; cursor:pointer;">
                                    ${col.title}
                                    <span class="sort-icon"></span>
                                </div>
                            </th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody class="db-tbody res-tbody"></tbody>
            </table>
        `;

        // Selection Header
        const selectAll = this.container.querySelector('.db-select-all');
        selectAll.addEventListener('change', (e) => this.toggleSelectAll(e.target.checked));

        // Sort Header
        const headers = this.container.querySelectorAll('.res-th.sortable');
        headers.forEach(th => {
            th.onclick = () => {
                const field = th.dataset.field;
                if (!field) return;
                this.handleSort(field);
            };
        });
    }

    handleSort(field) {
        if (this.sortState.field === field) {
            this.sortState.direction = this.sortState.direction === 'asc' ? 'desc' : (this.sortState.direction === 'desc' ? 'none' : 'asc');
        } else {
            this.sortState.field = field;
            this.sortState.direction = 'asc';
        }

        if (this.sortState.direction === 'none') {
            this.sortState.field = null;
        }

        this.sortData();
        this.renderRows();
        this.updateSortIcons();
    }

    sortData() {
        if (!this.sortState.field) return;

        const { field, direction } = this.sortState;
        this.data.sort((a, b) => {
            let valA = a[field] ?? '';
            let valB = b[field] ?? '';

            // Handle date strings or numbers
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    updateSortIcons() {
        const headers = this.container.querySelectorAll('.res-th.sortable');
        headers.forEach(th => {
            const icon = th.querySelector('.sort-icon');
            const field = th.dataset.field;
            if (field === this.sortState.field) {
                icon.innerHTML = this.sortState.direction === 'asc' ? '↑' : '↓';
                icon.style.opacity = '1';
                th.classList.add('active-sort');
            } else {
                icon.innerHTML = '';
                icon.style.opacity = '0';
                th.classList.remove('active-sort');
            }
        });
    }

    renderRows() {
        const tbody = this.container.querySelector('.db-tbody');
        if (!tbody) return;

        tbody.innerHTML = '';
        this.data.forEach((item, index) => {
            const id = item[this.options.idField];
            const tr = document.createElement('tr');
            tr.className = 'res-row db-row';
            tr.dataset.id = id;
            tr.dataset.index = index;
            if (this.selectedIds.has(id)) tr.classList.add('selected');

            const isChecked = this.selectedIds.has(id);

            tr.innerHTML = `
                <td class="res-td col-select">
                    <input type="checkbox" class="res-checkbox db-row-checkbox" ${isChecked ? 'checked' : ''}>
                </td>
                ${this.options.columns.map(col => `
                    <td class="res-td ${col.className || ''}">
                        ${col.render ? col.render(item, id) : (item[col.field] || '')}
                    </td>
                `).join('')}
            `;

            this.bindRowEvents(tr, item, id, index);
            tbody.appendChild(tr);
        });
    }

    bindRowEvents(tr, item, id, index) {
        tr.onclick = (e) => {
            // Priority 1: Check if its a link or action button first
            if (e.target.closest('.res-link') || e.target.closest('button')) return;

            // Identification: Did the user click the specialized "Selection Column"?
            const isSelectionColumn = e.target.closest('.col-select');
            const checkbox = tr.querySelector('.db-row-checkbox');

            if (isSelectionColumn || e.ctrlKey || e.metaKey) {
                e.stopPropagation();
                // TOGGLE MODE: Keep others, flip current
                if (this.selectedIds.has(id)) {
                    this.selectedIds.delete(id);
                } else {
                    this.selectedIds.add(id);
                }
            } else if (e.shiftKey && this.lastSelectedIndex !== -1) {
                // RANGE MODE: Select everything between last and current
                this.selectRange(this.lastSelectedIndex, index);
            } else {
                // EXCLUSIVE MODE: Clear all, select only this one
                this.selectedIds.clear();
                this.selectedIds.add(id);
            }

            this.lastSelectedIndex = index;
            this.syncUI();

            // Notify external listeners
            if (this.options.onSelectionChange) this.options.onSelectionChange(new Set(this.selectedIds));
            if (this.options.onRowClick) this.options.onRowClick(item, e);
        };

        tr.ondblclick = (e) => {
            // Prevent double-clicking the checkbox area from doing anything
            if (e.target.closest('.col-select')) return;
            if (this.options.onRowDoubleClick) this.options.onRowDoubleClick(item, e);
        };
    }

    toggleSelection(id) {
        if (this.selectedIds.has(id)) this.selectedIds.delete(id);
        else this.selectedIds.add(id);
    }

    selectRange(start, end) {
        const [low, high] = start < end ? [start, end] : [end, start];
        for (let i = low; i <= high; i++) {
            const id = this.data[i][this.options.idField];
            this.selectedIds.add(id);
        }
    }

    toggleSelectAll(checked) {
        if (checked) {
            this.data.forEach(item => this.selectedIds.add(item[this.options.idField]));
        } else {
            this.selectedIds.clear();
        }
        this.syncUI();
        if (this.options.onSelectionChange) this.options.onSelectionChange(this.selectedIds);
    }

    syncUI() {
        const rows = this.container.querySelectorAll('.db-row');
        rows.forEach(row => {
            const id = row.dataset.id;
            const isSelected = this.selectedIds.has(id);
            row.classList.toggle('selected', isSelected);
            const cb = row.querySelector('.db-row-checkbox');
            if (cb) cb.checked = isSelected;
        });

        // Sync Header checkbox
        const selectAll = this.container.querySelector('.db-select-all');
        if (selectAll) {
            selectAll.checked = this.selectedIds.size === this.data.length && this.data.length > 0;
            selectAll.indeterminate = this.selectedIds.size > 0 && this.selectedIds.size < this.data.length;
        }
    }

    getSelectedIds() {
        return Array.from(this.selectedIds);
    }

    clearSelection() {
        this.selectedIds.clear();
        this.syncUI();
    }
}

// Export to window for global access
window.DatabaseManager = DatabaseManager;
