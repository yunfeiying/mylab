/**
 * options-data-io.js - Data Import/Export Logic
 * Handles JSON, Markdown, TXT, NotebookLM exports and JSON import.
 */

window.setupDataIOHandlers = function () {
    // 1. Export JSON
    const btnExport = document.getElementById('menu-export');
    if (btnExport) {
        btnExport.onclick = async () => {
            const data = await chrome.storage.local.get(null);
            delete data.smart_temp_content;
            delete data.smart_temp_title;

            // 🔍 Smart Classification for Export
            // Ensure every item has a 'type' so Mobile App can route it correctly
            Object.keys(data).forEach(key => {
                const val = data[key];
                // 1. Array of Highlights (Standard Extension storage)
                if (Array.isArray(val)) {
                    val.forEach(item => {
                        if (!item.type) item.type = 'highlight';
                    });
                }
                // 2. Window.notes usually stored as 'notes' array or individual keys?
                else if (key === 'notes' && Array.isArray(val)) {
                    val.forEach(n => n.type = 'note');
                }
                // 3. Individual Objects (Legacy or specific)
                else if (val && typeof val === 'object') {
                    if (val.id && String(val.id).startsWith('note_')) {
                        val.type = 'note';
                    }
                }
            });

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            window.downloadBlob(blob, `highlighter_backup_CLASSIFIED_${new Date().toISOString().slice(0, 10)}.json`);
        };
    }

    // 2. Export Markdown
    const btnExportMd = document.getElementById('menu-export-markdown');
    if (btnExportMd) {
        btnExportMd.onclick = async () => {
            if (!window.groupedData || window.groupedData.length === 0) return window.showToast(chrome.i18n.getMessage('ui_noPreview') || 'No content to export');

            window.showToast('Exporting Markdown...');
            let mdContent = `# ${chrome.i18n.getMessage('appName') || 'Highlighti'} Export\n> Time: ${new Date().toLocaleString()}\n\n---\n\n`;

            window.groupedData.forEach(page => {
                mdContent += `## ${page.title}\nSource: [${page.url}](${page.url})\n\n`;
                const sortedItems = [...page.items].sort((a, b) => a.timestamp - b.timestamp);

                sortedItems.forEach(item => {
                    if (item.type === 'image') {
                        mdContent += `![Image](${item.src})\n`;
                        const ocrText = item.note || item.text || '';
                        if (ocrText && !ocrText.includes('截图标记')) mdContent += `> 👁️ OCR: ${ocrText}\n`;
                    } else if (item.type === 'video') {
                        mdContent += `> 🔔 Video Time: ${window.formatTime(item.videoTime)}\n`;
                    } else {
                        mdContent += `> ${item.text}\n`;
                    }

                    if (item.note && item.note !== item.text) {
                        mdContent += `\n*📝 Note: ${item.note}*\n`;
                    }
                    mdContent += `\n`;
                });
                mdContent += `\n---\n\n`;
            });

            const blob = new Blob([mdContent], { type: 'text/markdown' });
            window.downloadBlob(blob, `Highlighti_${new Date().toISOString().slice(0, 10)}.md`);
        };
    }

    // 3. Export TXT
    const btnExportTxt = document.getElementById('menu-export-txt');
    if (btnExportTxt) {
        btnExportTxt.onclick = async () => {
            if (!window.groupedData || window.groupedData.length === 0) return alert(chrome.i18n.getMessage('ui_noPreview'));
            let txtContent = `Highlighti Export\nTime: ${new Date().toLocaleString()}\n\n`;
            window.groupedData.forEach(page => {
                txtContent += `====================\nTITLE: ${page.title}\nURL: ${page.url}\nDATE: ${new Date(page.timestamp).toLocaleString()}\n--------------------\n`;
                const sortedItems = [...page.items].sort((a, b) => a.timestamp - b.timestamp);
                sortedItems.forEach((item, index) => {
                    txtContent += `[${index + 1}] `;
                    if (item.type === 'image') txtContent += `[Image/Screenshot] ${item.note || item.text || ''}\n`;
                    else if (item.type === 'video') txtContent += `[Video] ${window.formatTime(item.videoTime)}\n`;
                    else txtContent += `${item.text}\n`;
                    if (item.note && item.type !== 'image') txtContent += `   Note: ${item.note}\n`;
                    txtContent += `\n`;
                });
                txtContent += `\n`;
            });
            const blob = new Blob([txtContent], { type: 'text/plain' });
            window.downloadBlob(blob, `Highlighti_${new Date().toISOString().slice(0, 10)}.txt`);
        };
    }

    // 4. Export for NotebookLM
    const btnExportNotebookLM = document.getElementById('menu-export-notebooklm');
    if (btnExportNotebookLM) {
        btnExportNotebookLM.onclick = async () => {
            if (!window.groupedData || window.groupedData.length === 0) return alert(chrome.i18n.getMessage('ui_noPreview') || 'No content to export');

            window.showToast('Preparing Export...');
            let cleanContent = `Highlighti Export for NotebookLM\nTime: ${new Date().toLocaleString()}\n\n`;
            const storageData = await chrome.storage.local.get(null);

            for (const page of window.groupedData) {
                const cleanTitle = page.title.replace(/[^\w\s\u4e00-\u9fa5,.?!:;'"()-]/g, ' ').trim();
                cleanContent += `SOURCE: ${cleanTitle}\nLINK: ${page.url}\nDATE: ${new Date(page.timestamp).toLocaleDateString()}\n\n`;

                cleanContent += `[HIGHLIGHTS]\n`;
                const sortedItems = [...page.items].sort((a, b) => a.timestamp - b.timestamp);
                sortedItems.forEach((item, index) => {
                    let text = '';
                    if (item.type === 'image') text = item.note || item.text || '[Image Content]';
                    else if (item.type === 'video') text = `[Video Timestamp: ${window.formatTime(item.videoTime)}]`;
                    else text = item.text || '';

                    text = text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

                    if (text) cleanContent += `- ${text}\n`;
                    if (item.note && item.note !== item.text && item.type !== 'image') {
                        let cleanNote = item.note.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
                        if (cleanNote) cleanContent += `  NOTE: ${cleanNote}\n`;
                    }
                });

                const snapshotKey = 'snapshot_' + page.url;
                const snapshot = storageData[snapshotKey];
                if (snapshot && (snapshot.textContent || snapshot.content)) {
                    cleanContent += `\n[FULL PAGE CONTENT]\n`;
                    let pageText = snapshot.textContent || snapshot.content.replace(/<[^>]*>/g, ' ');
                    pageText = pageText.replace(/\s+/g, ' ').trim();
                    if (pageText) cleanContent += `${pageText}\n`;
                }
                cleanContent += `\n--------------------------------------------------\n\n`;
            }

            const blob = new Blob([cleanContent], { type: 'text/plain' });
            window.downloadBlob(blob, `NotebookLM_Export_${new Date().toISOString().slice(0, 10)}.txt`);
            window.showToast('Export Ready!');
        };
    }

    // 5. Import JSON
    const btnImport = document.getElementById('menu-import');
    if (btnImport) {
        btnImport.onclick = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,application/json';
            input.style.display = 'none';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async (ev) => {
                    try {
                        const importData = JSON.parse(ev.target.result);
                        const localData = await chrome.storage.local.get(null);
                        let totalAdded = 0;
                        const updates = {};
                        for (const [key, val] of Object.entries(importData)) {
                            if (Array.isArray(val)) {
                                const localItems = localData[key] || [];
                                const localIds = new Set(localItems.map(i => i.id));
                                const newItems = val.filter(i => !localIds.has(i.id));
                                if (newItems.length > 0) {
                                    totalAdded += newItems.length;
                                    updates[key] = [...localItems, ...newItems].sort((a, b) => b.timestamp - a.timestamp);
                                }
                            } else if (!localData[key]) {
                                updates[key] = val;
                                if (val.length > 0) totalAdded += val.length;
                            } else {
                                updates[key] = val;
                            }
                        }
                        if (Object.keys(updates).length > 0) await chrome.storage.local.set(updates);
                        let msg = chrome.i18n.getMessage('msg_importSuccessCount', [String(totalAdded)]);
                        if (!msg) msg = `Import successful! (${totalAdded} new items added)`;
                        alert(msg);
                        location.reload();
                    } catch (err) {
                        console.error('Import Error:', err);
                        if (err.message && err.message.includes('quota exceeded')) {
                            alert('Storage Quota Exceeded! 😭\nPlease add "unlimitedStorage" to manifest.json or delete some images.');
                        } else if (err instanceof SyntaxError) {
                            alert('Invalid JSON file format.');
                        } else {
                            alert('Import Failed: ' + (err.message || 'Unknown error'));
                        }
                    }
                };
                reader.readAsText(file);
            };
            document.body.appendChild(input);
            input.click();
            setTimeout(() => { document.body.removeChild(input); }, 1000);
        };
    }

    // 6. Export Brain ONLY
    const btnExportBrain = document.getElementById('menu-export-brain');
    if (btnExportBrain) {
        btnExportBrain.onclick = async () => {
            if (window.showToast) window.showToast('🧠 Protecting Memory...');
            const allData = await chrome.storage.local.get(null);

            // Filter for brain-related keys
            const brainData = {};
            const coreKeys = ['memory_long_term', 'ai_soul_config', 'ai_user_preferences', 'chat_history_persistent', 'chat_current_session_id'];

            Object.keys(allData).forEach(key => {
                // Include core keys and any daily logs
                if (coreKeys.includes(key) || key.startsWith('memory_short_') || key.startsWith('ai_')) {
                    brainData[key] = allData[key];
                }
            });

            // Add Metadata
            brainData['_meta'] = {
                type: 'highlighti_brain_core',
                timestamp: Date.now(),
                version: '5.0',
                note: 'This file contains the AI Soul, Memory, and Preferences.'
            };

            const blob = new Blob([JSON.stringify(brainData, null, 2)], { type: 'application/json' });
            window.downloadBlob(blob, `Highlighti_Brain_Core_${new Date().toISOString().slice(0, 10)}.json`);
            if (window.showToast) window.showToast('✅ Brain Securely Exported');
        };
    }
};

window.downloadBlob = function (blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

console.log('[options-data-io.js] Loaded: Export and Import handlers');
