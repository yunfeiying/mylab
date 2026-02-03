/**
 * notes-ui.js
 * Handles Floating UI, Selection Menu, Resizer, and Color/Align pickers.
 */

function setupResizer() {
    const overlay = document.getElementById('resizer-overlay');
    const handle = document.getElementById('resizer-handle');
    const body = document.getElementById('note-body');
    const editor = document.querySelector('.editor-content');
    let resizingElement = null;

    body.addEventListener('click', (e) => {
        const target = e.target.closest('img, table');
        if (target) {
            resizingElement = target;
            updatePosition();
        } else if (e.target !== handle) {
            overlay.style.display = 'none';
        }
    });

    function updatePosition() {
        if (!resizingElement) return;
        const rect = resizingElement.getBoundingClientRect();
        const eRect = editor.getBoundingClientRect();
        overlay.style.top = `${rect.top - eRect.top + editor.scrollTop}px`;
        overlay.style.left = `${rect.left - eRect.left}px`;
        overlay.style.width = `${rect.width}px`;
        overlay.style.height = `${rect.height}px`;
        overlay.style.display = 'block';
    }

    handle.onmousedown = (e) => {
        let startX = e.clientX, startW = resizingElement.offsetWidth;
        const move = (me) => {
            const nw = startW + (me.clientX - startX);
            if (nw > 50) { resizingElement.style.width = nw + 'px'; updatePosition(); }
        };
        const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); saveCurrentNote(true); };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
    };
}

function setupSelectionMenu() {
    const menu = document.getElementById('selection-menu');
    document.addEventListener('selectionchange', debounce(() => {
        const sel = window.getSelection();
        if (!sel.rangeCount || sel.isCollapsed) { menu.classList.remove('visible'); return; }
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const editor = document.querySelector('.editor-content');
        const eRect = editor.getBoundingClientRect();

        menu.style.top = `${rect.top - eRect.top + editor.scrollTop - 48}px`;
        menu.style.left = `${(rect.left + rect.width / 2) - 120 - eRect.left}px`;
        menu.classList.add('visible');
    }, 250));

    // Handle button clicks in menu...
    document.getElementById('btn-bold')?.addEventListener('mousedown', (e) => { e.preventDefault(); execCmd('bold'); });
    document.getElementById('btn-italic')?.addEventListener('mousedown', (e) => { e.preventDefault(); execCmd('italic'); });
}

function setupFloatingUI() {
    const body = document.getElementById('note-body');
    const handle = document.getElementById('block-handle');
    body.addEventListener('mousemove', (e) => {
        const block = e.target.closest('#note-body > div, #note-body > p, #note-body > h1, #note-body > h2, #note-body > h3');
        if (block) {
            const rect = block.getBoundingClientRect();
            handle.style.top = `${rect.top + window.scrollY + 2}px`;
            handle.style.left = `${rect.left - 24}px`;
            handle.classList.add('visible');
        }
    });
}
