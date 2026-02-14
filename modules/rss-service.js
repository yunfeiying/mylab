/**
 * rss-service.js - RSS 获取、解析与管理引擎
 * 核心功能：链路穿透抓取、归类管理 (百度焦点、百度最新、新浪、财新等)、划线标亮、OPML 导入。
 */

// 默认频道列表：百度焦点、最新并存，且排在最前
const DEFAULT_RSS_FEEDS = [
    // --- 百度焦点新闻 (聚合) ---
    { id: 'baidu-focus-all', name: '百度焦点 (聚合)', url: 'aggregated://baidu-focus', category: '百度新闻' },

    // --- 百度最新新闻 (聚合) ---
    { id: 'baidu-latest-all', name: '百度最新 (聚合)', url: 'aggregated://baidu-latest', category: '百度新闻' },

    // --- 深度 / 财经专业源 ---
];

// Definition of Aggregated Sources
const AGGREGATED_SOURCES = {
    'baidu-focus': [
        'http://news.baidu.com/n?cmd=1&class=civilnews&tn=rss',
        'http://news.baidu.com/n?cmd=1&class=internews&tn=rss',
        'http://news.baidu.com/n?cmd=1&class=mil&tn=rss',
        'http://news.baidu.com/n?cmd=1&class=finannews&tn=rss',
        'http://news.baidu.com/n?cmd=1&class=internet&tn=rss',
        'http://news.baidu.com/n?cmd=1&class=housenews&tn=rss',
        'http://news.baidu.com/n?cmd=1&class=autonews&tn=rss',
        'http://news.baidu.com/n?cmd=1&class=sportnews&tn=rss',
        'http://news.baidu.com/n?cmd=1&class=enternews&tn=rss',
        'http://news.baidu.com/n?cmd=1&class=gamenews&tn=rss',
        'http://news.baidu.com/n?cmd=1&class=edunews&tn=rss',
        'http://news.baidu.com/n?cmd=1&class=healthnews&tn=rss',
        'http://news.baidu.com/n?cmd=1&class=technnews&tn=rss',
        'http://news.baidu.com/n?cmd=1&class=socianews&tn=rss'
    ],
    'baidu-latest': [
        'http://news.baidu.com/n?cmd=4&class=civilnews&tn=rss',
        'http://news.baidu.com/n?cmd=4&class=internews&tn=rss',
        'http://news.baidu.com/n?cmd=4&class=mil&tn=rss',
        'http://news.baidu.com/n?cmd=4&class=finannews&tn=rss',
        'http://news.baidu.com/n?cmd=4&class=internet&tn=rss',
        'http://news.baidu.com/n?cmd=4&class=housenews&tn=rss',
        'http://news.baidu.com/n?cmd=4&class=autonews&tn=rss',
        'http://news.baidu.com/n?cmd=4&class=sportnews&tn=rss',
        'http://news.baidu.com/n?cmd=4&class=enternews&tn=rss',
        'http://news.baidu.com/n?cmd=4&class=gamenews&tn=rss',
        'http://news.baidu.com/n?cmd=4&class=edunews&tn=rss',
        'http://news.baidu.com/n?cmd=4&class=healthnews&tn=rss',
        'http://news.baidu.com/n?cmd=4&class=technnews&tn=rss',
        'http://news.baidu.com/n?cmd=4&class=socianews&tn=rss'
    ]
};

window.RSS_FEEDS = [];
let currentRSSItem = null;
window.currentRSSFeed = null;
window.unreadOnlyRSS = false;
window.RSS_EXPANDED_CATS = new Set(['百度焦点', '百度最新', '财经专业']); // Default expanded folders


window.initRSSService = async function () {
    const data = await window.appStorage.get(['custom_rss_feeds', 'unread_only_rss']);
    const customFeeds = data.custom_rss_feeds || [];
    window.RSS_FEEDS = [...DEFAULT_RSS_FEEDS, ...customFeeds];
    window.unreadOnlyRSS = !!data.unread_only_rss;

    window.renderRSSFeeds();
    bindRSSUI();
    initRSSHighlighter();
    updateRSSUnreadToggleUI();
};

function bindRSSUI() {
    const btnAdd = document.getElementById('btn-add-rss');
    const backdrop = document.getElementById('rss-dialog-backdrop');
    const btnCancel = document.getElementById('btn-rss-cancel');
    const btnSave = document.getElementById('btn-rss-save');
    const btnImportOPML = document.getElementById('btn-rss-import-opml');
    const opmlInput = document.getElementById('rss-opml-import');

    // Unread Toggle
    const btnUnread = document.getElementById('btn-toggle-unread-rss');
    if (btnUnread) {
        btnUnread.onclick = (e) => {
            e.stopPropagation();
            window.unreadOnlyRSS = !window.unreadOnlyRSS;
            window.appStorage.set({ unread_only_rss: window.unreadOnlyRSS });
            updateRSSUnreadToggleUI();
            if (window.currentRSSFeed) window.selectRSSFeed(window.currentRSSFeed);
        };
    }

    // Refresh Button
    const btnRefresh = document.getElementById('btn-refresh-rss');
    if (btnRefresh) {
        btnRefresh.onclick = (e) => {
            e.stopPropagation();
            if (window.currentRSSFeed) {
                // Visual feedback
                const svg = btnRefresh.querySelector('svg');
                if (svg) {
                    svg.style.transition = 'transform 0.5s ease';
                    svg.style.transform = 'rotate(360deg)';
                    setTimeout(() => {
                        svg.style.transition = 'none';
                        svg.style.transform = 'none';
                    }, 500);
                }
                window.selectRSSFeed(window.currentRSSFeed);
            }
        };
    }

    if (btnAdd) { btnAdd.onclick = () => { backdrop.style.display = 'flex'; document.getElementById('rss-name-input').value = ''; document.getElementById('rss-url-input').value = ''; document.getElementById('rss-category-input').value = ''; }; }
    if (btnCancel) btnCancel.onclick = () => backdrop.style.display = 'none';
    if (btnSave) {
        btnSave.onclick = async () => {
            const name = document.getElementById('rss-name-input').value.trim();
            const url = document.getElementById('rss-url-input').value.trim();
            const category = document.getElementById('rss-category-input').value.trim() || 'Uncategorized';
            if (!name || !url) return alert('请填写完整信息');
            await addCustomFeed(name, url, category);
            backdrop.style.display = 'none';
        };
    }
    if (btnImportOPML && opmlInput) {
        btnImportOPML.onclick = () => opmlInput.click();
        opmlInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (event) => { await importOPML(event.target.result); opmlInput.value = ''; backdrop.style.display = 'none'; };
            reader.readAsText(file);
        };
    }
}

function updateRSSUnreadToggleUI() {
    const btn = document.getElementById('btn-toggle-unread-rss');
    if (!btn) return;
    const circle = btn.querySelector('circle');
    if (window.unreadOnlyRSS) {
        btn.classList.add('active');
        circle.setAttribute('fill', 'currentColor');
    } else {
        btn.classList.remove('active');
        circle.setAttribute('fill', 'none');
    }
}

async function importOPML(xmlText) {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const processNode = (node, categoryName = 'Imported') => {
            const children = node.querySelectorAll(":scope > outline");
            const feeds = [];
            children.forEach(child => {
                const xmlUrl = child.getAttribute('xmlUrl');
                const text = child.getAttribute('text') || child.getAttribute('title');
                if (xmlUrl) { feeds.push({ id: 'custom-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5), name: text, url: xmlUrl, category: categoryName }); }
                else if (text) { feeds.push(...processNode(child, text)); }
            });
            return feeds;
        };
        const importedFeeds = processNode(xmlDoc.querySelector("body"));
        if (importedFeeds.length === 0) return alert('未找到有效的订阅源');
        const data = await window.appStorage.get('custom_rss_feeds');
        const customFeeds = data.custom_rss_feeds || [];
        importedFeeds.forEach(f => { if (!customFeeds.find(existing => existing.url === f.url)) { customFeeds.push(f); } });
        await window.appStorage.set({ custom_rss_feeds: customFeeds });
        const finalData = await window.appStorage.get('custom_rss_feeds');
        window.RSS_FEEDS = [...DEFAULT_RSS_FEEDS, ...(finalData.custom_rss_feeds || [])];
        window.renderRSSFeeds();
    } catch (e) { console.error(e); }
}

window.addCustomFeed = async function (name, url, category) {
    const newFeed = { id: 'custom-' + Date.now(), name, url, category, timestamp: Date.now() };
    const data = await window.appStorage.get('custom_rss_feeds');
    const feeds = data.custom_rss_feeds || [];
    if (feeds.find(f => f.url === url)) return alert('该频道已存在');

    feeds.push(newFeed);
    await window.appStorage.set({ custom_rss_feeds: feeds });

    // Always expand the category that was just added to
    if (window.RSS_EXPANDED_CATS) {
        window.RSS_EXPANDED_CATS.add(category);
    }

    // Refresh global list from storage to ensure everything is in sync
    const updatedData = await window.appStorage.get('custom_rss_feeds');
    window.RSS_FEEDS = [...DEFAULT_RSS_FEEDS, ...(updatedData.custom_rss_feeds || [])];

    window.renderRSSFeeds();

    // Optional: Feedback toast instead of alert for better UX
    if (window.showToast) window.showToast(`已成功添加订阅源: ${name}`);
    console.log('[RSS] Added feed:', name, 'in category:', category);
}

window.removeRSSFeed = async function (feedId) {
    if (!feedId.startsWith('custom-')) {
        alert('系统默认订阅源不可删除');
        return;
    }
    const data = await window.appStorage.get(['custom_rss_feeds', 'trash_bin']);
    let feeds = data.custom_rss_feeds || [];
    const feedToRemove = feeds.find(f => f.id === feedId);
    feeds = feeds.filter(f => f.id !== feedId);

    // Add to trash_bin to prevent sync "zombie" issue
    let trash = data.trash_bin || [];
    trash.push({
        originalKey: feedId,
        type: 'rss_feed',
        deletedAt: Date.now(),
        data: feedToRemove
    });

    await window.appStorage.set({
        custom_rss_feeds: feeds,
        trash_bin: trash
    });

    // Refresh global list
    const updatedData = await window.appStorage.get('custom_rss_feeds');
    window.RSS_FEEDS = [...DEFAULT_RSS_FEEDS, ...(updatedData.custom_rss_feeds || [])];
    window.renderRSSFeeds();
};

window.removeRSSCategory = async function (categoryName) {
    const systemCats = ['百度焦点', '百度最新', '财经专业'];
    if (systemCats.includes(categoryName)) {
        alert('系统分类不可删除');
        return;
    }
    const data = await window.appStorage.get(['custom_rss_feeds', 'trash_bin']);
    let feeds = data.custom_rss_feeds || [];
    let trash = data.trash_bin || [];
    const toRemove = feeds.filter(f => f.category === categoryName);
    const remaining = feeds.filter(f => f.category !== categoryName);
    toRemove.forEach(f => {
        trash.push({ originalKey: f.id, type: 'rss_feed', deletedAt: Date.now(), data: f });
    });
    await window.appStorage.set({ custom_rss_feeds: remaining, trash_bin: trash });
    const updatedData = await window.appStorage.get('custom_rss_feeds');
    window.RSS_FEEDS = [...DEFAULT_RSS_FEEDS, ...(updatedData.custom_rss_feeds || [])];
    window.renderRSSFeeds();
};

window.renderRSSFeeds = function () {
    const listContainerFull = document.getElementById('rss-feed-list-full');
    const listContainerHome = document.getElementById('rss-feed-list');

    // 1. Render Full View (RSS Tab)
    if (listContainerFull) {
        if (window.mobileCore) {
            // User Request: Show Article List directly, not Feed List
            window.renderFullRSSHeadlines(listContainerFull);
        } else {
            renderAccordionStyle(listContainerFull);
        }
    }

    // 2. Render Sidebar/Home View
    if (listContainerHome) {
        // Use headlines ONLY for Mobile Home page. PC sidebar uses simple folder structure.
        if (window.mobileCore) {
            window.renderHomeRSSHeadlines();
        } else {
            renderSimpleFolderList(listContainerHome);
        }
    }
};

function renderAccordionStyle(container) {
    container.innerHTML = '';
    const groups = groupFeeds();
    Object.keys(groups).sort().forEach(cat => {
        const accItem = document.createElement('div');
        accItem.className = 'rss-accordion-item';

        const isExpanded = window.RSS_EXPANDED_CATS.has(cat);
        const header = document.createElement('div');
        header.className = `rss-accordion-header ${isExpanded ? 'expanded' : ''}`;
        header.innerHTML = `
            <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg>
            <span class="folder-name">${cat}</span>
            <span class="count">${groups[cat].length}</span>
        `;

        const content = document.createElement('div');
        content.className = `rss-accordion-content ${isExpanded ? '' : 'hidden'}`;

        header.onclick = () => {
            const expanded = header.classList.toggle('expanded');
            content.classList.toggle('hidden', !expanded);
            if (expanded) window.RSS_EXPANDED_CATS.add(cat);
            else window.RSS_EXPANDED_CATS.delete(cat);
        };

        groups[cat].forEach(feed => {
            const source = document.createElement('div');
            source.className = 'rss-sub-source';
            let iconUrl = getFeedIcon(feed.url);

            source.innerHTML = `
                <img src="${iconUrl}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%23ccc%22><circle cx=%2212%22 cy=%2212%22 r=%2210%22/></svg>'">
                <span>${feed.name}</span>
            `;
            source.onclick = (e) => {
                e.stopPropagation();
                if (window.mobileCore) window.mobileCore.navigateTo('rss-feed');
                window.selectRSSFeed(feed);
            };
            content.appendChild(source);
        });

        accItem.appendChild(header);
        accItem.appendChild(content);
        container.appendChild(accItem);
    });
}

function renderSimpleFolderList(container) {
    container.innerHTML = '';
    const groups = groupFeeds();
    const sortedCategories = Object.keys(groups).sort();

    sortedCategories.forEach(cat => {
        const folder = document.createElement('div');
        folder.className = 'rss-folder';
        const isExpanded = window.RSS_EXPANDED_CATS.has(cat);

        const header = document.createElement('div');
        header.className = `rss-folder-header ${isExpanded ? '' : 'collapsed'}`;
        header.innerHTML = `<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6"/></svg><span class="label">${cat}</span>`;

        const itemsContainer = document.createElement('div');
        itemsContainer.className = `rss-folder-items ${isExpanded ? '' : 'hidden'}`;

        header.onclick = () => {
            const isCollapsed = header.classList.toggle('collapsed');
            itemsContainer.classList.toggle('hidden', isCollapsed);
            if (isCollapsed) window.RSS_EXPANDED_CATS.delete(cat);
            else window.RSS_EXPANDED_CATS.add(cat);
        };

        groups[cat].forEach(feed => {
            const item = document.createElement('div');
            item.className = 'nav-item';
            let iconUrl = getFeedIcon(feed.url);

            item.innerHTML = `<img src="${iconUrl}" class="nav-icon-rss" style="width:14px; height:14px; margin-right:8px; border-radius:2px; object-fit:contain;"><span class="label">${feed.name}</span>`;
            item.onclick = (e) => {
                e.stopPropagation();
                window.selectRSSFeed(feed);
            };
            itemsContainer.appendChild(item);
        });

        folder.appendChild(header);
        folder.appendChild(itemsContainer);
        container.appendChild(folder);
    });
}

function groupFeeds() {
    const groups = {};
    window.RSS_FEEDS.forEach(f => {
        const cat = f.category || 'Uncategorized';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(f);
    });
    return groups;
}

function getFeedIcon(url) {
    let hostname = "news.baidu.com";
    try { hostname = new URL(url).hostname; } catch (e) { }
    let iconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
    if (hostname.includes('baidu.com')) iconUrl = "https://www.baidu.com/favicon.ico";
    return iconUrl;
}

window.renderFullRSSHeadlines = async function (container, forceRefresh = false) {
    console.log('[RSS] renderFullRSSHeadlines called', { container, forceRefresh });
    if (!container) return;

    // Cache Check: If content exists and not forced, do nothing (preserve scroll/state)
    if (!forceRefresh && container.children.length > 2) {
        console.log('[RSS] Content already loaded, skipping refresh.');
        return;
    }

    // Show loading skeleton
    container.innerHTML = '<div style="padding:20px; text-align:center; color:#999; font-size:14px;"><div class="loading-spinner" style="margin:0 auto 10px;"></div>正在聚合全网资讯...</div>';

    // Fetch from MORE feeds (Top 15) for the main tab
    const hotFeeds = window.RSS_FEEDS.slice(0, 15);
    console.log('[RSS] Fetching feeds:', hotFeeds.length);
    let allItems = [];

    try {
        const fetchPromises = hotFeeds.map(feed => window.fetchRSS(feed.url));
        const results = await Promise.all(fetchPromises);
        console.log('[RSS] Fetch results:', results);

        results.forEach((items, idx) => {
            const feed = hotFeeds[idx];
            items.forEach(item => {
                item.feedName = feed.name;
                item.feedId = feed.id;
                allItems.push(item);
            });
        });

        // Filter valid items
        allItems = allItems.filter(i => i.title && i.link);
        console.log('[RSS] Total valid items:', allItems.length);

        // Sort by date desc
        allItems.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Limit to 50 items for the main list
        const displayItems = allItems.slice(0, 50);

        container.innerHTML = '';
        if (displayItems.length === 0) {
            container.innerHTML = '<div style="padding:40px; text-align:center; color:#999;">暂无新闻动态<br><span style="font-size:12px; opacity:0.7">请检查网络或添加更多订阅源</span></div>';
            return;
        }

        // Add a "Manage Feeds" button at the top
        const manageBtn = document.createElement('div');
        manageBtn.style.cssText = 'padding: 10px 16px; margin-bottom: 10px; background: rgba(0,0,0,0.03); border-radius: 10px; display: flex; align-items: center; justify-content: space-between; font-size: 14px; font-weight: 500; color: var(--ios-blue);';
        manageBtn.innerHTML = `<span>我的订阅源 (${window.RSS_FEEDS.length})</span> <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
        manageBtn.onclick = () => {
            renderAccordionStyle(container);
        };
        container.appendChild(manageBtn);

        displayItems.forEach(item => {
            const card = createRSSItemCard(item);
            container.appendChild(card);
        });

        // Add spacer
        const spacer = document.createElement('div');
        spacer.style.height = "80px";
        container.appendChild(spacer);

    } catch (e) {
        console.error('[RSS] Render Error:', e);
        container.innerHTML = `<div style="padding:20px; color:red;">加载失败: ${e.message}</div>`;
    }
};

window.renderHomeRSSHeadlines = async function () {
    console.log('[RSS] renderHomeRSSHeadlines called');
    const listContainer = document.getElementById('rss-feed-list');
    if (!listContainer) return;

    // Show loading skeleton if empty
    if (listContainer.innerHTML === '') {
        listContainer.innerHTML = '<div style="padding:20px; color:#999; font-size:13px;">正在提取精选新鲜事...</div>';
    }

    // Fetch from top feeds (Baidu Focus and others)
    const hotFeeds = window.RSS_FEEDS.slice(0, 5); // Just take the first few for home speed
    console.log('[RSS] Home fetching:', hotFeeds.map(f => f.name));
    let allItems = [];

    // Parallel fetch
    const fetchPromises = hotFeeds.map(feed => window.fetchRSS(feed.url));
    const results = await Promise.all(fetchPromises);

    results.forEach((items, idx) => {
        const feed = hotFeeds[idx];
        items.forEach(item => {
            item.feedName = feed.name;
            item.feedId = feed.id;
            allItems.push(item);
        });
    });

    // Sort by date (if available) or random shuffle for freshness
    allItems.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Limit to 10
    const displayItems = allItems.slice(0, 10);
    console.log('[RSS] Home display items:', displayItems.length);

    listContainer.innerHTML = '';
    if (displayItems.length === 0) {
        listContainer.innerHTML = '<div style="padding:20px; color: #999;">暂无新闻动态</div>';
        return;
    }

    displayItems.forEach(item => {
        const card = createRSSItemCard(item);
        listContainer.appendChild(card);
    });
};

function createRSSItemCard(item) {
    const card = document.createElement('div');
    card.className = 'rss-news-card';

    let hostname = "rss-source";
    try { hostname = new URL(item.link || item.url).hostname.replace('www.', ''); } catch (e) { }

    const sourceLabel = item.feedName || hostname;

    let iconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
    if (hostname.includes('baidu.com')) iconUrl = "https://www.baidu.com/favicon.ico";

    // Extract potential image
    let thumb = item.image || "";
    if (!thumb && (item.content || item.description)) {
        const temp = document.createElement('div');
        temp.innerHTML = item.content || item.description;
        const imgs = temp.querySelectorAll('img');
        for (const img of imgs) {
            let src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-original');
            if (!src) continue;

            // Resolve relative URLs if necessary
            if (src.startsWith('//')) src = 'https:' + src;
            else if (src.startsWith('/') && item.link) {
                try {
                    const baseUrl = new URL(item.link).origin;
                    src = baseUrl + src;
                } catch (e) { }
            }

            // Check for valid image and not a tiny tracking pixel or favicon-like small image
            const isTracker = src.includes('1x1') || src.includes('pixel') || src.includes('favicon') || src.includes('dot.gif');
            if (src && src.startsWith('http') && !isTracker) {
                thumb = src;
                break;
            }
        }
    }

    // High-quality text snippet extraction
    const cleanSnippet = (item.description || item.content || '')
        .replace(/<[^>]*>/g, '') // Strip HTML
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')    // Collapse whitespace
        .trim()
        .substring(0, 120);

    // Date formatting with new helper
    let displayTime = formatRSSDate(item.date);

    // Render HTML (CSP-Safe, no inline onerror)
    card.innerHTML = `
        <div class="rss-news-card-header">
            <div class="rss-news-card-icon">
                <img src="${iconUrl}" referrerpolicy="no-referrer" class="rss-source-icon">
            </div>
            <div class="rss-news-card-meta">
                <span>${sourceLabel}</span>
                <span class="separator">•</span>
                <span>${displayTime}</span>
            </div>
        </div>
        <div class="rss-news-card-content">
            <div class="rss-news-card-text">
                <div class="rss-news-card-title">${item.title}</div>
                ${cleanSnippet ? `<div class="rss-news-card-snippet">${cleanSnippet}...</div>` : ''}
            </div>
            ${thumb ? `<img src="${thumb}" class="rss-news-card-thumbnail" referrerpolicy="no-referrer">` : ''}
        </div>
    `;

    // Bind Errors Handlers (Fixes Manifest V3 CSP issues)
    const iconImg = card.querySelector('.rss-source-icon');
    if (iconImg) {
        iconImg.onerror = () => {
            iconImg.src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%23ccc%22><circle cx=%2212%22 cy=%2212%22 r=%2210%22/></svg>';
        };
    }

    const thumbImg = card.querySelector('.rss-news-card-thumbnail');
    if (thumbImg) {
        thumbImg.onerror = () => {
            // Hide broken image and expand text
            thumbImg.style.display = 'none';
            const textCol = card.querySelector('.rss-news-card-text');
            if (textCol) textCol.style.flex = '1'; // Expand to fill
        };
    }

    // Click Handler (Supports both Mobile and PC)
    card.onclick = () => {
        if (window.mobileCore) {
            window.mobileCore.loadReader({
                title: item.title,
                url: item.link,
                content: item.content || item.description,
                timestamp: new Date(item.date).getTime()
            }, { fromRSS: true });
        } else {
            // PC Fallback
            if (window.renderRSSDetail) window.renderRSSDetail(item);
        }
    };
    return card;
}


// Helper: Fetch a single URL (promisified)
function fetchSingleRSS(url) {
    return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            // Extension Context
            chrome.runtime.sendMessage({ action: 'BACKGROUND_FETCH', url: url }, (response) => {
                if (!response || !response.success) {
                    console.warn('[RSS] Background fetch failed for:', url, response?.error);
                    resolve([]);
                }
                else resolve(parseRSSResponse(response.text));
            });
        } else {
            // Mobile/Direct (CORS Restricted)
            console.log('[RSS] Direct fetch (CORS warning):', url);

            // V12.0: Try CORS Proxy first for mobile web compatibility
            const proxy = 'https://api.allorigins.win/raw?url=';
            const targetUrl = proxy + encodeURIComponent(url);

            fetch(targetUrl)
                .then(r => {
                    if (!r.ok) throw new Error(r.statusText);
                    return r.text();
                })
                .then(text => resolve(parseRSSResponse(text)))
                .catch(e => {
                    console.warn('[RSS] Proxy fetch failed, trying direct:', e);
                    // Fallback to direct fetch
                    fetch(url)
                        .then(r => r.text())
                        .then(text => resolve(parseRSSResponse(text)))
                        .catch(err => {
                            console.error('[RSS] All fetch methods failed:', err);
                            resolve([]);
                        });
                });
        }
    });
}

window.fetchRSS = async function (url) {
    // 1. Handle Aggregated Feeds
    if (url.startsWith('aggregated://')) {
        const key = url.replace('aggregated://', '');
        const sourceUrls = AGGREGATED_SOURCES[key];
        if (!sourceUrls) return [];

        // Parallel Fetch
        const promises = sourceUrls.map(u => fetchSingleRSS(u));
        const allResults = await Promise.all(promises);

        // Flatten
        let merged = allResults.flat();

        // Deduplicate (by link)
        const seen = new Set();
        merged = merged.filter(item => {
            if (!item.link || seen.has(item.link)) return false;
            seen.add(item.link);
            return true;
        });

        // Parse Dates & Sort (Newest First)
        merged.sort((a, b) => {
            const dA = a.date ? new Date(a.date).getTime() : 0;
            const dB = b.date ? new Date(b.date).getTime() : 0;
            return dB - dA;
        });

        return merged;
    }

    // 2. Standard Single Feed
    return fetchSingleRSS(url);
};

function parseRSSResponse(text) {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");
        let items = xmlDoc.querySelectorAll("item");
        let isAtom = false;
        if (items.length === 0) { items = xmlDoc.querySelectorAll("entry"); isAtom = true; }
        const results = [];
        items.forEach(item => {
            const title = item.querySelector("title")?.textContent || 'No Title';
            let link = '#';
            if (isAtom) {
                const linkEl = item.querySelector("link[rel='alternate']") || item.querySelector("link:not([rel])") || item.querySelector("link");
                link = linkEl?.getAttribute('href') || '#';
            } else {
                link = item.querySelector("link")?.textContent || '#';
            }
            const pubDate = item.querySelector("pubDate")?.textContent || item.querySelector("updated")?.textContent || item.querySelector("published")?.textContent || '';
            const description = item.querySelector("description")?.textContent || item.querySelector("summary")?.textContent || '';
            const content = item.querySelector("encoded")?.textContent || item.querySelector("content")?.textContent || description;

            // Extract image from XML tags (enclosure or media:content)
            let image = "";
            const enclosure = item.querySelector("enclosure[type^='image']");
            if (enclosure) {
                image = enclosure.getAttribute("url");
            } else {
                const media = item.querySelector("content[medium='image']") || item.querySelector("thumbnail");
                if (media) image = media.getAttribute("url");
            }

            results.push({ title, link, date: pubDate, description, content, image });
        });
        return results;
    } catch (e) { return []; }
}

window.selectRSSFeed = async function (feed) {
    window.currentRSSFeed = feed;
    const articleListView = document.getElementById('article-list-view');
    const rssListView = document.getElementById('rss-list-view');
    const contentView = document.getElementById('content-view');
    const titleEl = document.getElementById('rss-feed-title');
    const listContainer = document.getElementById('rss-news-list');

    if (articleListView) articleListView.style.display = 'none';
    if (contentView) contentView.style.display = 'none';
    if (rssListView) rssListView.style.display = 'flex';

    // Ensure right pane shows empty state until an article is selected
    const emptyState = document.getElementById('empty-state');
    const readerView = document.getElementById('rss-reader-view');
    if (emptyState) emptyState.style.display = 'flex';
    if (readerView) readerView.style.display = 'none';

    // Hide article header info since no specific article is selected yet
    const artHeader = document.getElementById('article-header-info');
    if (artHeader) artHeader.style.display = 'none';

    // Set Title
    if (titleEl) titleEl.innerText = feed.name;

    // Show Loading
    if (listContainer) {
        listContainer.innerHTML = '<div style="padding:20px; color:#64748b;">正在同步最新资讯...</div>';
    }

    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const activeItem = document.querySelector(`.nav-item[data-id="${feed.id}"]`);
    if (activeItem) activeItem.classList.add('active');

    let items = await window.fetchRSS(feed.url);

    // Filter by Read Status if active
    const readRes = await window.appStorage.get('rss_read_links');
    const readLinks = readRes.rss_read_links || [];

    if (window.unreadOnlyRSS) {
        items = items.filter(item => !readLinks.includes(item.link));
    }

    if (listContainer) {
        listContainer.innerHTML = '';
        if (!items || items.length === 0) {
            listContainer.innerHTML = `<div style="padding:20px; color:#64748b;">${window.unreadOnlyRSS ? '✨ All caught up! No unread items.' : '⚠️ 频道请求失败，请稍后重试。'}</div>`;
            return;
        }

        items.forEach(item => {
            item.feedName = feed.name;
            const card = createRSSItemCard(item);
            listContainer.appendChild(card);
        });
    }
};

window.renderRSSDetail = async function (item) {
    currentRSSItem = item;

    // Mark as read
    if (item.link && item.link !== '#') {
        const res = await window.appStorage.get('rss_read_links');
        const readLinks = res.rss_read_links || [];
        if (!readLinks.includes(item.link)) {
            readLinks.push(item.link);
            if (readLinks.length > 2000) readLinks.shift();
            await window.appStorage.set({ rss_read_links: readLinks });

            // Visually mark in list instantly
            const row = document.querySelector(`.rss-item-row[data-link="${item.link.replace(/"/g, '\\"')}"]`);
            if (row) {
                row.style.opacity = '0.6';
                const dateRow = row.querySelector('.rss-date-row');
                if (dateRow && !dateRow.querySelector('.rss-read-indicator')) {
                    dateRow.insertAdjacentHTML('beforeend', '<span class="rss-read-indicator" style="display:inline-block; width:8px; height:8px; background-color:#a5d6a7; border-radius:50%; margin-left:8px;"></span>');
                }
            }
        }
    }

    if (window.mobileCore) {
        window.mobileCore.loadReader({
            title: item.title,
            url: item.link,
            content: item.content || item.description,
            timestamp: new Date(item.date).getTime()
        }, { fromRSS: true });
        return;
    }

    const readerView = document.getElementById('rss-reader-view');
    const emptyState = document.getElementById('empty-state');
    if (!readerView) return;
    readerView.style.display = 'flex';
    if (emptyState) emptyState.style.display = 'none';

    const globalTitle = document.getElementById('current-page-title');
    const toolbarTitle = document.getElementById('toolbar-article-title');
    const artHeader = document.getElementById('article-header-info');
    const rssTitleEl = document.getElementById('rss-article-title');
    const contentEl = document.getElementById('rss-article-content');
    const sourceEl = document.getElementById('rss-article-source');
    const dateEl = document.getElementById('rss-article-date');
    const linkEl = document.getElementById('rss-article-link');
    const displayTitle = item.title || 'Untitled Article';

    if (rssTitleEl) rssTitleEl.innerText = displayTitle;
    if (globalTitle) globalTitle.innerText = displayTitle;
    if (toolbarTitle) toolbarTitle.innerText = displayTitle.length > 60 ? displayTitle.substring(0, 60) + '...' : displayTitle;
    if (artHeader) artHeader.style.display = 'flex';

    const scrollContainer = document.getElementById('reader-content-scroll');
    if (scrollContainer) scrollContainer.scrollTop = 0;
    if (dateEl) dateEl.innerText = formatRSSDate(item.date);
    if (sourceEl) sourceEl.innerText = new URL(item.link).hostname;
    if (linkEl) linkEl.href = item.link;
    contentEl.innerHTML = `<div id="snapshot-status-bar" style="background:#f8fafc; border:1px solid #e2e8f0; padding:10px 15px; border-radius:8px; margin-bottom:20px; font-size:12px; color:#64748b;">📡 正在提取全文并优化图片资源...</div><div id="rss-body-wrapper" class="rss-content-area" style="opacity:0.7; transition:opacity 0.5s; position:relative;">${(item.content || item.description || '').replace('<![CDATA[', '').replace(']]>', '')}</div>`;

    chrome.runtime.sendMessage({ action: 'FETCH_ARTICLE_SNAPSHOT', url: item.link }, async (response) => {
        const bodyWrapper = document.getElementById('rss-body-wrapper');
        const statusBar = document.getElementById('snapshot-status-bar');

        if (!response || !response.success) {
            if (statusBar) statusBar.innerHTML = '⚠️ 无法获取全文，显示预览';
            if (bodyWrapper) bodyWrapper.style.opacity = '1';
            return;
        }

        if (statusBar) statusBar.remove(); // Remove status bar when ready
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(response.html, 'text/html');
            const baseUri = item.link;
            // Improved Image Processing: Resolve URLs and handle lazy loading 
            doc.querySelectorAll('img').forEach(img => {
                const lazyAttrs = ['data-src', 'original-src', 'data-original', 'data-actualsrc', 'data-srcset'];
                let realSrc = null;
                for (const attr of lazyAttrs) {
                    const val = img.getAttribute(attr);
                    if (val) { realSrc = val; break; }
                }
                if (!realSrc) realSrc = img.getAttribute('src');

                if (realSrc) {
                    if (!realSrc.startsWith('http') && !realSrc.startsWith('data:')) {
                        try { img.src = new URL(realSrc, baseUri).href; } catch (e) { }
                    } else {
                        img.src = realSrc;
                    }
                }

                // Set referer policy and avoid breaking the layout
                img.setAttribute('referrerpolicy', 'no-referrer');
                img.style.maxWidth = '100%';
            });
            doc.querySelectorAll('a').forEach(a => { const href = a.getAttribute('href'); if (href && !href.startsWith('http') && !href.startsWith('#')) { try { a.href = new URL(href, baseUri).href; } catch (e) { } } });

            // Pre-cleaning: Aggressively remove social/interaction junk
            const junkSelectors = [
                '.comment-box', '.share-bar', '.post-footer', '.article-social', '.report-btn', '.fav-btn',
                '.interaction-box', '.like-container', '.comment-area', '.footer-links', '.social-icons',
                '.post-actions', '.sidebar-tools', '.article-actions', '.bottom-actions', '.recom-list',
                '.sharing', '.social-share', '.article-share', '.share-links', '.social-links',
                '.shareLinks', '.share-btn', '.share-area', '.post-share', '.social-bar',
                'footer', '.footer', '.copyright', '.author-bio',
                '.baidu-msg', '.baidu-nav', '.baidu-logo', '.open-app', '.app-open-btn'
            ];
            doc.querySelectorAll(junkSelectors.join(',')).forEach(el => el.remove());

            // Remove suspected social icons (often small images or specialized fonts)
            doc.querySelectorAll('img').forEach(img => {
                const src = (img.getAttribute('src') || '').toLowerCase();
                const cls = (img.className || '').toLowerCase();
                const alt = (img.getAttribute('alt') || '').toLowerCase();

                // Aggressive check for social platform keywords
                const socialKeywords = ['share', 'like', 'comment', 'fav', 'wechat', 'weixin', 'weibo', 'qq', 'facebook', 'twitter', 'linkedin'];
                const isSocial = socialKeywords.some(kw => src.includes(kw) || cls.includes(kw) || alt.includes(kw));

                if (isSocial) {
                    img.remove();
                }
            });

            // FT Chinese specific: Remove huge SVG icons and social containers
            doc.querySelectorAll('svg, button, a').forEach(el => {
                const text = el.innerText || '';
                if (text.includes('百度一下') || text.includes('APP内打开') || text.includes('打开APP')) {
                    el.remove();
                }
            });

            doc.querySelectorAll('svg').forEach(svg => {
                const cls = (svg.getAttribute('class') || '').toLowerCase();
                if (cls.includes('share') || cls.includes('social') || cls.includes('wechat') || cls.includes('weixin')) {
                    svg.remove();
                }
            });
            doc.querySelectorAll('.sharing, .social-share, .shareLinks, .article-share, .post-actions').forEach(el => el.remove());

            // Target specific strings like "举报/反馈" or "收藏" if they are in small isolated buttons
            doc.querySelectorAll('span, a, div, p').forEach(el => {
                const txt = el.innerText.trim();
                // Remove isolated counts or social words
                if (txt === '举报/反馈' || txt === '收藏' || txt === '分享' || txt === '0' || txt === '点赞' || txt === '微信' || txt === '朋友圈' || txt === '关注') {
                    // Only remove if it's a small container
                    if (el.innerText.length < 15) {
                        const parent = el.closest('div');
                        if (parent && parent.innerText.length < 25) parent.remove();
                        else el.remove();
                    }
                }
            });

            const reader = new Readability(doc);
            const article = reader.parse();

            // Validation: Check if content is substantial. 
            const isContentValid = article && article.content && article.textContent.length > 50;

            if (isContentValid) {
                updateDiagStatus('✅ 全文已就绪');
                if (bodyWrapper) {
                    let html = article.content;
                    // Final Regex scrub for common junk strings Readability might miss
                    html = html.replace(/<p>[ \t\n]*(举报\/反馈|收藏|分享|点赞|0)[ \t\n]*<\/p>/gi, '');
                    html = html.replace(/<div[^>]*>[ \t\n]*(举报\/反馈|收藏|分享|点赞|0)[ \t\n]*<\/div>/gi, '');

                    const saved = await window.appStorage.get(item.link);
                    const highlights = saved[item.link] || [];
                    highlights.forEach(h => { if (h.text) { const escaped = h.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); html = html.replace(new RegExp(escaped, 'g'), `<mark class="rss-mark" style="background:${h.color || '#fff176'}">${h.text}</mark>`); } });
                    bodyWrapper.innerHTML = html;
                    bodyWrapper.style.opacity = '1';
                }
            } else {
                // Fallback to description + link
                updateDiagStatus('⚠️ 全文提取不完整，已显示摘要', true);
                if (bodyWrapper) {
                    bodyWrapper.innerHTML = `
                        <div style="padding: 20px; background: #f8fafc; border-radius: 8px; color: #475569; line-height: 1.6;">
                            <h3 style="margin-top:0; font-size:16px;">摘要</h3>
                            <p>${item.description || item.content || '无摘要内容'}</p>
                            <div style="margin-top:20px; text-align:center;">
                                <a href="${item.link}" target="_blank" class="primary-btn" style="display:inline-block; text-decoration:none; padding: 8px 16px; border-radius: 6px; background: #4f46e5; color: white;">阅读原文 ↗</a>
                            </div>
                        </div>
                    `;
                    bodyWrapper.style.opacity = '1';
                }
            }
        } catch (e) {
            console.error(e);
            updateDiagStatus('❌ 解析失败', true);
            if (bodyWrapper) {
                bodyWrapper.innerHTML = `
                    <div style="padding: 20px; text-align: center;">
                        <p>无法解析该页面内容。</p>
                        <a href="${item.link}" target="_blank" class="primary-btn" style="text-decoration:none; color: #4f46e5;">前往原网页查看 ↗</a>
                    </div>
                `;
                bodyWrapper.style.opacity = '1';
            }
        }
    });
};

function initRSSHighlighter() {
    let floatBtn = null;
    document.addEventListener('mouseup', (e) => {
        const selection = window.getSelection();
        const text = selection.toString().trim();
        const wrapper = document.getElementById('rss-body-wrapper');
        if (!text || !wrapper || !wrapper.contains(selection.anchorNode)) { if (floatBtn) floatBtn.remove(); floatBtn = null; return; }
        if (!floatBtn) { floatBtn = document.createElement('div'); floatBtn.className = 'rss-float-tool'; floatBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> 标亮选中内容`; document.body.appendChild(floatBtn); }
        const range = selection.getRangeAt(0); const rect = range.getBoundingClientRect();
        floatBtn.style.left = `${rect.left + rect.width / 2 - 60}px`; floatBtn.style.top = `${rect.top + window.scrollY - 10}px`;
        floatBtn.onmousedown = async (ev) => { ev.preventDefault(); e.stopPropagation(); await saveRSSHighlight(text); floatBtn.remove(); floatBtn = null; selection.removeAllRanges(); };
    });
}

async function saveRSSHighlight(text) {
    if (!currentRSSItem || !text) return;
    const url = currentRSSItem.link;
    const highlight = { id: 'rss-' + Date.now(), text, color: '#fff176', timestamp: Date.now(), url, title: currentRSSItem.title || 'RSS Article', type: 'text' };
    const data = await window.appStorage.get(url);
    const highlights = data[url] || [];
    highlights.push(highlight);
    await window.appStorage.set({ [url]: highlights });
    const wrapper = document.getElementById('rss-body-wrapper');
    if (wrapper) { const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); wrapper.innerHTML = wrapper.innerHTML.replace(new RegExp(escaped, 'g'), `<mark class="rss-mark">${text}</mark>`); }
    if (window.showToast) window.showToast('标亮已同步');
}

function updateDiagStatus(msg, isError = false) { const bar = document.getElementById('snapshot-status-bar'); if (bar) { bar.innerText = msg; bar.style.color = isError ? '#ef4444' : '#64748b'; } }
function formatRSSDate(dateStr) { if (!dateStr) return ''; try { return new Date(dateStr).toLocaleDateString(); } catch (e) { return dateStr; } }

// Helper: Time Format (Copied from mobile-core.js for standalone usage)
function formatRSSDate(date) {
    if (!date) return '';
    // Try to parse if it's not a valid date object/string
    let past;
    try {
        past = new Date(date);
        if (isNaN(past.getTime())) return date; // Return original if parsing fails
    } catch (e) { return date; }

    const now = new Date();
    const diff = Math.floor((now - past) / 1000);

    // Future protection
    if (diff < 0) return '刚刚';

    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}天前`;

    // Fallback to simple date for older items
    return past.getMonth() + 1 + '-' + past.getDate();
};
