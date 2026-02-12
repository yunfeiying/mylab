/**
 * background.js - 后台 Service Worker 核心 (集成工业级 Google News 解密引擎)
 */

// I. 消息监听器
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // 1. Badge Update
    if (request.type === 'UPDATE_TAB_BADGE') {
        const count = request.count || 0;
        const tabId = sender.tab ? sender.tab.id : null;
        if (tabId) {
            chrome.action.setBadgeText({
                text: count > 0 ? count.toString() : '',
                tabId: tabId
            });
            chrome.action.setBadgeBackgroundColor({
                color: '#6366f1',
                tabId: tabId
            });
        }
    }

    if (request.action === 'FETCH_ARTICLE_SNAPSHOT') {
        processGoogleNewsUrl(request.url).then(finalUrl => {
            console.log('[Snapshot] Deep probing final URL:', finalUrl);
            return fetchWithCharset(finalUrl);
        }).then(html => {
            sendResponse({ success: true, html: html });
        }).catch(err => {
            console.error('[Snapshot] Pipeline failed:', err.message);
            sendResponse({ success: false, error: err.message });
        });
        return true;
    }

    if (request.action === 'BACKGROUND_FETCH') {
        fetchWithCharset(request.url)
            .then(html => sendResponse({ success: true, text: html }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }
});

/**
 * 核心：解析 Google News 加密链接
 * 参考开源方案：直接解密 Base64 嵌套路径，跳过 500KB 的中转页
 */
async function processGoogleNewsUrl(url) {
    if (!url.includes('news.google.com/rss/articles/')) return url;

    try {
        const parts = url.split('/');
        const encoded = parts[parts.length - 1].split('?')[0];

        // 1. 尝试本地 Base64 快速解码
        // Google NEWS 的 CBMi... 格式通常在第 4 个字节后存有原始 URL
        const decoded = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
        const urlMatch = decoded.match(/https?:\/\/[^\s\x00-\x1f\x7f-\xff]+/);

        if (urlMatch) {
            console.log('[Snapshot] Fast decoded URL:', urlMatch[0]);
            return urlMatch[0];
        }

        // 2. 如果本地解码失败，采用“工业级”方案：调用 Google 内部 batchexecute 网关
        // 这是目前 RSSHub 等开源工具解决 2024 新版加密的终极手段
        console.log('[Snapshot] Fast decode failed, calling Google Gateway...');
        const rpcid = 'Fbv4je';
        const payload = `f.req=[[["${rpcid}","[\\"${encoded}\\",1]",null,"generic"]]]`;

        const gatewayResp = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=' + rpcid, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body: payload
        });

        const text = await gatewayResp.text();
        const jsonMatch = text.match(/\["https?:\/\/[^"]+"/); // 暴力匹配返回包里的第一个 URL
        if (jsonMatch) {
            const cleanUrl = jsonMatch[0].replace('["', '').replace('"', '');
            console.log('[Snapshot] Gateway resolved URL:', cleanUrl);
            return cleanUrl;
        }
    } catch (e) {
        console.warn('[Snapshot] Advanced decode error, falling back to original URL:', e.message);
    }
    return url;
}

/**
 * 核心：支持多编码的 HTML 抓取
 * 自动识别 UTF-8 / GBK (处理国内报刊乱码)
 */
// 核心：支持多编码的 HTML 抓取
// 自动识别 UTF-8 / GBK (处理国内报刊乱码)
async function fetchWithCharset(url) {
    const resp = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const buffer = await resp.arrayBuffer();
    let decoder = new TextDecoder('utf-8');
    let charset = 'utf-8';

    // 1. 优先尝试 HTTP Header
    const contentType = resp.headers.get('content-type');
    if (contentType && contentType.includes('charset=')) {
        const match = contentType.match(/charset=([^;]+)/i);
        if (match && match[1]) {
            charset = match[1].trim().toLowerCase();
        }
    }

    // 2. 如果 Header 没指定，或指定为 UTF-8，再尝试从 Meta 标签探测 (以防 Header 撒谎或 Meta 更准)
    // 但通常 Header 权重大。这里我们仅在 Header 缺失或 default 时 double-check meta。
    // 策略：先按推测的 charset 尝试解码
    try {
        if (charset === 'gb2312' || charset === 'gbk') charset = 'gbk';
        decoder = new TextDecoder(charset);
    } catch (e) {
        console.warn('Invalid charset from header:', charset, 'Falling back to UTF-8');
        decoder = new TextDecoder('utf-8');
    }

    let html = decoder.decode(buffer);

    // 3. 再次效验 Meta (针对 Header 缺省的情况，或者 Header 说是 ISO-8859-1 但其实是 UTF-8/GBK 的情况)
    if (!contentType || !contentType.includes('charset=')) {
        const metaMatch = html.match(/<meta[^>]+charset=["']?([^"'>\s/]+)["']?/i);
        if (metaMatch && metaMatch[1]) {
            const metaCharset = metaMatch[1].toLowerCase();
            if (metaCharset !== charset && metaCharset !== 'utf-8' && metaCharset !== 'utf8') {
                try {
                    console.log(`[Charset] Switching from ${charset} to ${metaCharset} based on meta tag`);
                    html = new TextDecoder(metaCharset).decode(buffer);
                } catch (e) {
                    // ignore invalid charsets
                }
            }
        }
    }

    return html;
}

// II. 生命周期与标签页监听
chrome.tabs.onActivated.addListener(activeInfo => {
    chrome.tabs.sendMessage(activeInfo.tabId, { action: 'FORCE_UPDATE_BADGE' }).catch(() => { });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        chrome.tabs.sendMessage(tabId, { action: 'FORCE_UPDATE_BADGE' }).catch(() => { });
    }
});