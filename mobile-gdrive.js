/**
 * mobile-gdrive.js - Real Google Drive Sync for PWA
 * Uses Google Identity Services (GIS) & GAPI
 */

class MobileGDrive {
    constructor() {
        this.CLIENT_ID = localStorage.getItem('gdrive_client_id') || '';
        this.API_KEY = localStorage.getItem('gdrive_api_key') || '';
        this.DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
        this.SCOPES = 'https://www.googleapis.com/auth/drive.file';
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
                await gapi.client.init({
                    apiKey: this.API_KEY,
                    discoveryDocs: [this.DISCOVERY_DOC],
                });
                this.gapiInited = true;
                console.log('✅ GAPI Configured');
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
        if (!this.CLIENT_ID) return this.handleAuthClick();

        // Timeout Promise to prevent infinite loading
        const timeoutError = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout: Login window blocked or closed.\nPlease try syncing in Safari browser first.")), 15000)
        );

        try {
            // Show Loading
            const toast = document.createElement('div');
            toast.id = 'sync-toast';
            toast.innerText = '🔄 Syncing with Google Drive...';
            toast.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);padding:20px;background:rgba(0,0,0,0.8);color:white;border-radius:10px;z-index:9999;transition:opacity 0.3s;';
            document.body.appendChild(toast);

            // Race between Auth and Timeout
            await Promise.race([this.handleAuthClick(), timeoutError]);

            // 1. Search File
            const q = `name = '${this.fileName}' and trashed = false`;
            const response = await gapi.client.drive.files.list({
                'pageSize': 1,
                'fields': "files(id, name)",
            });

            const files = response.result.files;
            const fileId = (files && files.length > 0) ? files[0].id : null;

            // 2. Download Cloud Data
            let cloudData = {};
            if (fileId) {
                const fileRes = await gapi.client.drive.files.get({
                    fileId: fileId,
                    alt: 'media'
                });
                cloudData = fileRes.result;
            }

            // 3. Merge (Simple: Cloud wins + Keep Local unique)
            let localData = {};
            if (window.appStorage && window.appStorage.getAll) {
                localData = await window.appStorage.getAll();
            } else {
                localData = { ...localStorage };
            }

            const merged = { ...cloudData, ...localData };

            // Save to Local
            if (window.appStorage) {
                await window.appStorage.clear();
                await window.appStorage.set(merged);
            } else {
                localStorage.clear();
                Object.keys(merged).forEach(k => localStorage.setItem(k, merged[k]));
            }

            // 4. Upload Merged Back
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

            document.body.removeChild(toast);
            alert(`✅ Google Drive Sync Complete!\nMerged ${Object.keys(merged).length} items.`);
            location.reload();

        } catch (err) {
            console.error(err);
            const t = document.getElementById('sync-toast');
            if (t) t.remove();
            alert('Sync Failed: ' + (err.message || JSON.stringify(err)));
        }
    }
}

window.mobileGDrive = new MobileGDrive();
