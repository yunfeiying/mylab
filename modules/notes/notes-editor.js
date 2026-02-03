/**
 * notes-editor.js
 * Handles core editor events like paste, drop, and selection storage.
 */

function handlePaste(e) {
    const clipboardData = e.clipboardData || window.clipboardData;
    const html = clipboardData.getData('text/html');
    if (html) {
        e.preventDefault();
        const div = document.createElement('div');
        div.innerHTML = html;
        // Basic cleaning
        document.execCommand('insertHTML', false, div.innerHTML);
        saveCurrentNote(true);
        return;
    }
    const text = clipboardData.getData('text/plain');
    if (text) {
        e.preventDefault();
        document.execCommand('insertText', false, text);
        saveCurrentNote(true);
    }
}

function execCmd(cmd, val = null) {
    document.getElementById('note-body')?.focus();
    document.execCommand(cmd, false, val);
    saveCurrentNote();
}

function insertAtCursor(html) {
    document.getElementById('note-body')?.focus();
    document.execCommand('insertHTML', false, html);
    saveCurrentNote();
}

function tagCommandLines() {
    document.querySelectorAll('#note-body > *').forEach(block => {
        if (block.innerText.trim().startsWith('/')) block.setAttribute('data-command-line', 'true');
        else block.removeAttribute('data-command-line');
    });
}
