/**
 * mobile-core.js - View Navigation Controller (V4.0 Architecture)
 */

class MobileApp {
    constructor() {
        this.tabBar = document.getElementById('main-tab-bar');

        // Main Tab Views
        this.mainViews = {
            home: document.getElementById('view-home'),
            search: document.getElementById('view-search'),
            reader: document.getElementById('view-reader'),
            notes: document.getElementById('view-notes')
        };

        // Full Screen Sub Views (Overlays)
        this.subViews = {
            chat: document.getElementById('view-chat-detail'),
            editor: document.getElementById('view-editor'),
            'reader-detail': document.getElementById('view-reader-detail')
        };

        this.setupTabNavigation();

        // Set initial state
        this.activeTab = 'home';

        this.setupGlobalEvents();
    }

    setupGlobalEvents() {
        // User Avatar Click -> Show Action Sheet
        const userBtns = document.querySelectorAll('.user-btn');
        const sheetOverlay = document.getElementById('action-sheet-overlay');
        const cancelBtn = document.getElementById('act-cancel');
        const syncBtn = document.getElementById('act-sync');
        const aiBtn = document.getElementById('act-ai');

        const closeSheet = () => {
            if (sheetOverlay) sheetOverlay.classList.add('hidden');
        };

        const openSheet = () => {
            if (sheetOverlay) sheetOverlay.classList.remove('hidden');
        };

        userBtns.forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                openSheet();
            };
        });

        if (cancelBtn) cancelBtn.onclick = closeSheet;

        if (sheetOverlay) {
            sheetOverlay.onclick = (e) => {
                if (e.target === sheetOverlay) closeSheet();
            };
        }

        // Action: Sync
        if (syncBtn) {
            syncBtn.onclick = () => {
                closeSheet();
                // Show a simple toast simulation
                const tempToast = document.createElement('div');
                tempToast.style.cssText = `
                    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                    background: rgba(0,0,0,0.8); color: white; padding: 20px; border-radius: 12px;
                    z-index: 3000; text-align: center; font-size: 16px; min-width: 150px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3); backdrop-filter: blur(10px);
                `;
                tempToast.innerHTML = `
                    <div class="spin-anim" style="width:30px; height:30px; border:3px solid #fff; border-top:3px solid transparent; border-radius:50%; margin:0 auto 10px;"></div>
                    <div>Syncing...</div>
                `;
                document.body.appendChild(tempToast);

                setTimeout(() => {
                    tempToast.innerHTML = '<div style="font-size:30px; margin-bottom:10px;">✅</div><div>Sync Complete!</div>';
                    setTimeout(() => tempToast.remove(), 1500);
                }, 1500);
            };
        }

        // Action: AI Settings
        if (aiBtn) {
            aiBtn.onclick = () => {
                closeSheet();
                // Add short delay for animation
                setTimeout(async () => {
                    const currentKey = window.aiCore?.config?.apiKey || '';
                    const newKey = prompt('⚙️ [AI Settings]\nEnter DeepSeek/Gemini API Key:', currentKey);

                    if (newKey !== null) {
                        if (window.appStorage) {
                            await window.appStorage.set({ 'ai_api_key': newKey.trim() });
                            if (window.aiCore) await window.aiCore.init();
                            alert('✅ API Key Saved!');
                        } else {
                            alert('❌ Storage not accessible');
                        }
                    }
                }, 200);
            };
        }
    }

    setupTabNavigation() {
        if (!this.tabBar) return;

        const tabs = this.tabBar.querySelectorAll('.tab-btn');
        tabs.forEach(tab => {
            tab.onclick = (e) => {
                // Find closest button if click is on icon/text
                const btn = e.target.closest('.tab-btn');
                if (!btn) return;

                // Get target view ID from data-target="view-home" -> "home"
                const targetId = btn.dataset.target.replace('view-', '');
                this.switchTab(targetId);
            };
        });
    }

    // Switch between main tabs (Home, Search, Reader, Notes)
    switchTab(tabName) {
        // 1. Update Views
        Object.entries(this.mainViews).forEach(([name, el]) => {
            if (el) {
                if (name === tabName) el.classList.add('active');
                else el.classList.remove('active');
            }
        });

        // 2. Update Tab Bar Buttons
        if (this.tabBar) {
            const tabs = this.tabBar.querySelectorAll('.tab-btn');
            tabs.forEach(tab => {
                const target = tab.dataset.target.replace('view-', '');
                if (target === tabName) tab.classList.add('active');
                else tab.classList.remove('active');
            });
        }

        this.activeTab = tabName;
    }

    // Navigate to a sub-view (Full screen overlay)
    navigateTo(viewName) {
        const view = this.subViews[viewName];
        if (view) {
            view.classList.add('active'); // CSS should handle z-index/display
            view.style.display = 'flex'; // Ensure flex layout
        }
    }

    // Go back (Close current sub-view)
    goBack() {
        // Find visible sub-views and hide them
        Object.values(this.subViews).forEach(view => {
            if (view && view.style.display !== 'none') {
                view.classList.remove('active');
                view.style.display = 'none';
            }
        });
    }
}

// Initialize and Expose Globally
document.addEventListener('DOMContentLoaded', () => {
    window.mobileCore = new MobileApp();
    console.log('MobileCore Initialized');
});
