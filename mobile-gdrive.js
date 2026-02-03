/**
 * mobile-gdrive.js - Real Google Drive Sync for PWA
 * Uses Google Identity Services (GIS) & GAPI
 */

class MobileGDrive {
    constructor() {
        this.CLIENT_ID = localStorage.getItem('gdrive_client_id') || '';
        this.API_KEY = localStorage.getItem('gdrive_api_key') || '';
        this.DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
        this.SCOPES = 'https://www.googleapis.com/auth/drive'; // Must be full drive to access Extension's files
        this.tokenClient = null;
        this.gapiInited = false;
        this.gisInited = false;
        this.fileName = 'highlighter_backup.json'; // Ensure this matches Extension

        // Auto-load if credentials exist
        if (this.CLIENT_ID) this.loadScripts();
    }

    loadScripts() {
        if (document.getElementById('gapi-script')) return;

        // Load GAPI
        const script1 = document.createElement('script');
        script1.id = 'gapi-script';
        script1.src = "https://apis.google.com/js/api.js";
        script1.onload = () => {
            gapi.load('client', async () => {
                try {
                    await gapi.client.init({
                        apiKey: this.API_KEY,
                        discoveryDocs: [this.DISCOVERY_DOC],
                    });
                    this.gapiInited = true;
                    console.log('✅ GAPI Configured');
                } catch (e) {
                    console.error('❌ GAPI Init Error:', e);
                    if (e.details && e.details.includes("API Key")) {
                        alert("🔑 Google API Key 无效或配置错误。请检查 API Key 是否正确，以及是否在 Google Cloud 中启用了 'Google Drive API'。");
                    }
                }
            });
        };
        document.body.appendChild(script1);

        // Load GIS
        const script2 = document.createElement('script');
        script2.src = "https://accounts.google.com/gsi/client";
        script2.onload = () => {
            if (this.CLIENT_ID) this.initTokenClient();
            this.gisInited = true;
            console.log('✅ GIS Configured');
        };
        document.body.appendChild(script2);
    }

    initTokenClient() {
        this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: this.CLIENT_ID,
            scope: this.SCOPES,
            callback: '', // defined at request time
        });
    }

    setCredentials(clientId, apiKey) {
        this.CLIENT_ID = clientId;
        this.API_KEY = apiKey;
        localStorage.setItem('gdrive_client_id', clientId);
        localStorage.setItem('gdrive_api_key', apiKey);
        this.loadScripts();
        // If GIS loaded but not inited (because no ID before), init now
        if (window.google && window.google.accounts) this.initTokenClient();
        alert('Credentials Saved! Click Sync again.');
    }

    async handleAuthClick() {
        if (!this.CLIENT_ID) {
            const id = prompt("🔑 Step 1/2: Enter Google Client ID\n(From Google Cloud Console -> OAuth Client -> Web Application):");
            if (!id) return;
            const key = prompt("🔑 Step 2/2: Enter Google API Key:");
            if (id && key) this.setCredentials(id, key);
            return;
        }

        if (!this.tokenClient) {
            alert('Initializing Google Services... please wait 3s and try again.');
            this.loadScripts();
            return;
        }

        return new Promise((resolve, reject) => {
            this.tokenClient.callback = async (resp) => {
                if (resp.error) reject(resp);
                resolve(resp);
            };

            // Request access token
            // For PWA, we usually need to request consent on first use or if expired
            this.tokenClient.requestAccessToken({ prompt: '' });
        });
    }

    async sync() {
        // 1. Diagnostics & Auto-Reload
        if (typeof gapi === 'undefined' || typeof google === 'undefined') {
            console.log('🔄 Google scripts missing, attempting re-injection...');
            this.loadScripts();

            // Wait up to 5s for slow VPN
            const start = Date.now();
            while (Date.now() - start < 5000) {
                if (typeof gapi !== 'undefined' && typeof google !== 'undefined') break;
                await new Promise(r => setTimeout(r, 500));
            }

            if (typeof gapi === 'undefined' || typeof google === 'undefined') {
                const msg = "🆘 Google Drive 同步受阻\n\n即使开启了VPN，您的浏览器仍然无法从 Google 服务器下载必要的插件(gapi)。\n\n解决办法：\n1. 请检查 VPN 是否为“全局代理”。\n2. 确保在 Safari 或 Chrome 中打开，不要在微信里点开。\n3. 点击确定后，我会尝试重新加载页面。";
                alert(msg);
                location.reload();
                return;
            }
        }

        if (!this.CLIENT_ID) return this.handleAuthClick();

        // 2. Timeout for Auth Flow
        const timeoutError = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Sync Timeout: Auth window blocked or network too slow.")), 20000)
        );

        try {
            // Show Loading UI
            const toast = document.createElement('div');
            toast.id = 'sync-toast';
            toast.innerHTML = '<div style="margin-bottom:10px;">🔄 Communicating with Google...</div><small style="opacity:0.7;">Make sure VPN is active</small>';
            toast.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);padding:25px;background:rgba(0,0,0,0.9);color:white;border-radius:15px;z-index:9999;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,0.3);';
            document.body.appendChild(toast);

            // Wait for Auth to complete
            await Promise.race([this.handleAuthClick(), timeoutError]);

            if (!gapi.client || !gapi.client.drive) {
                // Try one-time re-init if gapi is there but client isn't
                await gapi.client.init({
                    apiKey: this.API_KEY,
                    discoveryDocs: [this.DISCOVERY_DOC],
                });
            }

            // 3. Search for Backup File
            const response = await gapi.client.drive.files.list({
                'q': `name = '${this.fileName}' and trashed = false`,
                'pageSize': 1,
                'fields': "files(id, name)",
            });

            const files = response.result.files;
            const fileId = (files && files.length > 0) ? files[0].id : null;

            // 4. Download and Merge
            let cloudData = {};
            if (fileId) {
                const fileRes = await gapi.client.drive.files.get({
                    fileId: fileId,
                    alt: 'media'
                });
                cloudData = typeof fileRes.result === 'string' ? JSON.parse(fileRes.result) : fileRes.result;
            }

            let localData = await window.appStorage.getAll();
            const merged = { ...cloudData, ...localData };

            // 5. Save Locally
            await window.appStorage.clear();
            await window.appStorage.set(merged);

            // 6. Upload back to Cloud
            const fileContent = JSON.stringify(merged);
            const metadata = { name: this.fileName, mimeType: 'application/json' };
            const accessToken = gapi.client.getToken().access_token;

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', new Blob([fileContent], { type: 'application/json' }));

            let method = 'POST';
            let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
            if (fileId) {
                method = 'PATCH';
                url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
            }

            await fetch(url, {
                method: method,
                headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
                body: form
            });

            if (toast) toast.remove();
            alert(`✅ Success! Sync complete (${Object.keys(merged).length} items merged).`);
            location.reload();

        } catch (err) {
            console.error('Detailed Sync Error:', err);
            if (document.getElementById('sync-toast')) document.getElementById('sync-toast').remove();

            let errMsg = err.message || "Unknown error";
            if (errMsg.includes("gapi is not defined")) errMsg = "Google scripts failed to load. Use a VPN.";

            alert('Sync Interrupted: ' + errMsg);
        }
    }
}

window.mobileGDrive = new MobileGDrive();
