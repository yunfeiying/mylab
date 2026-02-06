
// ==========================================
// AI Chat & Calendar Logic
// Ment for options.js refactoring
// ==========================================

console.log('[options-chat.js] Loading AI Chat module...');

// Global State (exposed to window for compatibility)
window.chatSources = window.chatSources || [];
window.chatHistory = window.chatHistory || [];
window.chatSessions = window.chatSessions || [];
window.currentSessionId = window.currentSessionId || null;
window.isGenerating = window.isGenerating || false;
window.lastSourceSignature = window.lastSourceSignature || '';
window.cachedSystemContext = window.cachedSystemContext || '';
window.chatInitialized = window.chatInitialized || false;

// Calendar State
window.calCurrentDate = new Date();
window.calSelectedStart = null;
window.calSelectedEnd = null;

// ==========================================
// 1. Chat View Control
// ==========================================

window.toggleChatView = function () {
    const chatView = document.getElementById('chat-view');
    const contentView = document.getElementById('content-view');
    const emptyState = document.getElementById('empty-state');
    const resView = document.getElementById('resource-view');
    const searchContainer = document.getElementById('search-container');
    const btnChat = document.getElementById('btn-chat-view');

    if (!chatView) return;

    if (chatView.style.display === 'none') {
        // Show Chat
        if (contentView) contentView.style.display = 'none';
        if (emptyState) emptyState.style.display = 'none';
        if (resView) resView.style.display = 'none';
        if (searchContainer) searchContainer.style.display = 'none';

        chatView.style.display = 'flex';
        if (btnChat) btnChat.classList.add('active');

        // Initialize chat if needed
        if (!window.chatInitialized) {
            setupChatEvents();
            window.chatInitialized = true;
        }
    } else {
        // Hide Chat
        chatView.style.display = 'none';
        if (btnChat) btnChat.classList.remove('active');

        // Restore previous view
        if (window.selectedUrl) {
            if (contentView) contentView.style.display = 'flex';
        } else {
            if (emptyState) emptyState.style.display = 'block';
        }
    }

    // Load history when opening chat
    if (chatView.style.display === 'flex') {
        loadChatHistory();
    }
};

// ==========================================
// 2. Calendar Logic
// ==========================================

window.renderCalendar = function () {
    const grid = document.getElementById('calendar-grid');
    const monthYear = document.getElementById('cal-month-year');
    if (!grid || !monthYear) return;

    grid.innerHTML = '';

    const year = window.calCurrentDate.getFullYear();
    const month = window.calCurrentDate.getMonth();

    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    monthYear.innerText = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        const div = document.createElement('div');
        grid.appendChild(div);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const div = document.createElement('div');
        div.className = 'calendar-day';
        div.innerText = d;
        div.style.cssText = "padding: 8px; cursor: pointer; border-radius: 4px; text-align: center; font-size: 13px;";

        const isSelected = isDateSelected(date);
        const isRange = isDateInRange(date);
        const isToday = isSameDay(date, new Date());

        if (isSelected) {
            div.style.background = '#1976d2';
            div.style.color = '#fff';
        } else if (isRange) {
            div.style.background = '#e3f2fd';
            div.style.color = '#1976d2';
        } else if (isToday) {
            div.style.border = '1px solid #1976d2';
            div.style.color = '#1976d2';
        } else {
            div.onmouseenter = () => div.style.background = '#f5f5f5';
            div.onmouseleave = () => div.style.background = 'transparent';
        }

        div.onclick = (e) => { e.stopPropagation(); onDateClick(date); };
        grid.appendChild(div);
    }
};

function isSameDay(d1, d2) {
    return d1 && d2 && d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function isDateSelected(date) {
    return isSameDay(date, window.calSelectedStart) || isSameDay(date, window.calSelectedEnd);
}

function isDateInRange(date) {
    if (window.calSelectedStart && window.calSelectedEnd) {
        return date > window.calSelectedStart && date < window.calSelectedEnd;
    }
    return false;
}

function onDateClick(date) {
    if (!window.calSelectedStart || (window.calSelectedStart && window.calSelectedEnd)) {
        window.calSelectedStart = date;
        window.calSelectedEnd = null;
    } else {
        if (date < window.calSelectedStart) {
            window.calSelectedEnd = window.calSelectedStart;
            window.calSelectedStart = date;
        } else if (isSameDay(date, window.calSelectedStart)) {
            window.calSelectedEnd = null;
        } else {
            window.calSelectedEnd = date;
        }
    }

    renderCalendar();
    updateFilterDate();
}

function updateFilterDate() {
    const rangeDisplay = document.getElementById('selected-date-range');
    const rangeText = document.getElementById('date-range-text');
    const clearBtn = document.getElementById('clear-date-filter');

    if (rangeDisplay && rangeText) {
        if (window.calSelectedStart) {
            const startStr = window.calSelectedStart.toLocaleDateString();
            const endStr = window.calSelectedEnd ? window.calSelectedEnd.toLocaleDateString() : startStr;
            rangeText.innerText = (startStr === endStr) ? startStr : `${startStr} - ${endStr}`;
            rangeDisplay.style.display = 'flex';
        } else {
            rangeDisplay.style.display = 'none';
        }

        if (clearBtn) {
            clearBtn.onclick = (e) => {
                e.stopPropagation();
                window.calSelectedStart = null;
                window.calSelectedEnd = null;
                renderCalendar();
                updateFilterDate();
            };
        }
    }

    // Filter and load content to Sources
    if (window.calSelectedStart) {
        const startTimestamp = window.calSelectedStart.getTime();
        const endTimestamp = window.calSelectedEnd ? window.calSelectedEnd.getTime() + 86400000 : startTimestamp + 86400000;

        const matches = (window.groupedData || []).filter(p => p.timestamp >= startTimestamp && p.timestamp < endTimestamp);

        if (matches.length > 0) {
            let addedCount = 0;
            matches.forEach(p => {
                if (!chatSources.find(s => s.url === p.url)) {
                    chatSources.push({
                        url: p.url,
                        title: p.title,
                        items: p.items
                    });
                    addedCount++;
                }
            });

            if (addedCount > 0) {
                renderChatSources();
                showToast(`Added ${addedCount} pages from selected date`);
            } else {
                showToast(`Pages from this date are already in the list`);
            }
        } else {
            showToast(`No pages found for this date`);
        }
    }
}

window.toggleCalendar = function () {
    const calendar = document.getElementById('calendar-popover');
    if (!calendar) return;

    if (calendar.style.display === 'none' || calendar.style.display === '') {
        calendar.style.display = 'block';
        renderCalendar();
    } else {
        calendar.style.display = 'none';
    }
};

function setupCalendarEvents() {
    const prevBtn = document.getElementById('cal-prev-month');
    if (prevBtn) prevBtn.onclick = (e) => { e.stopPropagation(); window.calCurrentDate.setMonth(window.calCurrentDate.getMonth() - 1); renderCalendar(); };

    const nextBtn = document.getElementById('cal-next-month');
    if (nextBtn) nextBtn.onclick = (e) => { e.stopPropagation(); window.calCurrentDate.setMonth(window.calCurrentDate.getMonth() + 1); renderCalendar(); };

    const todayBtn = document.getElementById('cal-select-today');
    if (todayBtn) todayBtn.onclick = (e) => { e.stopPropagation(); window.calCurrentDate = new Date(); renderCalendar(); };

    const closeBtn = document.getElementById('cal-close-btn');
    if (closeBtn) closeBtn.onclick = (e) => { e.stopPropagation(); document.getElementById('calendar-popover').style.display = 'none'; };

    const datePickerBtn = document.getElementById('date-picker-btn');
    if (datePickerBtn) datePickerBtn.onclick = (e) => { e.stopPropagation(); toggleCalendar(); };

    document.addEventListener('click', (e) => {
        const calendar = document.getElementById('calendar-popover');
        const dateBtn = document.getElementById('date-picker-btn');

        if (calendar && calendar.style.display === 'block' &&
            !calendar.contains(e.target) &&
            !dateBtn.contains(e.target)) {
            calendar.style.display = 'none';
        }
    });
}

// ==========================================
// 3. Helper Functions (EPUB, Markdown)
// ==========================================

async function parseEpub(file) {
    const JSZip = await loadJSZip();
    const zip = await JSZip.loadAsync(file);
    let fullText = "";
    const parser = new DOMParser();

    try {
        const containerXml = await zip.file("META-INF/container.xml").async("string");
        const containerDoc = parser.parseFromString(containerXml, "text/xml");
        const rootfile = containerDoc.querySelector("rootfile");
        const opfPath = rootfile.getAttribute("full-path");

        const opfXml = await zip.file(opfPath).async("string");
        const opfDoc = parser.parseFromString(opfXml, "text/xml");

        const manifestItems = opfDoc.querySelectorAll("manifest > item");
        const manifest = {};
        manifestItems.forEach(item => {
            manifest[item.getAttribute("id")] = item.getAttribute("href");
        });

        const spineItems = opfDoc.querySelectorAll("spine > itemref");
        const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

        for (const item of spineItems) {
            const id = item.getAttribute("idref");
            let href = manifest[id];
            if (!href) continue;

            href = decodeURIComponent(href);
            const fullPath = opfDir + href;

            const fileInZip = zip.file(fullPath);
            if (fileInZip) {
                const content = await fileInZip.async("string");
                const doc = parser.parseFromString(content, "text/html");
                const text = doc.body ? doc.body.innerText : (doc.documentElement ? doc.documentElement.textContent : "");
                if (text && text.trim()) {
                    fullText += `\n--- ${href} ---\n${text.trim()}\n`;
                }
            }
        }
    } catch (e) {
        console.warn("EPUB strict parsing failed, falling back to naive search:", e);
        const htmlFiles = Object.keys(zip.files).filter(f => f.match(/\.(html|xhtml|htm)$/i));
        htmlFiles.sort();
        for (const path of htmlFiles) {
            if (path.includes('nav.xhtml') || path.includes('toc.xhtml')) continue;
            const content = await zip.file(path).async("string");
            const doc = parser.parseFromString(content, "text/html");
            const text = doc.body ? doc.body.innerText : "";
            if (text.trim()) fullText += `\n--- ${path} ---\n${text.trim()}\n`;
        }
    }

    return fullText || "(No text content found in EPUB)";
}

function renderMarkdown(text) {
    if (!text) return '';
    let html = escapeHtml(text);

    // Code blocks
    html = html.replace(/```(.*?)\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre><code class="language-${lang.trim()}">${code.trim()}</code></pre>`;
    });

    // Inline formatting
    html = html
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/\*(.*?)\*/g, '<i>$1</i>')
        .replace(/`(.*?)`/g, '<code>$1</code>');

    // Headers
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');

    // Lists
    html = html.replace(/^\* (.*$)/gm, '<li>$1</li>');
    html = html.replace(/^- (.*$)/gm, '<li>$1</li>');
    html = html.replace(/(<li>[\s\S]*?<\/li>)+/g, (match) => `<ul>${match}</ul>`);

    // Blockquotes
    html = html.replace(/^&gt; (.*$)/gm, '<blockquote>$1</blockquote>');

    // Tables
    const tableRegex = /^\|.*\|$/gm;
    if (html.match(tableRegex)) {
        // Simplistic table detection: line based
        // Note: reusing convertMarkdownTableToHtml from options.js logic
        const lines = html.split('\n');
        let inTable = false;
        let tableLines = [];
        let processedHtml = [];

        for (let line of lines) {
            line = line.trim();
            if (line.startsWith('|') && line.endsWith('|')) {
                if (!inTable) { inTable = true; tableLines = []; }
                tableLines.push(line);
            } else {
                if (inTable) {
                    processedHtml.push(convertMarkdownTableToHtml(tableLines));
                    inTable = false;
                }
                processedHtml.push(line);
            }
        }
        if (inTable) processedHtml.push(convertMarkdownTableToHtml(tableLines));
        html = processedHtml.join('\n');
    }

    // Line breaks
    html = html.replace(/\n{3,}/g, '\n\n');
    html = html.replace(/\n\n/g, '<p></p>');
    html = html.replace(/\n/g, '<br>');

    return html;
}

function convertMarkdownTableToHtml(lines) {
    if (lines.length < 2) return lines.join('\n');
    const extractCells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
    const headers = extractCells(lines[0]);

    let html = '<table><thead><tr>';
    headers.forEach(h => html += `<th>${h}</th>`);
    html += '</tr></thead><tbody>';

    for (let i = 2; i < lines.length; i++) {
        const cells = extractCells(lines[i]);
        if (cells.length < headers.length) continue;
        html += '<tr>';
        cells.forEach(c => html += `<td>${c}</td>`);
        html += '</tr>';
    }
    return html + '</tbody></table>';
}

// ==========================================
// 4. Chat Core Logic
// ==========================================

function setupChatEvents() {
    console.log("setupChatEvents initializing...");

    const btnCloseChat = document.getElementById('btn-close-chat');
    const chatView = document.getElementById('chat-view');

    if (btnCloseChat) {
        btnCloseChat.onclick = () => {
            chatView.classList.add('hidden');
            const btnChat = document.getElementById('btn-chat-view');
            if (btnChat) btnChat.classList.remove('active');
            setTimeout(() => { if (chatView.classList.contains('hidden')) chatView.style.display = 'none'; }, 300);
        };
    }

    // Draggable Chat
    const chatHeader = document.querySelector('.chat-header-bar');
    if (chatView && chatHeader) {
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        chatHeader.addEventListener('mousedown', (e) => {
            if (e.target.closest('button') || e.target.closest('.chat-avatar-main')) return;
            isDragging = true;
            chatView.classList.add('dragging');
            const rect = chatView.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            initialLeft = rect.left;
            initialTop = rect.top;

            chatView.style.right = 'auto';
            chatView.style.bottom = 'auto';
            chatView.style.left = initialLeft + 'px';
            chatView.style.top = initialTop + 'px';
            chatView.style.transform = 'none';

            const onMouseMove = (moveEvt) => {
                if (!isDragging) return;
                const dx = moveEvt.clientX - startX;
                const dy = moveEvt.clientY - startY;
                chatView.style.left = (initialLeft + dx) + 'px';
                chatView.style.top = (initialTop + dy) + 'px';
            };

            const onMouseUp = () => {
                isDragging = false;
                chatView.classList.remove('dragging');
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    // Clear All History
    const btnClearHistory = document.getElementById('btn-clear-history');
    if (btnClearHistory) {
        btnClearHistory.onclick = async () => {
            const ok = await showConfirm("Clear all chat history permanently? This cannot be undone.");
            if (!ok) return;

            chatSessions = [];
            currentSessionId = null;
            chatHistory = [];

            await window.idb.delete('chat_history_persistent');
            await window.idb.delete('chat_current_session_id');

            startNewChat();
            renderChatSessions();
            showToast("History cleared.");
        };
    }

    // Avatar toggle sources
    const avatarBtn = document.querySelector('.chat-avatar-main');
    const sourcesPanel = document.querySelector('.chat-sources-panel');
    if (avatarBtn && sourcesPanel && chatView) {
        avatarBtn.onmousedown = (e) => { e.stopPropagation(); };
        avatarBtn.onclick = (e) => {
            e.stopPropagation();
            const isHidden = sourcesPanel.style.display === 'none';
            sourcesPanel.style.display = isHidden ? 'flex' : 'none';
            renderChatSources();
        };
    }

    // Drag Drop handlers
    const handleGlobalDrop = async (e) => {
        e.preventDefault();
        const dragOverlay = document.getElementById('chat-drag-overlay');
        if (dragOverlay) dragOverlay.style.display = 'none';

        // 1. Highlighti Page
        const pageData = e.dataTransfer.getData('application/highlighti-page');
        if (pageData) {
            try {
                const data = JSON.parse(pageData);
                await addChatSource(data);
                showToast(`Added source: ${data.title}`);
                return;
            } catch (err) { console.error(err); }
        }

        // 2. JSON (Notes or IDs)
        const jsonDataRaw = e.dataTransfer.getData('application/json');
        if (jsonDataRaw) {
            try {
                const data = JSON.parse(jsonDataRaw);

                // CASE A: Dropped a specific Note from Notes Tree
                if (data && data.type === 'note' && data.id) {
                    // Try to find in window.notes (if loaded in this context)
                    let note = (window.notes || []).find(n => n.id === data.id);
                    // Fallback: Use data from drag payload (from iframe)
                    if (!note && data.title) {
                        note = { id: data.id, title: data.title, content: data.content };
                    }

                    if (note) {
                        await addChatSource({
                            url: `note://${note.id}`,
                            title: `📝 ${note.title || 'Untitled Note'}`,
                            items: [{ text: note.content || '', type: 'text' }]
                        });
                        showToast(`Added note: ${note.title}`);
                    }
                    return;
                }

                // CASE B: Array of IDs (Legacy/Other)
                if (Array.isArray(data)) {
                    for (const id of data) {
                        const page = (window.groupedData || []).find(p => p.url === id || p.id === id);
                        if (page) await addChatSource(page.url);
                    }
                }
                return;
            } catch (err) { }
        }

        // 3. Files
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            await importFilesToChat(e.dataTransfer.files);
        }
    };

    if (chatView) {
        chatView.addEventListener('dragover', (e) => {
            e.preventDefault();
            const dragOverlay = document.getElementById('chat-drag-overlay');
            if (dragOverlay) dragOverlay.style.display = 'flex';
        });
        chatView.addEventListener('dragleave', (e) => {
            if (!chatView.contains(e.relatedTarget)) {
                const dragOverlay = document.getElementById('chat-drag-overlay');
                if (dragOverlay) dragOverlay.style.display = 'none';
            }
        });
        chatView.addEventListener('drop', handleGlobalDrop);
    }

    // Setup Calendar
    setupCalendarEvents();

    // Inputs
    const btnSend = document.getElementById('btn-send-chat');
    const input = document.getElementById('chat-input-text');

    const sendMessage = async () => {
        const text = input.value.trim();
        if (!text || isGenerating) return;
        addChatMessage('user', text);
        input.value = '';
        input.style.height = 'auto';
        btnSend.disabled = true;
        await processAIChat(text);
        btnSend.disabled = false;
        input.focus();
    };

    if (btnSend) btnSend.onclick = sendMessage;
    if (input) {
        input.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
        };
        input.oninput = () => {
            input.style.height = 'auto';
            input.style.height = input.scrollHeight + 'px';
            if (btnSend) btnSend.disabled = !input.value.trim();
        };
    }

    // Other buttons (Clear, New, History) logic...
    const btnNewChat = document.getElementById('btn-new-chat');
    if (btnNewChat) btnNewChat.onclick = startNewChat;

    const btnShowHistory = document.getElementById('btn-show-history');
    if (btnShowHistory) {
        btnShowHistory.onclick = (e) => {
            e.stopPropagation();
            const popover = document.getElementById('chat-sessions-popover');
            if (popover) {
                popover.style.display = (popover.style.display === 'none') ? 'block' : 'none';
                renderChatSessions();
            }
        };
    }
}

async function importFilesToChat(files) {
    if (!files || files.length === 0) return;
    for (const file of files) {
        const fileName = file.name;
        const fileUrl = `local-file://${Date.now()}_${fileName}`;
        const ext = fileName.toLowerCase().split('.').pop();

        let text = "";

        if (['jpg', 'jpeg', 'png', 'bmp', 'webp'].includes(ext)) {
            // Basic OCR placeholder
            showToast(`Processing image ${fileName}...`);
            // Reuse Tesseract logic if available or just dummy
            // For brevity in this refactor, we assume just adding it as file source
            chatSources.push({ url: fileUrl, title: `🖼️ ${fileName}`, items: [{ text: "(Image Content)", type: 'text' }] });
        } else if (ext === 'epub') {
            text = await parseEpub(file);
            chatSources.push({ url: fileUrl, title: `📚 ${fileName}`, items: [{ text, type: 'text' }] });
        } else {
            // Plain text fallback
            const reader = new FileReader();
            reader.onload = (e) => {
                chatSources.push({ url: fileUrl, title: `📄 ${fileName}`, items: [{ text: e.target.result, type: 'text' }] });
                renderChatSources();
            };
            reader.readAsText(file);
            continue; // Async handled
        }
        renderChatSources();
    }
}

async function addChatSource(urlOrObj) {
    let page = null;
    let url = '';

    if (typeof urlOrObj === 'string') {
        url = urlOrObj;
        page = (window.groupedData || []).find(p => p.url === url);
    } else {
        page = urlOrObj;
        url = page.url;
    }

    if (chatSources.find(s => s.url === url)) return;

    if (!page) return showToast('Source not found or data missing');

    chatSources.push({
        url: page.url,
        title: page.title || 'Untitled Source',
        items: page.items || []
    });
    renderChatSources();
}

function removeChatSource(url) {
    const index = chatSources.findIndex(s => s.url === url);
    if (index !== -1) {
        chatSources.splice(index, 1);
        renderChatSources();
    }
}

function renderChatSources() {
    const list = document.getElementById('sources-list');
    const dropZone = document.getElementById('drop-zone');
    if (!list) return;

    list.innerHTML = '';

    if (dropZone) {
        if (chatSources.length > 0) {
            dropZone.classList.add('mini');
        } else {
            dropZone.classList.remove('mini');
            dropZone.style.display = 'block';
        }
    }

    chatSources.forEach(source => {
        const div = document.createElement('div');
        div.className = 'chat-source-item';
        div.innerHTML = `
            <div class="source-title" title="${escapeHtml(source.title)}">${escapeHtml(source.title)}</div>
            <div class="remove-btn">×</div>
        `;
        div.querySelector('.remove-btn').onclick = (e) => {
            e.stopPropagation();
            removeChatSource(source.url);
        };
        list.appendChild(div);
    });
}

function addChatMessage(role, text, isStreaming = false) {
    const container = document.getElementById('chat-history-container');
    if (!container) return;

    // Remove welcome message if it exists
    const welcome = container.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    const div = document.createElement('div');
    div.className = `chat-message ${role}`;

    const userIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
    const aiIcon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>`;
    const avatar = role === 'user' ? userIcon : aiIcon;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    if (isStreaming) bubble.classList.add('streaming-cursor');

    let thinkingDiv = null;
    let contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    div.innerHTML = `<div class="chat-avatar">${avatar}</div>`;
    bubble.appendChild(contentDiv);
    div.appendChild(bubble);
    container.appendChild(div);

    if (role === 'user') {
        contentDiv.innerHTML = renderMarkdown(text);
        chatHistory.push({ role, content: text });

        // Initial simple title (fallback)
        if (chatHistory.length === 1) {
            const session = chatSessions.find(s => s.id === currentSessionId);
            if (session && session.title === 'New Chat') {
                session.title = text.substring(0, 15) + (text.length > 15 ? '...' : '');
                saveChatHistory();
                renderChatSessions();
            }
        }
        saveChatHistory();
    } else if (!isStreaming) {
        contentDiv.innerHTML = renderMarkdown(text);
    }

    // Helper: Check if near bottom
    const isNearBottom = () => {
        const threshold = 30; // Strict threshold (30px)
        const dist = container.scrollHeight - container.scrollTop - container.clientHeight;
        return dist < threshold;
    };

    container.scrollTop = container.scrollHeight;

    if (isStreaming) {
        return {
            updateContent: (newText) => {
                const atBottom = isNearBottom();
                contentDiv.innerHTML = renderMarkdown(newText);
                if (atBottom) {
                    container.scrollTop = container.scrollHeight;
                }
            },
            updateThinking: (thinkingText) => {
                const shouldScroll = isNearBottom();
                if (!thinkingDiv) {
                    thinkingDiv = document.createElement('div');
                    thinkingDiv.className = 'thinking-process';
                    thinkingDiv.innerHTML = `
                        <div class="thinking-title">
                            <svg viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="spin-slow">
                                <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
                            </svg>
                            Thinking Process
                        </div>
                        <div class="thinking-content"></div>
                    `;
                    bubble.insertBefore(thinkingDiv, contentDiv);
                }
                thinkingDiv.querySelector('.thinking-content').innerText = thinkingText;
                if (shouldScroll) {
                    container.scrollTop = container.scrollHeight;
                }
            },
            done: (finalContent, finalThinking) => {
                bubble.classList.remove('streaming-cursor');
                chatHistory.push({
                    role: 'ai',
                    content: finalContent,
                    reasoning_content: finalThinking
                });
                saveChatHistory();

                // Auto-save this turn to Notes
                try {
                    const lastUserMsg = chatHistory.slice().reverse().find(m => m.role === 'user');
                    if (lastUserMsg) {
                        autoPushToNote(lastUserMsg.content, finalContent);
                    }
                } catch (e) {
                    console.error('Auto-save to Note failed:', e);
                }
            }
        };
    }
}

/**
 * Automatically format and push a single Q&A turn to the Notes module
 */
function autoPushToNote(question, answer) {
    if (!answer || answer.length < 5) return; // Skip trivial exchanges

    // Check if we should auto-push (could be a setting later, for now we do it)
    const htmlContent = `
        <div class="chat-saved-note">
            <p><strong>Quest:</strong> ${renderMarkdown(question)}</p>
            <p><strong>AI:</strong></p>
            <div class="ai-ans">${renderMarkdown(answer)}</div>
            <p style="font-size:11px; color:#999; margin-top:10px;">Source: AI Chat Auto-save - ${new Date().toLocaleString()}</p>
        </div>
    `;

    let title = 'AI Insights';
    if (chatSources && chatSources.length > 0) {
        title = chatSources[0].title || 'AI Chat Summary';
    } else {
        const cleanQ = (question || '').replace(/[#*`]/g, '').trim();
        title = cleanQ.substring(0, 35).trim() + (cleanQ.length > 35 ? '...' : '');
    }

    const noteData = {
        type: 'CREATE_CHAT_NOTE',
        data: {
            title: title,
            content: htmlContent,
            isAutoSaved: true,
            chatSessionId: currentSessionId
        }
    };

    const iframe = document.querySelector('#notes-view iframe');
    if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(noteData, '*');
        console.log('[AI Chat] Pushed to Notes iframe');
    } else {
        console.warn('[AI Chat] Notes iframe not found for auto-push');
    }
}

async function saveChatHistory(manual = false) {
    const sessionIndex = chatSessions.findIndex(s => s.id === currentSessionId);
    if (sessionIndex !== -1) {
        chatSessions[sessionIndex].messages = chatHistory;
        chatSessions[sessionIndex].sources = chatSources;
        chatSessions[sessionIndex].timestamp = Date.now();
    } else if (currentSessionId) {
        chatSessions.push({
            id: currentSessionId,
            title: chatHistory[0] ? chatHistory[0].content.substring(0, 30) : 'New Chat',
            timestamp: Date.now(),
            messages: chatHistory,
            sources: chatSources
        });
    }

    // Switch to IndexedDB
    await window.idb.set('chat_history_persistent', chatSessions);
    await window.idb.set('chat_current_session_id', currentSessionId);

    if (manual) showToast('Saved');
}

async function loadChatHistory() {
    console.log('[options-chat] Loading chat history...');
    try {
        // 1. Try IndexedDB
        let sessions = await window.idb.get('chat_history_persistent');
        let savedSessionId = await window.idb.get('chat_current_session_id');

        // 2. Migration
        if (sessions === undefined) {
            console.log('[options-chat] IndexedDB empty, checking chrome.storage.local for migration...');
            const altKeys = ['chat_history_persistent', 'chatHistory', 'chat_history', 'chat_sessions'];
            const res = await chrome.storage.local.get([...altKeys, 'chat_current_session_id']);

            sessions = res.chat_history_persistent || res.chatHistory || res.chat_history || res.chat_sessions || [];
            savedSessionId = res.chat_current_session_id;

            // LEGACY CHECK: If sessions is a simple array of messages (not session objects)
            if (sessions.length > 0 && !sessions[0].messages) {
                console.log('[options-chat] Legacy message array found. Converting to session...');
                const legacySession = {
                    id: 'legacy_' + Date.now(),
                    title: (sessions[0].content || '').substring(0, 30).trim() || 'Imported Chat',
                    timestamp: Date.now(),
                    messages: sessions,
                    sources: []
                };
                sessions = [legacySession];
                if (!savedSessionId) savedSessionId = legacySession.id;
            }

            // Save to IDB immediately to finalize migration
            await window.idb.set('chat_history_persistent', sessions);
            if (savedSessionId) await window.idb.set('chat_current_session_id', savedSessionId);
            console.log('[options-chat] Migration complete. Loaded', sessions.length, 'sessions.');
        }

        chatSessions = sessions || [];
        currentSessionId = savedSessionId || (chatSessions.length > 0 ? chatSessions[0].id : null);

        if (currentSessionId) {
            await switchToSession(currentSessionId);
        } else {
            console.log('[options-chat] No sessions found, starting fresh.');
            await startNewChat();
        }
    } catch (err) {
        console.error('[options-chat] loadChatHistory Error:', err);
        startNewChat(); // Fallback to fresh state
    }
}

async function switchToSession(id) {
    currentSessionId = id;
    const session = chatSessions.find(s => s.id === currentSessionId);

    if (session) {
        chatHistory = session.messages || [];
        chatSources = session.sources || [];
    } else {
        chatHistory = [];
        chatSources = [];
    }

    renderCurrentChat();
    renderChatSources();
    renderChatSessions();

    // Persist current session ID in IDB
    await window.idb.set('chat_current_session_id', currentSessionId);
}

function renderCurrentChat() {
    const container = document.getElementById('chat-history-container');
    if (!container) return;
    container.innerHTML = '';

    if (chatHistory.length === 0) {
        container.innerHTML = '<div class="chat-welcome">Welcome to AI Chat</div>';
        return;
    }

    chatHistory.forEach(m => {
        const div = document.createElement('div');
        div.className = `chat-message ${m.role}`;

        const userIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
        const aiIcon = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>`;
        const avatar = m.role === 'user' ? userIcon : aiIcon;

        div.innerHTML = `
            <div class="chat-avatar">${avatar}</div>
            <div class="chat-bubble">
                <div class="message-content">${renderMarkdown(m.content)}</div>
                ${m.role === 'ai' ? `
                <div class="chat-bubble-actions" style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px; border-top:1px solid rgba(0,0,0,0.05); padding-top:4px;">
                    <button class="chat-action-btn" title="Add to Notes" style="background:none; border:none; color:#6366f1; cursor:pointer; font-size:11px; display:flex; align-items:center; gap:4px; opacity:0.7;">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        To Note
                    </button>
                </div>
                ` : ''}
            </div>
        `;

        if (m.role === 'ai') {
            const btn = div.querySelector('.chat-action-btn');
            if (btn) {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const prevUserMsg = chatHistory.slice(0, chatHistory.indexOf(m)).reverse().find(msg => msg.role === 'user');
                    autoPushToNote(prevUserMsg ? prevUserMsg.content : 'Question', m.content);
                    showToast('Pushed to Notes');
                    btn.innerHTML = '✓ Added';
                    btn.style.color = '#10b981';
                };
            }
        }

        container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
}

function startNewChat() {
    currentSessionId = 'session_' + Date.now();
    chatHistory = [];
    chatSources = [];

    chatSessions.unshift({
        id: currentSessionId,
        title: 'New Chat',
        timestamp: Date.now(),
        messages: [],
        sources: []
    });

    calSelectedStart = null;
    calSelectedEnd = null;

    switchToSession(currentSessionId);
    saveChatHistory();
}

function renderChatSessions() {
    const list = document.getElementById('chat-sessions-list');
    if (!list) return;
    list.innerHTML = '';
    chatSessions.forEach(s => {
        const div = document.createElement('div');
        div.innerText = s.title || 'Untitled';
        div.className = 'chat-session-item';
        div.style.padding = '8px';
        div.style.cursor = 'pointer';
        div.style.borderRadius = '4px';
        div.style.marginBottom = '2px';
        div.style.fontSize = '13px';
        div.style.color = '#333';

        if (s.id === currentSessionId) {
            div.style.background = '#e0e7ff';
            div.style.color = '#4338ca';
            div.style.fontWeight = '500';
        } else {
            div.style.background = 'transparent';
        }

        div.onmouseenter = () => { if (s.id !== currentSessionId) div.style.background = '#f5f5f5'; };
        div.onmouseleave = () => { if (s.id !== currentSessionId) div.style.background = 'transparent'; };

        div.onclick = (e) => {
            e.stopPropagation();
            switchToSession(s.id);
            // Hide popover after selection
            const popover = document.getElementById('chat-sessions-popover');
            if (popover) popover.style.display = 'none';
        };
        list.appendChild(div);
    });
}


function generateLocalSummary() {
    if (!chatSources || chatSources.length === 0) return "No sources selected.";
    let summary = "### 📂 Local Sources Summary (No API Key)\n\n";
    chatSources.forEach((s, i) => {
        summary += `**${i + 1}. ${s.title}**\n`;
        // Increased limit to 3000 chars for better coverage
        const preview = s.items.map(item => item.text || "").join('\n').substring(0, 3000);
        summary += `> ${preview}${preview.length >= 3000 ? '...\n*(Content truncated)*' : ''}\n\n`;
    });
    summary += "\n*Tip: Configure an API Key in Settings to chat with these documents.*";
    return summary;
}

async function generateChatTitle(userQuery) {
    try {
        const settings = await chrome.storage.local.get(['ai_api_key', 'ai_base_url', 'ai_model', 'deepseek_api_key', 'deepseek_base_url', 'deepseek_model']);
        const apiKey = settings.ai_api_key || settings.deepseek_api_key;
        let baseUrl = settings.ai_base_url || settings.deepseek_base_url || 'https://api.deepseek.com';
        const model = settings.ai_model || settings.deepseek_model || 'deepseek-chat';

        if (baseUrl.endsWith('/')) baseUrl = baseUrl.substring(0, baseUrl.length - 1);
        if (!apiKey) return;

        console.log("Generating chat title...");
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: "system", content: "Summarize the user's message into a very short, concise title (max 5 words). Do not use info like \"User asks...\". Return ONLY the title text." },
                    { role: "user", content: userQuery }
                ],
                stream: false
            })
        });

        if (response.ok) {
            const data = await response.json();
            const title = data.choices[0].message.content.trim().replace(/^["']|["']$/g, '');
            if (title) {
                const session = chatSessions.find(s => s.id === currentSessionId);
                if (session) {
                    session.title = title;
                    saveChatHistory();
                    renderChatSessions();
                }
            }
        }
    } catch (e) {
        console.warn("Title generation failed:", e);
    }
}

async function processAIChat(userQuery) {
    if (isGenerating) return;
    console.log("processAIChat started", userQuery);
    isGenerating = true;
    const loading = document.getElementById('loading-indicator');
    if (loading) loading.style.display = 'block';

    try {
        // 0. Get API Settings
        const settings = await chrome.storage.local.get(['ai_api_key', 'ai_base_url', 'ai_model', 'deepseek_api_key', 'deepseek_base_url', 'deepseek_model']);
        const apiKey = settings.ai_api_key || settings.deepseek_api_key;
        const baseUrl = settings.ai_base_url || settings.deepseek_base_url || 'https://api.deepseek.com';
        const model = settings.ai_model || settings.deepseek_model || 'deepseek-chat';

        if (!apiKey) {
            if (chatSources.length > 0) {
                const summary = generateLocalSummary();
                addChatMessage('ai', summary);
                saveChatHistory(); // Explicitly save history
            } else {
                addChatMessage('ai', 'Error: API Key not found and no sources selected. Please check Settings.');
            }
            isGenerating = false;
            if (loading) loading.style.display = 'none';
            return;
        }

        // 1. Generate Source Fingerprint (to detect changes)
        const currentSourceSignature = chatSources.map(s => s.url).sort().join('|');

        // 2. Rebuild Context (if sources changed or not initialized)
        if (!cachedSystemContext || currentSourceSignature !== lastSourceSignature) {
            console.log("Rebuilding context...");

            let contextStr = "";
            if (chatSources.length > 0) {
                contextStr += "这是用户提供的参考资料(Context/Sources)：\n\n";
                chatSources.forEach((s, i) => {
                    // Token Optimization: Limit per-source content and prioritize text
                    let content = s.items.map(item => {
                        if (item.type === 'image') {
                            return `[Image Content: See the image attached to the user message]\n(Note: ${item.note || item.text || 'No text note attached'})`;
                        }
                        return item.text || "";
                    }).join('\n');
                    const MAX_PER_SOURCE = 8000;
                    if (content.length > MAX_PER_SOURCE) {
                        content = content.substring(0, MAX_PER_SOURCE) + "\n[Content Truncated for Token Saving]";
                    }
                    contextStr += `=== Source ${i + 1}: ${s.title} ===\n${content}\n\n`;
                });
            } else {
                contextStr = "";
            }

            // Limit length
            const MAX_CONTEXT_LENGTH = 20000;
            if (contextStr.length > MAX_CONTEXT_LENGTH) {
                contextStr = contextStr.substring(0, MAX_CONTEXT_LENGTH) + "\n\n[System: Context truncated]";
            }

            cachedSystemContext = contextStr;
            lastSourceSignature = currentSourceSignature;
        }

        // 3. Construct API Message List
        const messages = [];

        // [System Message]
        const systemPrompt = `你是一个专业的学术研究助手，具有较高的创意，较好的逻辑推理能力，能够很好的整合资料。请遵循以下逻辑回答用户问题：
1. 如果提供了参考资料（1、2、3...），请优先基于资料回答问题，深度分析并提供有价值的想法。
2. 如果未提供参考资料，或者问题与资料无关，请利用你的广博知识库（Long-term Memory）直接回答，不需要提及“没有提供资料”。
3. 始终保持上下文连续性（Short-term Memory），结合之前的对话历史来理解当前问题。
4. 回答时请使用用户输入的语言。
5. 引用材料时，必须将引用标识（如 [Source 1]）放在对应段落或句子的末尾，不要穿插在句子中间，以确保阅读流畅。
6. 保持条理清晰，适当使用 Markdown 格式。
7. 如果提供的是CSV或Excel数据，请将其视为结构化数据进行分析，就像你直接看到表格一样。不要因为它是文本格式就认为无法分析。
8. 当用户提问如果不包含明确上下文（如“这是什么”），请优先根据[Source Materials]或[History Messages]进行智能推断，尽可能直接尝试回答，不要轻易反问用户索要更多信息，除非完全无法理解。`;

        // Only append sources if they exist
        let finalSystemContent = systemPrompt;
        if (cachedSystemContext) {
            finalSystemContent += `\n\n[Source Materials]: \n${cachedSystemContext}`;
        }

        // [Memory Agent Integration]
        if (window.memoryAgent) {
            await window.memoryAgent.init();
            const memoryContext = await window.memoryAgent.retrieveContext(userQuery);
            if (memoryContext) {
                finalSystemContent += `\n\n[Human Long-term Memory / Knowledge Base]:\n${memoryContext}`;
            }
        }

        messages.push({
            role: "system",
            content: finalSystemContent
        });

        // [History Messages] 添加历史记录
        // 注意：这里需要做 role 映射，把 'ai' 转为 'assistant'
        // 包含之前的对话历史作为短期记忆
        const recentHistory = chatHistory.slice(-20);

        // [Image Handling] Check if we have images in sources
        const imageSources = chatSources.filter(s => s.items && s.items.some(i => i.type === 'image'));

        recentHistory.forEach((msg, index) => {
            // === 关键修复 ===
            // 本地代码用 'ai'，但 API 需要 'assistant'
            const apiRole = (msg.role === 'ai') ? 'assistant' : 'user';

            // If this is the LATEST user message AND we have images, attach them
            const isLatestUserMessage = (index === recentHistory.length - 1) && (apiRole === 'user');

            // Vision Support Check: Only send images if the model name suggests vision capabilities
            // Expanded list to support Qwen-VL, Doubao, Hunyuan, etc. if user proxies them properly.
            const m = model.toLowerCase();
            let isVisionModel = m.includes('vision') || m.includes('vl') ||
                m.includes('gpt-4o') || m.includes('claude-3') ||
                m.includes('gemini') || m.includes('gpt-4-turbo') ||
                m.includes('qwen') || m.includes('doubao') || m.includes('hunyuan');

            // Safety: DeepSeek API (official) does not support 'gpt-4o' or standard image_url yet (unless using VL models)
            if (baseUrl.includes('api.deepseek.com') && !m.includes('vl') && !m.includes('janus')) {
                isVisionModel = false;
            }

            // [New] Detect Inline Image URLs in text
            const inlineImageUrls = [];
            if (isLatestUserMessage) {
                // Regex: Match http/https URLs ending in image extensions
                const urlRegex = /(https?:\/\/[^\s]+?\.(?:png|jpg|jpeg|webp|gif|bmp))/gi;
                const matches = msg.content.match(urlRegex);
                if (matches) {
                    matches.forEach(url => inlineImageUrls.push(url));
                }
            }

            // Check if we have ANY images to process
            const hasImages = (imageSources.length > 0 || inlineImageUrls.length > 0);

            if (isLatestUserMessage && hasImages) {
                if (isVisionModel) {
                    // --- Case A: Vision Model (Send Native Image Payload) ---
                    // Construct Multi-modal Message
                    const contentParts = [
                        { type: "text", text: msg.content }
                    ];

                    // 1. Add Dragged/Checked Images (Base64)
                    imageSources.forEach(source => {
                        source.items.forEach(item => {
                            if (item.type === 'image' && item.src) {
                                contentParts.push({
                                    type: "image_url",
                                    image_url: {
                                        url: item.src // src is already base64 data url
                                    }
                                });
                            }
                        });
                    });

                    // 2. Add Inline URL Images
                    inlineImageUrls.forEach(url => {
                        contentParts.push({
                            type: "image_url",
                            image_url: { url: url }
                        });
                    });

                    messages.push({
                        role: apiRole,
                        content: contentParts
                    });
                    console.log("Attached images to latest user message (Vision Mode):", contentParts.length - 1);

                } else {
                    // --- Case B: Non-Vision Model (Fallback) ---
                    // Append Image URLs/Info to text so AI knows about them
                    let fallbackText = msg.content + "\n\n[System Note: The user provided the following images, but the current AI model does not support visual input (Vision).]";

                    inlineImageUrls.forEach((url, i) => {
                        fallbackText += `\nImage URL ${i + 1}: ${url}`;
                    });

                    if (imageSources.length > 0) {
                        fallbackText += `\n(Also provided ${imageSources.length} embedded images which cannot be displayed to this text-only model)`;
                    }

                    messages.push({
                        role: apiRole,
                        content: fallbackText
                    });
                    console.log("Attached image info to latest user message (Text Fallback)");
                }

            } else {
                // Std Text Message
                messages.push({
                    role: apiRole,
                    content: msg.content
                });
            }
        });


        if (!apiKey) {
            addChatMessage('ai', 'Error: API Key not found. Please check Settings.');
            return;
        }

        // 5. 初始化流式 UI
        const ui = addChatMessage('ai', '', true);
        let fullContent = "";
        let fullReasoning = "";

        // 6. 发送流式请求
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                stream: true
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API Error ${response.status}: ${errText}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop(); // 保留不完整的行

            for (const line of lines) {
                const cleanedLine = line.trim();
                if (!cleanedLine || cleanedLine === "data: [DONE]") continue;

                if (cleanedLine.startsWith("data: ")) {
                    try {
                        const json = JSON.parse(cleanedLine.substring(6));
                        const delta = json.choices[0].delta || {};

                        // 捕捉思考过程 (DeepSeek 支持 reasoning_content)
                        if (delta.reasoning_content) {
                            fullReasoning += delta.reasoning_content;
                            ui.updateThinking(fullReasoning);
                        }

                        // 捕捉正式内容
                        if (delta.content) {
                            fullContent += delta.content;
                            ui.updateContent(fullContent);
                        }
                    } catch (e) {
                        // 忽略半个 JSON
                    }
                }
            }
        }

        ui.done(fullContent, fullReasoning);

        // [Memory Agent Auto-Save]
        if (window.memoryAgent && fullContent) {
            // Using a timeout to not block UI thread
            setTimeout(() => {
                window.memoryAgent.processInteraction(userQuery, fullContent);
            }, 100);
        }

    } catch (e) {
        console.error("AI Chat Error:", e);
        addChatMessage('ai', `Error: ${e.message} `);
    } finally {
        isGenerating = false;
        if (loading) loading.style.display = 'none';

        // Trigger Auto-Title if this is the first exchange
        if (chatHistory.length <= 2) {
            generateChatTitle(userQuery);
        }
    }
}

// Global PPT Preview Listener
// Global Event Listener for PPT Preview Button
document.addEventListener('click', (e) => {
    if (e.target && e.target.closest('.btn-open-ppt-preview')) {
        const btn = e.target.closest('.btn-open-ppt-preview');
        // Find the parent bubble
        const bubble = btn.closest('.chat-bubble');
        if (!bubble) return;

        // Try to find a JSON code block in this bubble
        let codeBlock = bubble.querySelector('pre code.language-json');

        // Fallback: Check for ANY code block that looks like JSON
        if (!codeBlock) {
            const allBlocks = bubble.querySelectorAll('pre code');
            for (const blk of allBlocks) {
                const text = blk.textContent.trim();
                if (text.startsWith('{') && text.endsWith('}')) {
                    codeBlock = blk;
                    break;
                }
            }
        }

        if (codeBlock) {
            try {
                const jsonText = codeBlock.innerText || codeBlock.textContent;
                const pptData = JSON.parse(jsonText);
                console.log("Restoring PPT preview from history:", pptData);

                // Call openPPTPreview (assuming it's loaded in global scope by ppt-service.js)
                if (typeof openPPTPreview === 'function') {
                    openPPTPreview(pptData);
                } else {
                    alert("PPT Service not loaded. Please refresh the page.");
                }
            } catch (err) {
                console.error("Failed to parse stored PPT JSON:", err);
                alert("Failed to read PPT data. The JSON might be corrupted.");
            }
        } else {
            alert("No PPT data found in this message.");
        }
    }
});
