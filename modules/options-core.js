/**
 * options-core.js - 核心业务与授权
 * 包含: checkProStatus, loadData, 以及核心全局变量
 */

// ==========================================
// 核心全局变量 - 直接挂载到 window
// ==========================================
window.IS_PRO = false;
window.filterMenuState = 0;
window.isSearchMode = false;
window.currentSearchQuery = '';
window.folderStructure = [];
window.groupedData = [];
window.selectedUrl = null;
window.activeColorFilter = null;
window.currentSortType = 'time';
window.selectedResources = new Set();
window.currentFolderId = null;

window.COLORS = [
    '#fff176', '#a5d6a7', '#ef9a9a', '#90caf9', '#ce93d8',
    '#ffcc80', '#80cbc4', '#b39ddb', '#9fa8da', '#fff59d',
    '#ffab91', '#e6ee9c', '#81d4fa', '#f48fb1', '#bcaaa4',
    '#ffe082', '#c5e1a5', '#ef5350', '#4dd0e1', '#b388ff',
    '#ffd54f', '#66bb6a', '#ec407a', '#42a5f5', '#ab47bc',
    '#ffa726', '#26a69a', '#d4e157', '#29b6f6', '#7e57c2',
    '#ff7043', '#9ccc65', '#5c6bc0', '#8d6e63', '#78909c'
];

// ==========================================
// Pro 状态检查 - 使用原始存储键
// ==========================================
window.checkProStatus = async function () {
    const data = await window.appStorage.get(['user_license_status', 'trial_start_date']);

    if (data.user_license_status === 'valid') {
        return { isPro: true, type: 'license', daysLeft: 9999 };
    }

    const installTime = data.trial_start_date || Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const diff = Date.now() - installTime;

    if (diff < sevenDays) {
        const daysLeft = Math.ceil((sevenDays - diff) / (24 * 60 * 60 * 1000));
        return { isPro: true, type: 'trial', daysLeft: daysLeft };
    }
    return { isPro: false, type: 'free', daysLeft: 0 };
};

// ==========================================
// 数据加载 - 使用原始实现
// ==========================================
window.loadData = async function () {
    const allData = await window.appStorage.get(null);
    const groups = {};

    for (const [urlKey, items] of Object.entries(allData)) {
        // Skip non-highlight keys
        if (urlKey.startsWith('meta_') || urlKey.startsWith('inspiration_') ||
            ['autoOpenPDF', 'archived_articles', 'last_active_url', 'color_level_settings',
                'smart_temp_content', 'smart_temp_title', 'folder_structure', 'webdav_url',
                'webdav_user', 'webdav_pass', 'gdrive_sync_enabled', 'sync_deleted_items',
                'user_license_status', 'user_license_key', 'deepseek_api_key', 'trial_start_date',
                'color_meanings', 'global_read_later', 'app_language', 'trash_bin', 'sync_mode',
                'ocr_shortcut_mode', 'show_trash_bin', 'user_notes', 'ai_api_key', 'ai_base_url',
                'ai_model', 'notebooklm_sync_enabled'].includes(urlKey)) continue;

        if (Array.isArray(items) && items.length > 0) {
            const title = items[0].title || chrome.i18n.getMessage('ui_untitled');
            if (!groups[urlKey]) {
                groups[urlKey] = { title: title, items: [], url: urlKey, timestamp: 0 };
            }
            const enrichedItems = items.map(i => ({ ...i, storageKey: urlKey }));
            groups[urlKey].items = enrichedItems;
            const latestItemTs = Math.max(...items.map(i => i.timestamp));
            groups[urlKey].timestamp = latestItemTs;
        }
    }

    window.groupedData = Object.values(groups).sort((a, b) => b.timestamp - a.timestamp);
};

// ==========================================
// 4. Utility Functions
// ==========================================
window.escapeHtml = function (text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

window.formatTime = function (seconds) {
    if (!seconds && seconds !== 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
};

window.showToast = function (msg, duration = 3000) {
    console.log('[showToast] Called with:', msg);
    const div = document.createElement('div');
    div.innerText = msg;
    div.style.cssText = 'position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:white; padding:10px 20px; border-radius:4px; z-index:9999; font-size:14px; box-shadow:0 2px 10px rgba(0,0,0,0.2); transition: opacity 0.3s;';
    document.body.appendChild(div);
    setTimeout(() => {
        div.style.opacity = '0';
        setTimeout(() => div.remove(), 300);
    }, duration);
};

console.log('[options-core.js] Loaded: Core data layer with checkProStatus, loadData, utils');
