/**
 * i18n-utils.js - 多语言工具
 * 包含: getI18nMsg, loadUserLanguage, window.CURRENT_LOCALE_MESSAGES
 */

// ==========================================
// 多语言支持
// ==========================================

/**
 * [辅助] 能够感知手动语言设置的 i18n 函数
 */
function getI18nMsg(key, substitutions) {
    if (window.CURRENT_LOCALE_MESSAGES && window.CURRENT_LOCALE_MESSAGES[key]) {
        let msg = window.CURRENT_LOCALE_MESSAGES[key].message;
        if (substitutions) {
            if (!Array.isArray(substitutions)) substitutions = [substitutions];
            substitutions.forEach((sub, index) => {
                msg = msg.replace(`$${index + 1}`, sub);
            });
        }
        if (substitutions && msg.includes('$COUNT$')) {
            msg = msg.replace('$COUNT$', substitutions[0]);
        }
        // [新增] 修复试用期天数显示问题
        if (substitutions && msg.includes('$DAYS$')) {
            msg = msg.replace('$DAYS$', substitutions[0]);
        }
        return msg;
    }

    // 如果是原生 Chrome i18n 调用，且返回的字符串里包含 $DAYS$，也尝试手动替换一下（防止原生替换失败）
    let nativeMsg = chrome.i18n.getMessage(key, substitutions);
    if (nativeMsg && substitutions && nativeMsg.includes('$DAYS$')) {
        nativeMsg = nativeMsg.replace('$DAYS$', substitutions[0]);
    }
    return nativeMsg;
}

/**
 * [新增] 加载用户手动设置的语言包
 */
async function loadUserLanguage() {
    const res = await chrome.storage.local.get('app_language');
    const lang = res.app_language;

    if (lang && lang !== 'auto') {
        // Attempt to load the specified language pack
        try {
            const response = await fetch(chrome.runtime.getURL(`_locales/${lang}/messages.json`));
            if (response.ok) {
                window.CURRENT_LOCALE_MESSAGES = await response.json();
                console.log(`[i18n] Loaded language: ${lang}`);
            } else {
                console.warn(`[i18n] Failed to load language pack: ${lang}`);
            }
        } catch (e) {
            console.error('[i18n] Error loading language pack:', e);
        }
    } else {
        // Use browser default
        window.CURRENT_LOCALE_MESSAGES = null;
    }
}

// Export to global scope
window.getI18nMsg = getI18nMsg;
window.loadUserLanguage = loadUserLanguage;

console.log('[i18n-utils.js] Loaded: getI18nMsg, loadUserLanguage');
