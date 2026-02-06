// background.js - Cleaned, Modularized & Optimized
import { driveSyncService } from './js/services/DriveSyncService.js';
import { webDavSyncService } from './js/services/WebDavSyncService.js';
import { notionSyncService } from './js/services/NotionSyncService.js';
// [引入] 迁移服务和 NotebookLM 同步服务
import { checkAndMigrateData, setupNotebookLMSync } from './src/services/DataMigrationService.js';

// ==========================================
// 1. 初始化与生命周期
// ==========================================

// 安装/更新时触发
chrome.runtime.onInstalled.addListener((details) => {
    chrome.action.setBadgeText({ text: '' });

    // [Action 1] 触发数据结构迁移 (大JSON -> 文件夹)
    checkAndMigrateData().catch(e => console.error("Migration failed:", e));

    // [Action 2] 初始化 NotebookLM 同步监听
    setupNotebookLMSync();

    // 如果是全新安装，初始化试用期
    if (details.reason === 'install') {
        chrome.storage.local.set({
            'trial_start_date': Date.now(),
            'user_license_status': 'none'
        });
    }
});

// 浏览器启动时触发
chrome.runtime.onStartup.addListener(() => {
    chrome.action.setBadgeText({ text: '' });

    // 每次启动都检查一下迁移状态（为了确保断点续传）
    checkAndMigrateData().catch(e => console.error("Migration check failed:", e));

    // 重新挂载 NotebookLM 监听
    setupNotebookLMSync();
});


// ==========================================
// 2. 消息路由中心 (Message Router)
// ==========================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    // A. 界面更新：角标
    if (request.type === 'UPDATE_TAB_BADGE' && sender.tab) {
        const count = request.count;
        const text = count > 0 ? count.toString() : '';
        chrome.action.setBadgeText({ text: text, tabId: sender.tab.id });
        chrome.action.setBadgeBackgroundColor({ color: '#8ac9ed', tabId: sender.tab.id });
        return; // 同步返回
    }

    // B. 功能：激活码验证
    if (request.action === 'VERIFY_LICENSE') {
        verifyLicense(request.key).then(sendResponse);
        return true; // 异步返回
    }

    // C. 功能：屏幕截图
    if (request.action === 'CAPTURE_VISIBLE_TAB') {
        chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'jpeg', quality: 60 }, (dataUrl) => {
            if (chrome.runtime.lastError) {
                console.error("Screenshot failed:", chrome.runtime.lastError.message);
                sendResponse(null);
            } else {
                sendResponse(dataUrl);
            }
        });
        return true;
    }

    // D. 功能：AI 智能预读
    if (request.action === 'START_AI_READING') {
        handleAIReading(request.tabId).then(sendResponse);
        return true;
    }

    // E. 同步：WebDAV
    if (request.action === 'START_WEBDAV_SYNC') {
        webDavSyncService.sync().then(sendResponse);
        return true; // 异步返回
    }

    // F. 同步：Google Drive
    if (request.action === 'START_GDRIVE_SYNC') {
        driveSyncService.sync().then(sendResponse);
        return true; // 异步返回
    }

    // G. 同步：Notion
    if (request.action === 'START_NOTION_SYNC') {
        notionSyncService.syncMemory().then(sendResponse).catch(e => sendResponse({ success: false, error: e.message }));
        return true; // 异步返回
    }

    // G. 功能：跨域获取图片并转换为 Base64 (绕过 CORS/Referer)
    if (request.action === 'FETCH_IMAGE_BASE64') {
        fetch(request.url, { referrerPolicy: 'no-referrer' })
            .then(resp => {
                if (!resp.ok) throw new Error('Fetch failed');
                return resp.blob();
            })
            .then(blob => {
                const reader = new FileReader();
                reader.onloadend = () => sendResponse({ success: true, data: reader.result });
                reader.readAsDataURL(blob);
            })
            .catch(err => {
                console.error("Background fetch failed:", err);
                sendResponse({ success: false, error: err.message });
            });
        return true;
    }

    // H. 功能：跨域获取网页内容并提取文本
    if (request.action === 'FETCH_URL_CONTENT') {
        fetch(request.url, {
            referrerPolicy: 'no-referrer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        })
            .then(resp => {
                if (!resp.ok) throw new Error(`HTTP Error ${resp.status}`);
                return resp.text();
            })
            .then(html => {
                // Extract title
                const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
                const title = titleMatch ? titleMatch[1].trim() : '';

                // 简单的 HTML 文本提取 (去掉 script, style, tags)
                let text = html
                    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gmi, '')
                    .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gmi, '')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .substring(0, 50000); // 截断防止内存溢出

                sendResponse({
                    success: true,
                    text: text,
                    html: html, // Provide full HTML for snapshot
                    title: title
                });
            })
            .catch(err => {
                sendResponse({ success: false, error: err.message });
            });
        return true;
    }
});


// ==========================================
// 3. 辅助功能模块
// ==========================================

// PDF 自动打开逻辑
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        if (tab.url.toLowerCase().endsWith('.pdf') || tab.url.includes('.pdf?')) {
            chrome.storage.local.get('autoOpenPDF', (res) => {
                if (res.autoOpenPDF) {
                    const viewerUrl = chrome.runtime.getURL(`pdf_viewer.html?file=${encodeURIComponent(tab.url)}`);
                    chrome.tabs.update(tabId, { url: viewerUrl });
                }
            });
        }
        // 稍微延迟更新一下 Badge
        setTimeout(() => {
            chrome.tabs.sendMessage(tabId, { action: 'FORCE_UPDATE_BADGE' }).catch(() => { });
        }, 500);
    }
});

// License 验证逻辑
async function verifyLicense(licenseKey) {
    try {
        const response = await fetch('https://api.lemonsqueezy.com/v1/licenses/activate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `license_key=${licenseKey}&instance_name=Highlighti_User`
        });
        const data = await response.json();

        if (data.activated) {
            let expiryTimestamp = 9999999999999;
            if (data.license_key && data.license_key.expires_at) {
                expiryTimestamp = new Date(data.license_key.expires_at).getTime();
            }

            await chrome.storage.local.set({
                user_license_status: 'valid',
                user_license_key: licenseKey,
                user_license_expiry: expiryTimestamp
            });
            return { success: true };
        } else {
            return { success: false, error: data.error || 'Invalid License Key' };
        }
    } catch (error) {
        return { success: false, error: 'Network Error' };
    }
}

// AI 智能预读逻辑
async function handleAIReading(tabId) {
    try {
        const settings = await chrome.storage.local.get(['ai_api_key', 'ai_base_url', 'ai_model', 'user_license_status']);

        // 简单鉴权
        if (settings.user_license_status !== 'valid') {
            return { success: false, error: 'Pro feature only' };
        }

        const apiKey = settings.ai_api_key;
        let baseUrl = settings.ai_base_url || 'https://api.deepseek.com';
        let model = settings.ai_model || 'deepseek-chat';

        if (!apiKey) return { success: false, error: 'Please configure AI settings in Smart Page first' };

        if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
        const endpoint = `${baseUrl}/chat/completions`;

        const pageData = await chrome.tabs.sendMessage(tabId, { action: 'GET_PAGE_TEXT' });
        if (!pageData || !pageData.text) return { success: false, error: 'Cannot extract page content' };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: model,
                messages: [{
                    role: "user",
                    content: `Please summarize the core ideas (summary) and extract 3-5 quotes (quotes) from the following text. Return in JSON format: {"summary":"...","quotes":["..."]}.\n\nText: ${pageData.text.substring(0, 8000)}`
                }],
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) throw new Error(`API Error: ${response.status}`);

        const result = await response.json();
        let content = result.choices[0].message.content;
        try {
            return { success: true, data: JSON.parse(content) };
        } catch (e) {
            return { success: true, data: { summary: content, quotes: [] } };
        }

    } catch (err) {
        console.error(err);
        return { success: false, error: err.message || 'AI Request Failed' };
    }
}



// 数据合并辅助函数
function mergeCloudData(local, cloud) {
    const merged = { ...local };
    for (const [key, val] of Object.entries(cloud)) {
        if (Array.isArray(val) && Array.isArray(merged[key])) {
            const localIds = new Set(merged[key].map(i => i.id));
            const newItems = val.filter(i => !localIds.has(i.id));
            if (newItems.length > 0) {
                merged[key] = [...merged[key], ...newItems].sort((a, b) => b.timestamp - a.timestamp);
            }
        } else if (!merged[key]) {
            merged[key] = val;
        }
    }
    return merged;
}