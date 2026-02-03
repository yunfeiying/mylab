/**
 * notes-formatter.js
 * Handles text formatting, CJK spacing, cleaning, and auto-list continuation.
 */

window.autoFormatNote = function () {
    const editor = document.getElementById('note-body');
    if (!editor) return;

    // CJK Spacing
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while (node = walker.nextNode()) {
        const oldText = node.nodeValue;
        let newText = oldText
            .replace(/([\u4e00-\u9fa5])([a-zA-Z0-9])/g, '$1 $2')
            .replace(/([a-zA-Z0-9])([\u4e00-\u9fa5])/g, '$1 $2');
        if (newText !== oldText) node.nodeValue = newText;
    }

    // Indentation
    Array.from(editor.children).forEach(el => {
        if (el.nodeType === 1 && (el.tagName === 'DIV' || el.tagName === 'P')) {
            if (!el.querySelector('h1, h2, h3, blockquote, ul, ol, li, img')) {
                el.style.textIndent = '2em';
            }
        }
    });

    if (typeof saveCurrentNote === 'function') saveCurrentNote(true);
};

window.cleanNoteContent = function () {
    const editor = document.getElementById('note-body');
    if (!editor) return;

    // Remove empty lines
    Array.from(editor.children).forEach(child => {
        const text = child.innerText.trim();
        const hasVisible = Array.from(child.childNodes).some(n => (n.nodeType === 1 && n.tagName !== 'BR') || (n.nodeType === 3 && n.nodeValue.trim()));
        if (!text && !hasVisible && ['DIV', 'P'].includes(child.tagName)) {
            child.remove();
        }
    });

    if (typeof saveCurrentNote === 'function') saveCurrentNote(true);
};

window.handleAutoList = function (e) {
    if (e.key !== 'Enter' || e.shiftKey) return;

    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);

    let block = range.startContainer;
    if (block.nodeType === 3) block = block.parentNode;
    while (block && block.id !== 'note-body' && !['DIV', 'P', 'LI'].includes(block.tagName)) {
        block = block.parentNode;
    }
    if (!block || block.id === 'note-body') return;

    const lineText = block.textContent || '';
    if (lineText.includes('/ai')) return;

    const matchNumber = lineText.match(/^(\s*)(\d+)([、.）)])(\s*)/);
    const matchBullet = lineText.match(/^(\s*)([-*•])(\s+)/);

    if (matchNumber) {
        e.preventDefault();
        const nextNum = parseInt(matchNumber[2]) + 1;
        const nextPrefix = `${nextNum}${matchNumber[3]}${matchNumber[4]}`;
        const newBlock = document.createElement('div');
        newBlock.innerText = nextPrefix;
        block.parentNode.insertBefore(newBlock, block.nextSibling);

        const newRange = document.createRange();
        newRange.selectNodeContents(newBlock);
        newRange.collapse(false);
        selection.removeAllRanges();
        selection.addRange(newRange);
    } else if (matchBullet) {
        e.preventDefault();
        const newBlock = document.createElement('div');
        newBlock.innerText = matchBullet[0];
        block.parentNode.insertBefore(newBlock, block.nextSibling);

        const newRange = document.createRange();
        newRange.selectNodeContents(newBlock);
        newRange.collapse(false);
        selection.removeAllRanges();
        selection.addRange(newRange);
    }
};
