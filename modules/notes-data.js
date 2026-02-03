/**
 * notes-data.js - 数据层（Model）
 * 包含: loadNotes, saveNotes, loadConfig, 以及核心数据变量
 * 注意：已切换至 IndexedDB 存储以支持大数据量
 */

// ==========================================
// 核心数据变量 - 直接挂载到 window
// ==========================================
window.currentNoteId = null;
window.notes = [];
window.aiConfig = {};
window.resizingElement = null;
window.currentAttachments = [];
window.debouncedTitleSave = null;
window.debouncedBodySave = null;
window.titleInput = null;
window.bodyInput = null;
window.lastSelectionRange = null;
window.noteCategorizer = null;
window.isTrashMode = false;
window.currentFolderId = null;

// ==========================================
// 配置加载 (API Key 等配置仍保留在 chrome.storage.local 以便跨端同步)
// ==========================================
window.loadConfig = async function () {
    const res = await chrome.storage.local.get(['ai_api_key', 'ai_base_url', 'ai_model', 'deepseek_api_key', 'deepseek_base_url', 'deepseek_model']);
    window.aiConfig = {
        apiKey: res.ai_api_key || res.deepseek_api_key,
        baseUrl: res.ai_base_url || res.deepseek_base_url || 'https://api.deepseek.com',
        model: res.ai_model || res.deepseek_model || 'deepseek-chat'
    };
};

// ==========================================
// 笔记数据加载 (IndexedDB)
// ==========================================
window.loadNotes = async function () {
    console.log('[notes-data] Loading notes from IndexedDB...');

    // 1. Try to load from IndexedDB
    let storedNotes = await window.idb.get('user_notes');

    // 2. MIGRATION: If IDB empty, check chrome.storage.local
    if (!storedNotes) {
        console.log('[notes-data] IndexedDB empty, checking chrome.storage.local migration...');
        const localRes = await chrome.storage.local.get('user_notes');
        if (localRes.user_notes) {
            console.log('[notes-data] Found legacy data in chrome.storage.local. Migrating...');
            storedNotes = localRes.user_notes;
            await window.idb.set('user_notes', storedNotes);
            // We keep chrome.storage.local for a while as fallback, or delete later
        }
    }

    if (!storedNotes) storedNotes = [];

    // Support legacy notes without folderId - normalize
    let needsSave = false;
    storedNotes.forEach(n => {
        if (n.folderId === undefined) {
            n.folderId = null;
            needsSave = true;
        }
    });

    window.notes = storedNotes;
    console.log(`[notes-data] Loaded ${window.notes.length} notes.`);

    if (needsSave) {
        await window.saveNotes();
    }

    if (typeof renderNotesList === 'function') {
        renderNotesList();
    }
};

// ==========================================
// 笔记数据保存 (IndexedDB)
// ==========================================
window.saveNotes = async function () {
    if (!window.notes) return;
    console.log('[notes-data] Saving notes to IndexedDB...');
    await window.idb.set('user_notes', window.notes);
};

console.log('[notes-data.js] Loaded with IndexedDB support');
