/**
 * notes-export.js
 * Handles exporting notes to Word (.doc) and JSON format.
 */

async function exportToWord() {
    if (!currentNoteId) {
        alert('Please select a note to export');
        return;
    }

    const title = document.getElementById('note-title')?.value || 'Untitled';
    const bodyInput = document.getElementById('note-body');
    if (!bodyInput) return;

    const btn = document.getElementById('btn-export-word');
    if (btn) btn.disabled = true;

    try {
        const contentClone = bodyInput.cloneNode(true);
        const images = contentClone.querySelectorAll('img');

        for (const img of images) {
            img.src = await getImageDataUrl(img);
        }

        const wordContent = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Segoe UI', sans-serif; }
        h1 { font-size: 24pt; color: #4f46e5; }
        table { border-collapse: collapse; width: 100%; border: 1px solid #ccc; }
        td { border: 1px solid #ccc; padding: 8px; }
    </style>
</head>
<body>
    <h1>${escapeHtml(title)}</h1>
    ${contentClone.innerHTML}
</body>
</html>`;

        const filename = `${title.replace(/[\\/:*?"<>|]/g, '_')}.doc`;
        downloadFile(filename, wordContent, 'application/vnd.ms-word');
    } catch (err) {
        console.error('[Export] Error:', err);
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function getImageDataUrl(img) {
    const src = img.src;
    if (!src || src.startsWith('data:')) return src;

    try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        return canvas.toDataURL('image/png');
    } catch (e) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: 'FETCH_IMAGE_BASE64', url: src }, (resp) => {
                resolve(resp?.success ? resp.data : src);
            });
        });
    }
}

function exportAllNotes() {
    if (window.notes && window.notes.length > 0) {
        const data = JSON.stringify(window.notes, null, 2);
        downloadFile(`notes_backup_${new Date().toISOString().split('T')[0]}.json`, data, 'application/json');
    }
}

function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type: type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
