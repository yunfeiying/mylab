/**
 * mobile-sync.js - Simplified Sync (File & WebDAV)
 */

window.mobileSync = {
    // ============================
    // 1. 文件备份 (最稳妥)
    // ============================
    async exportBackup() {
        try {
            let data = {};
            if (window.appStorage && window.appStorage.getAll) {
                data = await window.appStorage.getAll();
            } else {
                data = { ...localStorage };
            }
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `highlighti_mobile_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            return true;
        } catch (e) {
            alert('Export Error: ' + e.message);
            return false;
        }
    },

    async importBackup(file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (confirm(`Restore ${Object.keys(data).length} notes? This overwrites current data.`)) {
                    if (window.appStorage) {
                        await window.appStorage.clear();
                        await window.appStorage.set(data);
                    } else {
                        localStorage.clear();
                        Object.keys(data).forEach(k => localStorage.setItem(k, data[k]));
                    }
                    alert('✅ Restored!');
                    location.reload();
                }
            } catch (err) {
                alert('Invalid File');
            }
        };
        reader.readAsText(file);
    },

    // ============================
    // 2. WebDAV 同步 (简单模式)
    // ============================
    async webDavSync() {
        // 1. Get Credentials
        const url = localStorage.getItem('webdav_url');
        const user = localStorage.getItem('webdav_user');
        const pass = localStorage.getItem('webdav_pass');

        if (!url || !user || !pass) {
            this.promptWebDavConfig();
            return;
        }

        const fileName = 'highlighter_mobile.json';
        const fullUrl = url.endsWith('/') ? url + fileName : url + '/' + fileName;
        const headers = {
            'Authorization': 'Basic ' + btoa(user + ':' + pass),
            'Content-Type': 'application/json'
        };

        window.showToast?.('☁️ Connecting WebDAV...');

        try {
            // A. PULL (Get latest from cloud)
            try {
                const res = await fetch(fullUrl, { method: 'GET', headers: headers });
                if (res.ok) {
                    const cloudData = await res.json();
                    // Merge Strategy: Simple overwrite or keep local?
                    // For simplicity: Merge keys
                    const localData = window.appStorage ? await window.appStorage.getAll() : { ...localStorage };
                    const merged = { ...cloudData, ...localData }; // Local changes win collision for now to avoid loss

                    if (window.appStorage) await window.appStorage.set(merged);
                    console.log('✅ Pulled from Cloud');
                } else if (res.status !== 404) {
                    throw new Error(`Download Failed: ${res.status}`);
                }
            } catch (e) {
                console.warn('Pull skipped or failed:', e);
            }

            // B. PUSH (Upload merged)
            const finalData = window.appStorage ? await window.appStorage.getAll() : { ...localStorage };
            const upRes = await fetch(fullUrl, {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify(finalData)
            });

            if (upRes.ok || upRes.status === 201 || upRes.status === 204) {
                alert('✅ Sync Success!');
                location.reload();
            } else {
                throw new Error(`Upload Failed: ${upRes.status} (CORS/Auth?)`);
            }

        } catch (err) {
            console.error(err);
            if (err.message.includes('Faied to fetch') || err.name === 'TypeError') {
                alert('❌ Sync Failed: Network or CORS Error.\nMost commercial WebDAVs block browser requests.\nUse "Export Backup" instead.');
            } else {
                alert('❌ Sync Failed: ' + err.message);
            }
        }
    },

    promptWebDavConfig() {
        const url = prompt("WebDAV URL (e.g. https://dav.box.com/dav):", localStorage.getItem('webdav_url') || "");
        if (!url) return;
        const user = prompt("Username:", localStorage.getItem('webdav_user') || "");
        const pass = prompt("Password:", localStorage.getItem('webdav_pass') || "");

        if (url && user && pass) {
            localStorage.setItem('webdav_url', url);
            localStorage.setItem('webdav_user', user);
            localStorage.setItem('webdav_pass', pass);
            this.webDavSync();
        }
    }
};
