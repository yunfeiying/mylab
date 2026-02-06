/**
 * utils-ui.js - 通用 UI 组件
 * 包含: showPrompt, showConfirm
 */

/**
 * Custom prompt dialog (works in iframes where native prompt() may fail)
 */
function showPrompt(title, defaultValue = '') {
    return new Promise((resolve) => {
        const overlay = document.getElementById('modal-overlay');
        const titleEl = document.getElementById('modal-title');
        const inputEl = document.getElementById('modal-input');
        const confirmBtn = document.getElementById('modal-confirm');
        const cancelBtn = document.getElementById('modal-cancel');

        if (!overlay) {
            // Fallback to native prompt
            resolve(prompt(title, defaultValue));
            return;
        }

        titleEl.textContent = title;
        inputEl.value = defaultValue;
        overlay.classList.add('visible');
        inputEl.focus();
        inputEl.select();

        const cleanup = () => {
            overlay.classList.remove('visible');
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
            inputEl.onkeydown = null;
        };

        confirmBtn.onclick = () => {
            cleanup();
            resolve(inputEl.value);
        };

        cancelBtn.onclick = () => {
            cleanup();
            resolve(null);
        };

        inputEl.onkeydown = (e) => {
            if (e.key === 'Enter') {
                cleanup();
                resolve(inputEl.value);
            } else if (e.key === 'Escape') {
                cleanup();
                resolve(null);
            }
        };
    });
}

/**
 * Custom confirm dialog
 */
function showConfirm(message) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('modal-overlay');
        const titleEl = document.getElementById('modal-title');
        const inputEl = document.getElementById('modal-input');
        const confirmBtn = document.getElementById('modal-confirm');
        const cancelBtn = document.getElementById('modal-cancel');

        if (!overlay) {
            resolve(confirm(message));
            return;
        }

        titleEl.textContent = message;
        inputEl.style.display = 'none'; // Hide input for confirm
        overlay.classList.add('visible');
        confirmBtn.focus();

        const cleanup = () => {
            overlay.classList.remove('visible');
            inputEl.style.display = ''; // Restore input
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
        };

        confirmBtn.onclick = () => {
            cleanup();
            resolve(true);
        };

        cancelBtn.onclick = () => {
            cleanup();
            resolve(false);
        };
    });
}

// Export to global scope for compatibility
window.showPrompt = showPrompt;
window.showConfirm = showConfirm;

/**
 * Robust date parser & formatter to prevent NaN display
 */
window.safeParseDate = function (val) {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const parsed = new Date(val).getTime();
    return isNaN(parsed) ? 0 : parsed;
};

window.safeFormatDate = function (ts, showTime = true) {
    const timeVal = window.safeParseDate(ts);
    if (!timeVal) return '';
    try {
        const d = new Date(timeVal);
        const options = showTime
            ? { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }
            : { month: 'numeric', day: 'numeric', year: 'numeric' };
        return d.toLocaleString([], options);
    } catch (e) {
        return '';
    }
};

console.log('[utils-ui.js] Loaded: Date utilities added');
