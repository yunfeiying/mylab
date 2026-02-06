/**
 * options-ui.js - 通用 UI 渲染与视图组件
 * 包含: 标亮列表渲染, 网页预览, 设置面板等
 */

// ==========================================
// 1. 页面切换与核心视图
// ==========================================

window.selectPage = async function (url) {
    window.isSearchMode = false;
    window.currentSearchQuery = '';
    const searchContainer = document.getElementById('search-container');
    if (searchContainer) searchContainer.style.display = 'none';

    const resView = document.getElementById('resource-view');
    if (resView) resView.style.display = 'none';

    const chatView = document.getElementById('chat-view');
    if (chatView) chatView.style.display = 'none';
    const btnChat = document.getElementById('btn-chat-view');
    if (btnChat) btnChat.classList.remove('active');

    const notesView = document.getElementById('notes-view');
    if (notesView) notesView.style.display = 'none';
    const btnNotes = document.getElementById('btn-notes-view');
    if (btnNotes) btnNotes.classList.remove('active');

    window.selectedUrl = url;
    document.querySelectorAll('.page-item').forEach(el => { el.classList.toggle('active', el.dataset.url === url); });

    const page = window.groupedData.find(p => p.url === url);
    if (!page) { window.showEmptyState(); return; }

    const emptyState = document.getElementById('empty-state');
    if (emptyState) emptyState.style.display = 'none';
    const contentView = document.getElementById('content-view');
    if (contentView) contentView.style.display = 'flex';

    const titleEl = document.getElementById('current-page-title');
    if (titleEl) {
        titleEl.innerText = page.title;
        titleEl.contentEditable = 'false';
        titleEl.style.borderBottom = 'none';
    }

    const editBtnWrapper = document.querySelector('.edit-title-btn');
    if (editBtnWrapper) {
        const svgIcon = editBtnWrapper.querySelector('svg');
        if (svgIcon) svgIcon.innerHTML = '<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>';
    }

    const dateEl = document.getElementById('current-page-date');
    if (dateEl) dateEl.innerText = window.safeFormatDate ? window.safeFormatDate(page.timestamp, false) : new Date(page.timestamp).toLocaleDateString();
    const countEl = document.getElementById('current-page-count');
    if (countEl) countEl.innerText = `${page.items.length} highlights`;

    try { await window.setupInspiration(url); } catch (e) { console.warn(e); }
    window.renderHighlightList(page.items);
    window.renderSnapshot(url);

    const mainDiv = document.querySelector('.main');
    if (mainDiv) mainDiv.scrollTop = 0;
};

// ==========================================
// 2. 标亮列表与详情渲染
// ==========================================

window.renderHighlightList = function (items) {
    const listEl = document.getElementById('highlight-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (window.activeColorFilter) items = items.filter(i => i.color === window.activeColorFilter);
    if (window.currentSortType === 'doc') items.sort((a, b) => a.timestamp - b.timestamp);
    else items.sort((a, b) => b.timestamp - a.timestamp);

    if (items.length === 0) {
        listEl.innerHTML = `<div style="text-align:center; color:#ccc; padding:20px;">${chrome.i18n.getMessage('ui_noContent')}</div>`;
        return;
    }

    items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'highlight-row';

        let sourceHtml = '';
        if (item.sourceTitle) {
            sourceHtml = `<div class="search-source-wrapper"><svg class="search-source-icon" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg><a href="#" class="search-source-text" data-url="${item.sourceUrl}">${window.escapeHtml(item.sourceTitle)}</a></div>`;
        }

        let contentHtml = '';
        if (item.type === 'image') {
            const textContent = item.note || item.text || '';
            let textHtml = '';
            if (textContent && textContent.length >= 10 && !textContent.includes('\ufffd') && !textContent.includes('Screenshot and OCR') && !textContent.includes('Screenshot Mark')) {
                const iconDel = `<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:currentColor;vertical-align:middle;"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
                const iconEdit = `<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:currentColor;vertical-align:middle;"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`;
                textHtml = `
                    <div class="ocr-edit-wrapper" style="position:relative; margin-top:8px; padding:8px; padding-bottom:26px; background:#f5f5f5; border-left: 3px solid #ff9800; border-radius:2px;">
                        <div class="ocr-content-div" style="font-size:13px; color:#333; line-height:1.6; white-space: pre-wrap; word-break: break-all; outline:none;">${window.escapeHtml(textContent)}</div>
                        <button class="ocr-del-btn" title="Delete" style="position:absolute; bottom:0; right:42px; border:none; background:transparent; cursor:pointer; padding:4px 8px; color:#9c9797; border-radius:4px 4px 0 0; display:flex; align-items:center;">${iconDel}</button>
                        <button class="ocr-edit-btn" title="Edit" style="position:absolute; bottom:0; right:0; border:none; background:transparent; cursor:pointer; padding:4px 10px; color:#9c9797; border-radius:4px 0 2px 0; display:flex; align-items:center;">${iconEdit}</button>
                    </div>
                `;
            }
            contentHtml = `<div class="image-content-wrapper"><img src="${item.src}" style="max-width:300px; max-height:400px; border-radius:4px; border:1px solid #eee; display:block;">${textHtml}</div>`;
        } else if (item.type === 'video') {
            if (item.src && item.src.length > 50) {
                contentHtml = `
                    <div style="position:relative; display:inline-block; min-width:80px; background:#f5f5f5; border-radius:4px;">
                        <img src="${item.src}" style="max-width:200px; border-radius:4px; display:block;"
                             onerror="this.style.display='none';
                                      var ts = this.nextElementSibling;
                                      ts.style.position='static';
                                      ts.style.background='transparent';
                                      ts.style.color='#666';
                                      ts.style.padding='6px 10px';
                                      ts.innerHTML = ' [Error] ' + ts.innerText;">
                        <div style="position:absolute; bottom:4px; right:4px; background:rgba(0,0,0,0.7); color:#fff; font-size:10px; padding:1px 4px; border-radius:3px;">${window.formatTime(item.videoTime)}</div>
                    </div>`;
            } else {
                contentHtml = `<span style="color:#666;">[Video] ${window.formatTime(item.videoTime)}</span>`;
            }
        } else {
            contentHtml = window.escapeHtml(item.text);
        }

        const iconRowDel = `<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

        let metaIconsHtml = '';
        if (item.tag) {
            metaIconsHtml += `
            <div class="meta-icon-wrapper" style="position:relative; cursor:pointer;" title="Tag">
                <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:#ccc;"><path d="M20 12l-7.07-7.07c-.39-.39-1.02-.39-1.41 0l-9.19 9.19c-.39.39-.39 1.02 0 1.41L12 20c.39.39 1.02.39 1.41 0l7.07-7.07c.2-.2.31-.47.31-.76V12.76c0-.28-.11-.55-.31-.76zM5.25 7.66c-.52-.52-.52-1.37 0-1.89s1.37-.52 1.89 0 .52 1.37 0 1.89-1.37.52-1.89 0z"/></svg>
                <div class="meta-popover" style="display:none; position:absolute; left:20px; top:0; background:#333; color:#fff; padding:4px 8px; font-size:11px; border-radius:4px; white-space:nowrap; z-index:100;">${window.escapeHtml(item.tag)}</div>
            </div>`;
        }
        if (item.role) {
            metaIconsHtml += `
            <div class="meta-icon-wrapper" style="position:relative; cursor:pointer;" title="Role">
                <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:#ccc;"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                <div class="meta-popover" style="display:none; position:absolute; left:20px; top:0; background:#333; color:#fff; padding:4px 8px; font-size:11px; border-radius:4px; white-space:nowrap; z-index:100;">${window.escapeHtml(item.role)}</div>
            </div>`;
        }

        row.innerHTML = `
            <div class="checkbox-column" style="display:flex; flex-direction:column; align-items:center; gap:8px; margin-right:10px;">
                <input type="checkbox" class="select-checkbox" data-id="${item.id}">
                ${metaIconsHtml}
            </div>
            <div class="highlight-card">
                ${sourceHtml}
                <div class="highlight-body">
                    <div class="highlight-bar" style="background:${item.color}"></div>
                    <div class="highlight-content">
                        ${contentHtml}
                        ${(item.note && item.type !== 'image') ? `<div style="margin-top:8px;color:#666;font-size:12px;background:#f9f9f9;padding:5px;"> ${window.escapeHtml(item.note)}</div>` : ''}
						<div style="text-align:right;font-size:11px;color:#bbb;margin-top:6px;">${window.safeFormatDate ? window.safeFormatDate(item.timestamp) : new Date(item.timestamp).toLocaleString()}</div>
                    </div>
                </div>
                <button class="item-delete-btn" title="Delete">${iconRowDel}</button>
            </div>
        `;

        // Checkbox Event
        const chk = row.querySelector('.select-checkbox');
        const highlightSourceUrl = `highlight://${item.id || item.timestamp}`;
        if (window.chatSources && window.chatSources.some(s => s.url === highlightSourceUrl)) {
            chk.checked = true;
        }

        chk.addEventListener('change', (e) => {
            e.stopPropagation();
            if (e.target.checked) {
                const typeLabel = item.type === 'image' ? 'Image' : 'Highlight';
                const sourceObj = {
                    url: highlightSourceUrl,
                    title: `[User Selected ${typeLabel}] from ${item.sourceTitle || 'Page'}`,
                    items: [item]
                };
                if (window.chatSources && !window.chatSources.find(s => s.url === sourceObj.url)) {
                    window.chatSources.push(sourceObj);
                    if (typeof window.renderChatSources === 'function') window.renderChatSources();
                    window.showToast("Highlight added to AI Chat");
                }
            } else {
                if (typeof window.removeChatSource === 'function') {
                    window.removeChatSource(highlightSourceUrl);
                }
            }
        });

        // Meta Popover
        row.querySelectorAll('.meta-icon-wrapper').forEach(wrapper => {
            const popover = wrapper.querySelector('.meta-popover');
            wrapper.onclick = (e) => { e.stopPropagation(); popover.style.display = 'block'; };
            wrapper.onmouseleave = () => { popover.style.display = 'none'; };
        });

        // Row Click
        row.querySelector('.highlight-card').onclick = async (e) => {
            if (e.target.closest('.item-delete-btn') || e.target.closest('.ocr-del-btn') || e.target.closest('.ocr-edit-btn')) return;
            if (e.target.classList.contains('search-source-text')) { e.stopPropagation(); window.selectPage(item.sourceUrl); return; }

            let targetUrl = item.sourceUrl || window.selectedUrl;
            try {
                const urlObj = new URL(targetUrl);
                const cleanUrl = urlObj.origin + urlObj.pathname + urlObj.search;
                const tabs = await chrome.tabs.query({});
                const foundTab = tabs.find(t => t.url && t.url.split('#')[0] === cleanUrl);

                if (foundTab) {
                    await chrome.tabs.update(foundTab.id, { active: true });
                    await chrome.windows.update(foundTab.windowId, { focused: true });
                    chrome.tabs.sendMessage(foundTab.id, { action: 'SCROLL_TO_HIGHLIGHT', id: item.id });
                } else {
                    const finalUrl = targetUrl + `#dh-highlight-${item.id}`;
                    chrome.tabs.create({ url: finalUrl });
                }
            } catch (err) {
                const finalUrl = targetUrl + `#dh-highlight-${item.id}`;
                chrome.tabs.create({ url: finalUrl });
            }
        };

        // Delete Row
        const rowDelBtn = row.querySelector('.item-delete-btn');
        if (rowDelBtn) {
            rowDelBtn.onclick = async (e) => {
                e.stopPropagation();
                row.style.transition = "all 0.3s ease";
                row.style.opacity = "0";
                row.style.transform = "translateX(20px)";
                setTimeout(() => {
                    row.remove();
                    const listEl = document.getElementById('highlight-list');
                    if (listEl && listEl.children.length === 0) listEl.innerHTML = `<div style="text-align:center; color:#ccc; padding:20px;">${chrome.i18n.getMessage('ui_noContent')}</div>`;
                }, 300);
                await window.deleteHighlight(item);
            };
        }

        // OCR Actions
        const delOcrBtn = row.querySelector('.ocr-del-btn');
        if (delOcrBtn) {
            delOcrBtn.onclick = async (e) => {
                e.stopPropagation();
                const wrapper = row.querySelector('.ocr-edit-wrapper');
                if (wrapper) wrapper.remove();
                const targetKey = item.storageKey || item.url;
                const data = await chrome.storage.local.get(targetKey);
                if (data[targetKey]) {
                    const list = data[targetKey];
                    const idx = list.findIndex(i => i.id === item.id);
                    if (idx > -1) {
                        if (item.note) { list[idx].note = ''; item.note = ''; }
                        else { list[idx].text = ''; item.text = ''; }
                        await chrome.storage.local.set({ [targetKey]: list });
                    }
                }
            };
        }

        const editBtn = row.querySelector('.ocr-edit-btn');
        if (editBtn) {
            const contentDiv = row.querySelector('.ocr-content-div');
            contentDiv.onclick = (e) => { if (contentDiv.isContentEditable) e.stopPropagation(); };
            editBtn.onclick = async (e) => {
                e.stopPropagation();
                const div = row.querySelector('.ocr-content-div');
                const isEditing = div.isContentEditable;
                const iconEdit = `<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:currentColor;vertical-align:middle;"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`;
                const iconSave = `<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:currentColor;vertical-align:middle;"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>`;

                if (isEditing) {
                    const newText = div.innerText;
                    div.contentEditable = 'false';
                    div.style.background = 'transparent';
                    div.style.border = 'none';
                    div.style.padding = '0';
                    editBtn.innerHTML = iconEdit;
                    editBtn.style.color = '#666';

                    const targetKey = item.storageKey || item.url;
                    const data = await chrome.storage.local.get(targetKey);
                    if (data[targetKey]) {
                        const list = data[targetKey];
                        const idx = list.findIndex(i => i.id === item.id);
                        if (idx > -1) {
                            if (item.note) { list[idx].note = newText; item.note = newText; }
                            else { list[idx].text = newText; item.text = newText; }
                            await chrome.storage.local.set({ [targetKey]: list });
                        }
                    }
                } else {
                    div.contentEditable = 'true';
                    div.focus();
                    div.style.background = '#fff';
                    div.style.border = '1px dashed #999';
                    div.style.padding = '4px';
                    editBtn.innerHTML = iconSave;
                    editBtn.style.color = '#1976d2';
                }
            };
        }
        listEl.appendChild(row);
    });
};

window.renderSnapshot = async function (url) {
    const listEl = document.getElementById('highlight-list');
    if (!listEl) return;

    const existing = document.querySelector('.snapshot-container');
    if (existing) existing.remove();

    const key = 'snapshot_' + url;
    const res = await chrome.storage.local.get(key);
    const snapshot = res[key];

    if (!snapshot) return;

    const container = document.createElement('div');
    container.className = 'snapshot-container';
    const btnText = chrome.i18n.getMessage('btn_viewSnapshot') || '📷 View Page Snapshot';

    container.innerHTML = `
        <div class="snapshot-toggle-btn" id="btn-toggle-snapshot">
            ${btnText}
            <svg viewBox="0 0 24 24" width="16" height="16" style="transition:transform 0.3s;"><path d="M7 10l5 5 5-5z"/></svg>
        </div>
        <div class="snapshot-content" id="snapshot-content">
            <h1>${window.escapeHtml(snapshot.title)}</h1>
            <div style="font-size:12px; color:#999; margin-bottom:20px;">
            Captured: ${window.safeFormatDate ? window.safeFormatDate(snapshot.timestamp) : new Date(snapshot.timestamp).toLocaleString()}
            </div>
            ${snapshot.content} 
        </div>
    `;

    listEl.appendChild(container);

    const btn = container.querySelector('#btn-toggle-snapshot');
    const content = container.querySelector('#snapshot-content');
    const icon = btn.querySelector('svg');

    btn.onclick = () => {
        const isOpen = content.classList.contains('open');
        if (isOpen) {
            content.classList.remove('open');
            icon.style.transform = 'rotate(0deg)';
        } else {
            content.classList.add('open');
            icon.style.transform = 'rotate(180deg)';
        }
    };
};

// ==========================================
// 2. 通用 UI 组件与工具
// ==========================================

window.showToast = function (text) {
    let toast = document.getElementById('dh-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'dh-toast';
        toast.style.cssText = "position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:#fff; padding:8px 16px; border-radius:4px; font-size:13px; z-index:10000; transition:opacity 0.3s;";
        document.body.appendChild(toast);
    }
    toast.innerText = text;
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 2000);
};

window.escapeHtml = function (text) {
    if (!text) return "";
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
};

window.formatTime = function (s) {
    if (!s || s < 0) return '00:00';
    const m = Math.floor(s / 60);
    const rs = Math.floor(s % 60);
    return `${m.toString().padStart(2, '0')}:${rs.toString().padStart(2, '0')}`;
};

window.showEmptyState = function () {
    const emptyState = document.getElementById('empty-state');
    const contentView = document.getElementById('content-view');
    if (emptyState) emptyState.style.display = 'flex';
    if (contentView) contentView.style.display = 'none';
};

window.refreshOptions = function () {
    location.reload();
};

window.updateSidebarUI = function (status) {
    const header = document.querySelector('.sidebar-header');
    if (!header) return;

    let statusWrapper = document.getElementById('dh-status-wrapper');
    if (!statusWrapper) {
        statusWrapper = document.createElement('div');
        statusWrapper.id = 'dh-status-wrapper';
        statusWrapper.style.cssText = 'display:flex; align-items:center; gap:8px; margin-bottom:2px;';
        header.prepend(statusWrapper);
        const oldTitle = header.children[1];
        if (oldTitle && !oldTitle.id && !oldTitle.classList.contains('sidebar-actions')) {
            oldTitle.style.display = 'none';
        }
    }

    statusWrapper.innerHTML = '';
    const title = document.createElement('div');
    title.style.cssText = "font-size:18px; font-weight:700; color:#333; margin:0; line-height:1.2;";
    title.innerText = window.getI18nMsg('appName');
    statusWrapper.appendChild(title);

    const statusBadge = document.createElement('div');
    statusBadge.style.cssText = "font-size:11px; cursor:pointer; padding:2px 6px; border-radius:4px; display:inline-block; font-weight:500; transition:all 0.2s;";

    if (status.type === 'license') {
        statusBadge.innerText = window.getI18nMsg('optProActive');
        statusBadge.style.background = "#e8f5e9";
        statusBadge.style.color = "#2e7d32";
        statusBadge.style.cursor = "default";
    } else if (status.type === 'trial') {
        const trialText = window.getI18nMsg('optTrialLeft', [String(status.daysLeft)]);
        const buyText = window.getI18nMsg('opt_activate') || "Buy";
        statusBadge.innerHTML = `${trialText} <span style="text-decoration:underline;margin-left:4px;">${buyText}</span>`;
        statusBadge.style.background = "transparent";
        statusBadge.style.color = "#ef6c00";
        statusBadge.onclick = () => { const m = document.getElementById('license-modal'); if (m) m.style.display = 'flex'; };
    } else {
        const freeText = window.getI18nMsg('optFreeVer');
        const unlockText = window.getI18nMsg('opt_unlock');
        statusBadge.innerHTML = `${freeText} <span style='text-decoration:underline;margin-left:4px;'>${unlockText}</span>`;
        statusBadge.style.background = "#ffebee";
        statusBadge.style.color = "#c62828";
        statusBadge.onclick = () => { const m = document.getElementById('license-modal'); if (m) m.style.display = 'flex'; };
    }
    statusWrapper.appendChild(statusBadge);

    const btnActivate = document.getElementById('btn-activate-pro');
    if (btnActivate) btnActivate.style.display = 'none';
};

// ==========================================
// 3. 颜色与过滤 UI
// ==========================================

window.renderColorSettings = async function () {
    if (!window.IS_PRO) {
        const list = document.getElementById('color-settings-list');
        if (list) list.innerHTML = ''; return;
    }
    const list = document.getElementById('color-settings-list');
    if (!list) return;
    const res = await chrome.storage.local.get('color_meanings');
    const colorMeanings = res.color_meanings || {};
    list.innerHTML = '';

    window.COLORS.slice(0, 10).forEach((c, i) => {
        const defaultName = chrome.i18n.getMessage('color_defaultName', [i + 1]);
        const savedName = colorMeanings[c] || '';
        const row = document.createElement('div');
        row.style.cssText = "display:flex; align-items:center; gap:10px; padding:5px; border-bottom:1px solid #eee;";
        const dot = document.createElement('div');
        dot.style.cssText = `width:20px; height:20px; border-radius:50%; background:${c}; border:1px solid #ddd; flex-shrink:0;`;
        const input = document.createElement('input');
        input.type = "text"; input.className = "edit-input";
        input.style.cssText = "flex:1; padding:4px 8px; font-size:12px;";
        input.placeholder = defaultName; input.value = savedName;
        input.onblur = () => {
            const newVal = input.value.trim();
            chrome.storage.local.get('color_meanings', (r) => {
                const current = r.color_meanings || {};
                if (newVal) current[c] = newVal; else delete current[c];
                chrome.storage.local.set({ 'color_meanings': current });
            });
        };
        row.appendChild(dot); row.appendChild(input); list.appendChild(row);
    });
};

window.renderFilterMenu = function (container) {
    container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'filter-capsule-wrapper';

    window.COLORS.slice(0, 5).forEach(c => {
        const div = document.createElement('div');
        div.className = 'dh-color-circle';
        div.style.background = c;
        if (window.activeColorFilter === c) { div.style.border = '2px solid #555'; div.style.transform = 'scale(1.1)'; }
        div.onclick = (e) => { e.stopPropagation(); window.toggleFilter(c); container.style.display = 'none'; };
        wrapper.appendChild(div);
    });

    const plusBtn = document.createElement('div');
    plusBtn.className = 'dh-plus-btn';
    plusBtn.innerText = '+';
    plusBtn.onclick = (e) => { e.stopPropagation(); window.filterMenuState = (window.filterMenuState >= 2) ? 0 : window.filterMenuState + 1; window.renderFilterMenu(container); };
    wrapper.appendChild(plusBtn);
    container.appendChild(wrapper);

    if (window.filterMenuState > 0) {
        const grid = document.createElement('div');
        grid.className = 'filter-grid-area';
        grid.style.display = 'grid'; grid.style.gridTemplateColumns = 'repeat(5, 1fr)';
        grid.style.gap = '8px'; grid.style.marginTop = '10px'; grid.style.paddingTop = '10px'; grid.style.borderTop = '1px solid #eee';

        const count = window.filterMenuState * 15;
        window.COLORS.slice(5, 5 + count).forEach(c => {
            const div = document.createElement('div');
            div.className = 'dh-color-circle';
            div.style.background = c;
            div.style.margin = '0 auto';
            if (window.activeColorFilter === c) div.style.border = '2px solid #333';
            div.onclick = (e) => { e.stopPropagation(); window.toggleFilter(c); container.style.display = 'none'; };
            grid.appendChild(div);
        });
        container.appendChild(grid);
    }
};

window.toggleFilter = function (color) {
    if (window.activeColorFilter === color) window.activeColorFilter = null;
    else window.activeColorFilter = color;
    window.updateFilterIcon();
    if (window.isSearchMode) {
        if (typeof window.performSearch === 'function') window.performSearch();
    } else if (window.selectedUrl) {
        const page = window.groupedData.find(p => p.url === window.selectedUrl);
        if (page) window.renderHighlightList(page.items);
    }
};

window.updateFilterIcon = function () {
    const btn = document.getElementById('btn-filter');
    if (!btn) return;
    if (window.activeColorFilter) {
        btn.classList.add('active');
        btn.style.color = window.activeColorFilter;
    } else {
        btn.classList.remove('active');
        btn.style.color = '';
    }
};

// ==========================================
// 4. 其他 UI 逻辑
// ==========================================

window.setupInspiration = async function (url) {
    const container = document.getElementById('inspiration-wrapper');
    const listEl = document.getElementById('inspiration-list');
    if (!container || !listEl) return;

    const inspKey = 'inspiration_' + url;
    container.style.display = 'block';
    const res = await chrome.storage.local.get(inspKey);
    const content = res[inspKey] || '';

    const ph = "Inspiration...";
    listEl.innerHTML = `
        <div class="inspiration-box">
            <textarea id="insp-textarea" class="inspiration-textarea" rows="1" placeholder="${ph}">${window.escapeHtml(content)}</textarea>
        </div>
        <div id="insp-status"></div>
    `;
    const textarea = document.getElementById('insp-textarea');
    const autoResize = () => { textarea.style.height = 'auto'; textarea.style.height = textarea.scrollHeight + 'px'; };
    autoResize();

    textarea.oninput = (e) => {
        autoResize();
        const val = e.target.value;
        const status = document.getElementById('insp-status');
        status.innerText = window.getI18nMsg('ui_saving');
        status.style.opacity = '1';
        clearTimeout(window.inspTimer);
        window.inspTimer = setTimeout(() => {
            chrome.storage.local.set({ [inspKey]: val });
            status.innerText = window.getI18nMsg('ui_saved');
            setTimeout(() => { status.style.opacity = '0'; }, 2000);
        }, 800);
    };
};

window.performSearch = function () {
    const query = document.getElementById('search-input').value.trim().toLowerCase();
    if (!query) return;
    window.isSearchMode = true;
    let allMatches = [];
    window.groupedData.forEach(page => {
        const matches = page.items.filter(i =>
            (i.text && i.text.toLowerCase().includes(query)) ||
            (i.note && i.note.toLowerCase().includes(query)) ||
            (i.tag && i.tag.toLowerCase().includes(query)) ||
            (i.role && i.role.toLowerCase().includes(query))
        );
        matches.forEach(item => { allMatches.push({ ...item, sourceTitle: page.title, sourceUrl: page.url }); });
    });
    const titleEl = document.getElementById('current-page-title');
    if (titleEl) titleEl.innerText = `${window.getI18nMsg('ui_search')}: "${query}"`;
    const dateEl = document.getElementById('current-page-date');
    if (dateEl) dateEl.innerText = '';
    const countEl = document.getElementById('current-page-count');
    if (countEl) countEl.innerText = `${allMatches.length} results`;
    const inspWrap = document.getElementById('inspiration-wrapper');
    if (inspWrap) inspWrap.style.display = 'none';
    window.renderHighlightList(allMatches);
};

window.openWebpagePreview = function (title, items) {
    let htmlBody = '';
    let lastTitle = null;

    const uniqueSources = new Set(items.map(i => i.sourceUrl)).size;

    items.forEach(item => {
        if (item.sourceTitle && item.sourceTitle !== lastTitle) {
            const showHeader = !(uniqueSources === 1 && title === item.sourceTitle);
            htmlBody += `<div class="doc-section">`;
            if (showHeader) {
                htmlBody += `
                <div class="doc-source-header">
                    <span class="doc-icon">📑</span>
                    <h2 class="doc-title-text">${window.escapeHtml(item.sourceTitle)}</h2>
                </div>`;
            }
            htmlBody += `
                    <a href="${item.sourceUrl}" target="_blank" class="doc-link">${item.sourceUrl}</a>
                </div>`;
            lastTitle = item.sourceTitle;
        }

        const barColor = item.color || '#f1c40f';
        let contentHtml = '';
        if (item.type === 'image') {
            contentHtml = `
                <div class="media-container">
                    <img src="${item.src}" alt="Image">
                    ${item.note || item.text ? `<div class="media-caption">OCR/Note: ${window.escapeHtml(item.note || item.text)}</div>` : ''}
                </div>`;
        } else if (item.type === 'video') {
            contentHtml = `
                <div class="media-container video-card">
                    <img src="${item.src}" class="video-thumb">
                    <div class="video-meta">
                        <span class="video-icon">▶</span> 
                        <span class="video-time">Timestamp: ${window.formatTime(item.videoTime)}</span>
                    </div>
                </div>`;
        } else {
            contentHtml = `
                <div class="highlight-block" style="border-left-color: ${barColor};">
                    <div class="highlight-text">${window.escapeHtml(item.text)}</div>
                </div>`;
        }

        if (item.note && item.type !== 'image') {
            contentHtml += `
                <div class="note-block">
                    <span class="note-icon">📝</span>
                    <span class="note-content">${window.escapeHtml(item.note)}</span>
                </div>`;
        }
        htmlBody += `<div class="item-wrapper">${contentHtml}</div>`;
    });

    const fullHtml = `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>${title} - Preview</title>
        <style>
            :root {
                --bg-color: #f7f9fb;
                --paper-bg: #ffffff;
                --text-primary: #2c3e50;
                --text-secondary: #7f8c8d;
                --border-color: #ecf0f1;
                --accent-color: #1976d2;
            }
            body { margin: 0; padding: 60px 20px; background-color: var(--bg-color); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: var(--text-primary); line-height: 1.7; }
            .paper-container { max-width: 800px; margin: 0 auto; background: var(--paper-bg); padding: 60px 80px; box-shadow: 0 12px 24px rgba(0,0,0,0.05); border-radius: 16px; min-height: 80vh; }
            .page-main-title { font-size: 32px; font-weight: 800; margin-bottom: 50px; text-align: center; letter-spacing: -0.5px; color: #1a1a1a; border-bottom: 2px solid #f0f0f0; padding-bottom: 20px; }
            .doc-section { margin-top: 50px; margin-bottom: 25px; }
            .doc-source-header { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
            .doc-icon { font-size: 20px; }
            .doc-title-text { margin: 0; font-size: 20px; font-weight: 600; color: #34495e; }
            .doc-link { display: block; font-size: 12px; color: #95a5a5; text-decoration: none; margin-left: 34px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .doc-link:hover { color: var(--accent-color); text-decoration: underline; }
            .item-wrapper { margin-bottom: 20px; }
            .highlight-block { position: relative; padding: 12px 18px; background: #fafafa; border-left: 4px solid #ccc; border-radius: 0 8px 8px 0; transition: transform 0.2s; }
            .highlight-block:hover { background: #f0f4f8; }
            .highlight-text { font-size: 16px; color: #2c3e50; font-weight: 400; }
            .media-container { border: 1px solid #eee; border-radius: 8px; padding: 10px; background: #fff; display: block; margin: 25px auto; max-width: fit-content; box-shadow: 0 2px 8px rgba(0,0,0,0.03); }
            .media-container img { max-width: 100%; max-height: 500px; height: auto; border-radius: 4px; display: block; margin: 0 auto; }
            .media-caption { margin-top: 8px; font-size: 12px; color: #666; background: #fff8e1; padding: 6px 10px; border-radius: 4px; }
            .video-card { display: flex; flex-direction: column; align-items: center; min-width: 200px; }
            .video-meta { margin-top: 8px; font-size: 13px; color: #555; display: flex; align-items: center; gap: 5px; }
            .note-block { margin-top: 8px; margin-left: 20px; padding: 8px 12px; background-color: #fff9c4; border-radius: 6px; font-size: 14px; color: #5d4037; display: flex; gap: 8px; align-items: flex-start; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
            .note-icon { font-size: 14px; margin-top: 2px; }
            @media (max-width: 768px) { .paper-container { padding: 30px 20px; width: 95%; } .page-main-title { font-size: 24px; } }
        </style>
    </head>
    <body>
        <div class="paper-container">
            <h1 class="page-main-title">${window.escapeHtml(title)}</h1>
            <div class="content-body">${htmlBody || '<p style="text-align:center;color:#999">No Content</p>'}</div>
        </div>
    </body>
    </html>`;

    const blob = new Blob([fullHtml], { type: 'text/html' });
    window.open(URL.createObjectURL(blob), '_blank');
};

window.deleteHighlight = async function (item) {
    const targetKey = item.storageKey || item.url;
    const res = await chrome.storage.local.get(targetKey);
    let list = res[targetKey] || [];
    list = list.filter(i => i.id !== item.id);
    if (list.length === 0) await chrome.storage.local.remove(targetKey);
    else await chrome.storage.local.set({ [targetKey]: list });
};

console.log('[options-ui.js] Loaded: General UI rendering functions');
