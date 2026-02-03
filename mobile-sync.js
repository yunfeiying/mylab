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
                // 1. Parse JSON
                const data = JSON.parse(e.target.result);
                const keys = Object.keys(data);

                if (keys.length === 0) {
                    alert('❌ File is empty!');
                    return;
                }

                if (!confirm(`Found ${keys.length} items. Overwrite current data and import?`)) return;

                // 2. Clear Old Data
                if (window.appStorage) {
                    await window.appStorage.clear();

                    // 3. Write New Data
                    await window.appStorage.set(data);

                    // 4. Verify Write
                    const verify = await window.appStorage.getAll();
                    const count = Object.keys(verify).length;

                    if (count === 0) {
                        alert('CRITICAL ERROR: Database is empty after write! Import failed.');
                    } else {
                        alert(`🎉 Success! Verified ${count} items. Reloading automatically...`);
                        setTimeout(() => location.reload(), 2000);
                    }
                } else {
                    alert('❌ Error: storage-bridge (window.appStorage) is missing!');
                }
            } catch (err) {
                alert('❌ Import Crashed:\n' + err.message);
                console.error(err);
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
        const proxy = localStorage.getItem('webdav_proxy') || ''; // Optional CORS Proxy

        if (!url || !user || !pass) {
            this.promptWebDavConfig();
            return;
        }

        const fileName = 'highlighter_mobile.json';
        const rawFullUrl = url.endsWith('/') ? url + fileName : url + '/' + fileName;
        // Use proxy if provided
        const fullUrl = proxy ? proxy + encodeURIComponent(rawFullUrl) : rawFullUrl;

        const headers = {
            'Authorization': 'Basic ' + btoa(user + ':' + pass),
            'Content-Type': 'application/json'
        };

        const showToast = (msg) => {
            const t = document.createElement('div');
            t.className = 'sync-toast';
            t.innerText = msg;
            t.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);padding:12px 24px;background:#333;color:white;border-radius:25px;z-index:10000;font-size:14px;';
            document.body.appendChild(t);
            setTimeout(() => t.remove(), 3000);
        };

        showToast('☁️ Connecting WebDAV...');

        try {
            // A. PULL
            const res = await fetch(fullUrl, { method: 'GET', headers: headers });
            let cloudData = {};

            if (res.ok) {
                cloudData = await res.json();
                console.log('✅ Cloud data fetched');
            } else if (res.status === 404) {
                console.log('ℹ️ New file will be created');
            } else {
                throw new Error(`Connection Error: ${res.status}`);
            }

            // B. MERGE
            const localData = window.appStorage ? await window.appStorage.getAll() : { ...localStorage };
            const merged = { ...cloudData, ...localData };

            // C. PUSH
            const upRes = await fetch(fullUrl, {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify(merged)
            });

            if (upRes.ok || upRes.status === 201 || upRes.status === 204) {
                if (window.appStorage) await window.appStorage.set(merged);
                alert('✅ Sync Success! Verified with ' + Object.keys(merged).length + ' items.');
                location.reload();
            } else {
                throw new Error(`Upload Failed: ${upRes.status}`);
            }

        } catch (err) {
            console.error('WebDAV Error:', err);
            let msg = err.message;
            if (err.name === 'TypeError' || msg.includes('fetch')) {
                msg = "CORS Blocked.\nBrowsers (Safari/Chrome) block direct WebDAV access for security.\n\nFIX:\n1. Use a CORS Proxy in settings.\n2. Or Use IPA/Native version (No CORS).";
            }
            alert('❌ WebDAV Failure:\n' + msg);
        }
    },

    promptWebDavConfig() {
        const url = prompt("Step 1/4: WebDAV Server URL\n(e.g. https://dav.jianguoyun.com/dav/):", localStorage.getItem('webdav_url') || "");
        if (!url) return;
        const user = prompt("Step 2/4: Username / Email:", localStorage.getItem('webdav_user') || "");
        const pass = prompt("Step 3/4: App Password:", localStorage.getItem('webdav_pass') || "");
        const proxy = prompt("Step 4/4: [Optional] CORS Proxy URL:\n(Leave empty to skip. Used to bypass browser security):", localStorage.getItem('webdav_proxy') || "");

        localStorage.setItem('webdav_url', url);
        localStorage.setItem('webdav_user', user);
        localStorage.setItem('webdav_pass', pass);
        localStorage.setItem('webdav_proxy', proxy);

        this.webDavSync();
    }
};
