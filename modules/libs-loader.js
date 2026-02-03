/**
 * libs-loader.js - 第三方库动态加载
 * 包含: loadXLSX, loadJSZip, loadMammoth, loadTesseract
 */

// ==========================================
// 动态库加载器
// ==========================================

/**
 * [New] Load SheetJS for Excel support
 */
const loadXLSX = async () => {
    if (globalThis.XLSX) return globalThis.XLSX;
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '../lib/xlsx.full.min.js';
        script.onload = () => resolve(globalThis.XLSX);
        script.onerror = () => reject(new Error('Failed to load xlsx.full.min.js'));
        document.head.appendChild(script);
    });
};

/**
 * Load JSZip for ZIP file support
 */
const loadJSZip = async () => {
    if (globalThis.JSZip) return globalThis.JSZip;
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '../lib/jszip.min.js';
        script.onload = () => resolve(globalThis.JSZip);
        script.onerror = () => reject(new Error('Failed to load jszip.min.js'));
        document.head.appendChild(script);
    });
};

/**
 * Load Mammoth for Word document support
 */
const loadMammoth = async () => {
    if (globalThis.mammoth) return globalThis.mammoth;
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '../lib/mammoth.browser.min.js';
        script.onload = () => resolve(globalThis.mammoth);
        script.onerror = () => reject(new Error('Failed to load mammoth.browser.min.js'));
        document.head.appendChild(script);
    });
};

/**
 * Load Tesseract for OCR support
 */
const loadTesseract = async () => {
    if (globalThis.Tesseract) return globalThis.Tesseract;
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = '../tesseract.min.js';
        script.onload = () => resolve(globalThis.Tesseract);
        script.onerror = () => reject(new Error('Failed to load tesseract.min.js'));
        document.head.appendChild(script);
    });
};

// Export to global scope
window.loadXLSX = loadXLSX;
window.loadJSZip = loadJSZip;
window.loadMammoth = loadMammoth;
window.loadTesseract = loadTesseract;

console.log('[libs-loader.js] Loaded: loadXLSX, loadJSZip, loadMammoth, loadTesseract');
