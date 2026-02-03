/**
 * notes-table.js
 * Handles table context menus, row/column insertion, and cell merging.
 */

let currentTableCell = null;
let selectedCells = [];

function setupTableContextMenu() {
    const menu = document.getElementById('table-context-menu');
    const body = document.getElementById('note-body');
    if (!menu || !body) return;

    body.addEventListener('contextmenu', (e) => {
        const cell = e.target.closest('td, th');
        if (!cell) { menu.classList.remove('visible'); return; }
        e.preventDefault();
        currentTableCell = cell;
        menu.style.left = `${e.clientX}px`;
        menu.style.top = `${e.clientY}px`;
        menu.classList.add('visible');
    });

    document.addEventListener('click', (e) => {
        if (!menu.contains(e.target)) menu.classList.remove('visible');
    });
}

function insertTable() {
    const html = `<table style="border-collapse: collapse; width: 100%; margin: 16px 0; border: 1px solid #edece9;">
        <tbody>
            <tr><td style="border:1px solid #edece9;padding:8px;"><br></td><td style="border:1px solid #edece9;padding:8px;"><br></td></tr>
            <tr><td style="border:1px solid #edece9;padding:8px;"><br></td><td style="border:1px solid #edece9;padding:8px;"><br></td></tr>
        </tbody>
    </table><p><br></p>`;
    if (typeof insertAtCursor === 'function') insertAtCursor(html);
    saveCurrentNote(true);
}

function tableInsertRow(position) {
    if (!currentTableCell) return;
    const table = currentTableCell.closest('table');
    const row = currentTableCell.parentElement;
    const newRow = table.insertRow(position === 'above' ? row.rowIndex : row.rowIndex + 1);
    for (let i = 0; i < row.cells.length; i++) {
        const cell = newRow.insertCell();
        cell.style.border = '1px solid #edece9';
        cell.style.padding = '8px';
        cell.innerHTML = '<br>';
    }
    saveCurrentNote(true);
}

function tableDeleteTable() {
    if (currentTableCell) currentTableCell.closest('table')?.remove();
    saveCurrentNote(true);
}

/**
 * AI-ready table generator
 */
window.smartTable = {
    createTableFromData: (headers, rows) => {
        let html = `<table style="border-collapse: collapse; width: 100%; margin: 16px 0; border: 1px solid #edece9;">`;
        if (headers && headers.length > 0) {
            html += `<thead><tr style="background:#f7f6f3;">`;
            headers.forEach(h => html += `<th style="border:1px solid #edece9;padding:8px;text-align:left;font-weight:600;">${h}</th>`);
            html += `</tr></thead>`;
        }
        html += `<tbody>`;
        rows.forEach(row => {
            html += `<tr>`;
            row.forEach(cell => html += `<td style="border:1px solid #edece9;padding:8px;">${cell}</td>`);
            html += `</tr>`;
        });
        html += `</tbody></table><p><br></p>`;

        if (typeof window.insertAtCursor === 'function') {
            window.insertAtCursor(html);
        } else {
            const editor = document.getElementById('note-body');
            if (editor) editor.innerHTML += html;
        }
        if (typeof saveCurrentNote === 'function') saveCurrentNote(true);
    }
};
