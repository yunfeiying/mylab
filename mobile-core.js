/**
 * mobile-core.js - The Brain of Mobile App (V11.6)
 */


/**
 * VisualContentExtractor - V1.0
 * Specialized PureJS heuristic engine to identify article "focal points"
 */
class VisualContentExtractor {
    static extract(doc) {
        let highestScore = -1;
        let bestNode = null;

        // 1. Candidate selection - focus on structural containers
        const candidates = doc.querySelectorAll('div, article, section, main');

        candidates.forEach(node => {
            const text = node.innerText.trim();
            if (text.length < 100) return;

            const linkCount = node.querySelectorAll('a').length;
            const textDensity = text.length / (linkCount + 1);

            // Critical Signal: High density of punctuation indicates narrative content
            const punctuationMatches = text.match(/[，。？！,.?!:：]/g) || [];
            const puncDensity = (punctuationMatches.length / Math.max(text.length, 1)) * 100;

            // Structural weight
            let weight = 0;
            const identity = (node.className + ' ' + node.id).toLowerCase();

            // Positive signals
            if (identity.match(/article|content|body|main|post|topic|detail/)) weight += 50;
            if (identity.match(/entry-content|article-view|article-content/)) weight += 100;

            // Negative signals (Sidebars, comments, etc)
            if (identity.match(/comment|sidebar|footer|nav|recommend|ad-|share|related|menu/)) weight -= 80;

            // Score calculation
            const score = (text.length * 0.1) + (textDensity * 1.5) + (puncDensity * 50) + weight;

            if (score > highestScore) {
                highestScore = score;
                bestNode = node;
            }
        });

        return bestNode || doc.body;
    }

    static clean(node) {
        if (!node) return;
        const junkSelectors = [
            'script', 'style', 'iframe', 'canvas', 'video', 'audio', 'svg',
            'footer', 'nav', 'header', 'aside',
            '.ad', '.ads', '.share', '.social', '.comment', '.recommend',
            '.baidu-logo', '.open-app', '.app-open-btn', '.s-f-header', '.s-f-footer',
            '[class*="ad-"]', '[class*="share-"]', '[class*="footer"]',
            '.index-module_header', '.index-module_footer', '.tag-box', '.hot-news-box'
        ];
        node.querySelectorAll(junkSelectors.join(',')).forEach(el => el.remove());

        // Remove mostly-link small blocks and empty spacers
        node.querySelectorAll('div, section, ul, p').forEach(el => {
            const hasText = el.innerText.trim().length > 0;
            const hasImg = el.querySelector('img');

            // Remove blocks that are mostly links and have very little text
            if (!hasText && !hasImg) {
                el.remove();
                return;
            }

            if (el.innerText.trim().length < 50 && el.querySelectorAll('a').length > 2 && !hasImg) {
                el.remove();
            }
        });
        return node;
    }
}

class MobileApp {
    constructor() {
        this.homeView = document.getElementById('view-home');
        this.chatView = document.getElementById('view-chat');
        this.editorView = document.getElementById('view-editor');
        this.globalSearch = document.getElementById('global-search');

        this.searchQuery = '';
        this.activeView = 'rss';
        this.dataMap = new Map();
        this.dataCache = null; // Performance: Persistent cache for lists
        this.cacheDirty = true; // Flag for re-fetch

        this.setupKeyboardTracking();
        this.setupEvents();
        this.setupSwipeToDelete();
        this.setupSwipeToBack();
        this.setupVoiceListeners();

        // Initialize external modules if available
        if (window.initMobileBrowser) window.initMobileBrowser(this);
        if (window.initRSSService) {
            window.initRSSService().then(() => {
                console.log('[App] RSS Service initialized, rendering headlines...');
            });
        }
        this.setupDataManagement();

        // Default: Start at RSS View
        this.navigateTo('rss');

        // Helper: Time Format
        window.formatRelativeTime = (date) => {
            if (!date) return '';
            const now = new Date();
            const past = new Date(date);
            const diff = Math.floor((now - past) / 1000);
            if (diff < 60) return '刚刚';
            if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
            if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
            if (diff < 2592000) return `${Math.floor(diff / 86400)}天前`;
            return past.toLocaleDateString();
        };

        console.log('MobileCore V11.6 (Modular) Initialized');
    }

    setupSwipeToBack() {
        const area = document.querySelector('.reader-scroll-area');
        if (!area) return;

        let startX = 0;
        let startY = 0;

        area.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        }, { passive: true });

        area.addEventListener('touchend', (e) => {
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const diffX = endX - startX;
            const diffY = Math.abs(endY - startY);

            // Threshold: swipe right > 100px and vertical movement < 50px
            if (diffX > 100 && diffY < 50) {
                console.log('[Gesture] Swipe to back detected');
                if (this.activeView === 'reader-detail') {
                    // Navigate back to the previous context
                    const fromRSS = area.dataset.fromContext === 'rss';
                    if (fromRSS) this.navigateTo('rss-feed');
                    else this.navigateTo('home');
                }
            }
        }, { passive: true });
    }

    // Robust date parser to prevent NaN display
    safeParseToNumber(val) {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        // Handle ISO strings, date strings, or numeric strings
        const parsed = new Date(val).getTime();
        return isNaN(parsed) ? 0 : parsed;
    }

    setupKeyboardTracking() {
        // Disabled manually tracking keyboard to prevent layout jumps.
        // Let the native browser behavior handle scrolling.
        /*
        if (window.visualViewport) {
            const updateOffset = () => {
                const offset = window.innerHeight - window.visualViewport.height;
                const finalOffset = offset > 50 ? offset : 0;
                document.documentElement.style.setProperty('--keyboard-offset', `${finalOffset}px`);

                if (finalOffset > 0) {
                    document.body.classList.add('keyboard-visible');
                } else {
                    document.body.classList.remove('keyboard-visible');
                }
            };
            window.visualViewport.addEventListener('resize', updateOffset);
            window.visualViewport.addEventListener('scroll', updateOffset);
        }
        */
    }

    triggerUniversalSend(inputElOrText) {
        let text = '';
        let actualInput = null;

        if (typeof inputElOrText === 'string') {
            text = inputElOrText.trim();
            actualInput = document.getElementById('global-input');
        } else {
            actualInput = inputElOrText;
            if (!inputElOrText || actualInput.tagName !== 'INPUT') {
                actualInput = document.getElementById('global-input');
            }
            text = actualInput ? (actualInput.value || '').trim() : '';
        }

        if (!text) return; // Prevent empty sends

        console.log('[Core] Triggering send:', text.substring(0, 30) + '...');
        if (typeof window.showToast === 'function' && text.length > 50) {
            // Optional: feedback for long voice inputs
        }

        // Auto-exit voice mode
        if (this.isVoiceMode) this.toggleVoiceMode();

        if (window.mobileChat) {
            // Ensure we are in the Assistant (Home) view
            if (this.activeView !== 'home') {
                this.navigateTo('home');
            }

            // Call the chat module's send logic
            window.mobileChat.handleExternalSend(text);

            // Clear input with a safer delay to ensure the text was read
            setTimeout(() => {
                actualInput.value = '';
                if (typeof updateDockState === 'function') updateDockState();
                else {
                    // Fallback: manually trigger icons if updateDockState is closure-scoped
                    const iconMic = document.getElementById('icon-dock-mic');
                    const iconSend = document.getElementById('icon-dock-send');
                    if (iconMic) iconMic.classList.remove('hidden');
                    if (iconSend) iconSend.classList.add('hidden');
                }
            }, 50);

            actualInput.blur(); // Dismiss keyboard
        } else {
            console.warn('[Core] MobileChat module not ready yet.');
        }
    }

    navigateToChat() {
        this.navigateTo('home');
        if (window.mobileChat) {
            if (window.mobileChat.currentSessionId) {
                window.mobileChat.renderCurrentChat();
            } else {
                window.mobileChat.startNewChat();
            }
            const globalInput = document.getElementById('global-input');
            if (globalInput && !this.isVoiceMode) {
                setTimeout(() => globalInput.focus(), 200);
            }
        }
    }

    showActionSheet(context = 'home') {
        const sheet = document.getElementById('action-sheet-overlay');
        const saveBtn = document.getElementById('act-save-note');
        const syncBtn = document.getElementById('act-sync');

        if (context === 'home') {
            if (saveBtn) saveBtn.classList.add('hidden');
            if (syncBtn) syncBtn.classList.remove('hidden');
        } else {
            if (saveBtn) saveBtn.classList.remove('hidden');
            if (syncBtn) syncBtn.classList.add('hidden');
        }
        if (sheet) sheet.classList.remove('hidden');
    }

    setupEvents() {
        // Sidebar Toggle
        const sideBtn = document.getElementById('btn-sidebar-toggle');
        if (sideBtn) {
            sideBtn.onclick = () => {
                alert('Quick Actions Menu coming soon');
            };
        }

        // Settings Button
        const setBtn = document.getElementById('btn-settings');
        const sheet = document.getElementById('action-sheet-overlay');
        const cancelBtn = document.getElementById('act-cancel');

        if (setBtn) {
            const openSettings = (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[UI] Opening Settings Action Sheet');
                this.showActionSheet('home');
            };
            setBtn.addEventListener('click', openSettings);
            setBtn.addEventListener('touchstart', openSettings, { passive: false });
        }
        if (cancelBtn) cancelBtn.onclick = () => sheet.classList.add('hidden');
        if (sheet) sheet.onclick = (e) => { if (e.target === sheet) sheet.classList.add('hidden'); };

        // Global Navigation Tabs (V12.0 Redesign)
        const tabs = {
            'nav-tab-home': 'home',
            'nav-tab-notes': 'notes',
            'nav-tab-reader': 'reader',
            'nav-tab-rss': 'rss',
            'nav-tab-settings': 'settings'
        };

        Object.entries(tabs).forEach(([id, view]) => {
            const el = document.getElementById(id);
            if (el) {
                el.onclick = () => {
                    this.navigateTo(view);
                };
            }
        });

        const syncBtn = document.getElementById('act-sync');
        if (syncBtn) {
            syncBtn.onclick = () => {
                const sheet = document.getElementById('action-sheet-overlay');
                if (sheet) sheet.classList.add('hidden');
                if (window.mobileGDrive) {
                    window.mobileGDrive.sync();
                } else {
                    alert('Google Drive module not loaded.');
                }
            };
        }

        const syncWebdavBtn = document.getElementById('act-sync-webdav');
        if (syncWebdavBtn) {
            syncWebdavBtn.onclick = () => {
                const sheet = document.getElementById('action-sheet-overlay');
                if (sheet) sheet.classList.add('hidden');
                if (window.mobileSync && window.mobileSync.webDavSync) {
                    window.mobileSync.webDavSync();
                } else {
                    alert('WebDAV module not loaded.');
                }
            };
        }

        const saveBtn = document.getElementById('act-save-note');
        if (saveBtn) {
            saveBtn.onclick = () => {
                const sheet = document.getElementById('action-sheet-overlay');
                if (sheet) sheet.classList.add('hidden');
                if (window.mobileEditor) window.mobileEditor.saveNote();
            };
        }

        // --- Attachment Action Sheet Logic ---
        this.setupAttachmentSheet();

        // Headers
        const notesHeader = document.getElementById('header-notes-all');
        if (notesHeader) notesHeader.onclick = () => this.navigateTo('notes');

        const readingHeader = document.getElementById('header-reading-all');
        if (readingHeader) readingHeader.onclick = () => this.navigateTo('reader');

        const rssHeader = document.getElementById('header-rss-all');
        if (rssHeader) rssHeader.onclick = () => this.navigateTo('rss');

        // RSS Settings Button
        const rssSettingsBtn = document.getElementById('btn-rss-settings');
        if (rssSettingsBtn) {
            rssSettingsBtn.onclick = () => this.navigateTo('settings');
        }

        // New Note Button
        const notesNewBtn = document.getElementById('btn-notes-new');
        if (notesNewBtn) {
            notesNewBtn.onclick = () => {
                if (window.mobileEditor) window.mobileEditor.initNewNote();
            };
        }

        // Consolidated Back logic for specific views
        document.querySelectorAll('.btn-home-back-to-rss').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                this.navigateTo('rss');
            };
        });

        document.querySelectorAll('.btn-back-to-rss-all').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                this.navigateTo('rss');
            };
        });

        document.querySelectorAll('.btn-back-to-reader').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                const scrollArea = document.querySelector('.reader-scroll-area');
                const fromRSS = (scrollArea && scrollArea.dataset.fromContext === 'rss') || this.returnToRSS;

                if (fromRSS) {
                    this.navigateTo('rss');
                    this.returnToRSS = false;
                } else {
                    // Default behavior: return to Reader tab list
                    this.navigateTo('reader');
                }
            };
        });

        document.querySelectorAll('.btn-go-home').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                if (this.isVoiceMode) this.toggleVoiceMode();
                this.navigateTo('home');
            };
        });

        // Note Editor Back Button - Responsive Navigation (Navigate First, Save Later)
        document.querySelectorAll('.btn-back-to-notes').forEach(btn => {
            // Use onclick to prevent multiple bindings if this function is re-run
            btn.onclick = (e) => {
                e.preventDefault();
                console.log('[Back] Instant navigation to notes');

                // 1. Navigate Immediately
                this.navigateTo('notes');

                // 2. Save in Background coverage
                if (window.mobileEditor) {
                    window.mobileEditor.saveNote(true).catch(e => console.warn('Background save warning:', e));
                }
            };
        });

        // --- Global Core Hub: Input & Dynamic Action Button ---
        const globalInput = document.getElementById('global-input');
        const dockActionBtn = document.getElementById('btn-dock-action');
        const iconMic = document.getElementById('icon-dock-mic');
        const iconSend = document.getElementById('icon-dock-send');
        const globalAddBtn = document.getElementById('btn-global-add'); // Keep this for toggleVoiceMode

        // Ensure state is tracked as a class property
        this.isTypingMode = false;

        const updateDockState = () => {
            if (!globalInput || !dockActionBtn) return;
            const hasText = globalInput.value.trim().length > 0;

            if (hasText) {
                // Typing Mode: Show Send, Hide Mic
                this.isTypingMode = true;
                if (iconMic) iconMic.classList.add('hidden');
                if (iconSend) iconSend.classList.remove('hidden');
                dockActionBtn.classList.add('send-active'); // Optional styling
            } else {
                // Voice Mode: Show Mic, Hide Send
                this.isTypingMode = false;
                if (iconMic) iconMic.classList.remove('hidden');
                if (iconSend) iconSend.classList.add('hidden');
                dockActionBtn.classList.remove('send-active');
            }
        };

        if (globalInput) {
            // Check state on load
            updateDockState();

            // auto-navigate to chat logic
            globalInput.onfocus = () => {
                setTimeout(() => {
                    if (!this.isVoiceMode) {
                        const viewsToAutoChat = ['home', 'notes', 'reader', 'reader-detail'];
                        if (viewsToAutoChat.includes(this.activeView)) this.navigateToChat();
                    }
                }, 100);
            };

            globalInput.oninput = (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                // Only render results if NOT in home/assistant view to avoid focus stealing
                if (this.activeView !== 'home' && this.activeView !== 'chat') {
                    this.renderApp();
                }
                updateDockState();
            };

            globalInput.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    // Let triggerUniversalSend handle the logic and clearing
                    this.triggerUniversalSend(globalInput);
                    // Do NOT clear here immediately, or text is lost before send
                    updateDockState();
                }
            };
        }

        // Action Button Logic
        if (dockActionBtn) {
            // Priority: Push-to-Talk (PTT) Behavior
            const startVoice = (e) => {
                if (this.isTypingMode) return;
                if (e.type === 'mousedown' && e.button !== 0) return;

                e.preventDefault();
                if (window.navigator.vibrate) window.navigator.vibrate(20);
                this.isPTTActive = true;
                this.startVoiceRecognition();
            };

            const stopVoice = (e) => {
                if (!this.isPTTActive) return;
                this.isPTTActive = false;
                if (window.navigator.vibrate) window.navigator.vibrate([10, 30]);
                this.stopVoiceRecognition();
            };

            dockActionBtn.addEventListener('touchstart', startVoice, { passive: false });
            dockActionBtn.addEventListener('touchend', stopVoice);
            dockActionBtn.addEventListener('mousedown', startVoice);
            dockActionBtn.addEventListener('mouseup', stopVoice);
            dockActionBtn.addEventListener('mouseleave', stopVoice);

            // Click handler remains for sending text if typing
            dockActionBtn.onclick = (e) => {
                if (this.isTypingMode) {
                    this.triggerUniversalSend(globalInput);
                    setTimeout(() => updateDockState(), 50);
                }
            };
        }

        // --- API & GDrive Settings Dialogs ---
        this.setupSettingsDialogs();

        // --- Swipe Gesture: Chat Hub to Notes ---
        const chatHub = document.getElementById('universal-chat-hub');
        if (chatHub) {
            let startX = 0;
            let startY = 0;
            chatHub.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
            }, { passive: true });

            chatHub.addEventListener('touchend', (e) => {
                const deltaX = e.changedTouches[0].clientX - startX;
                const deltaY = e.changedTouches[0].clientY - startY;

                // Right to Left swipe on the Hub
                if (deltaX < -70 && Math.abs(deltaY) < 40) {
                    console.log('[Gesture] Hub swipe left -> Notes');
                    chatHub.classList.add('hub-shrink-to-circle');

                    // Transition to Notes
                    setTimeout(() => {
                        this.navigateTo('notes');
                        chatHub.classList.remove('hub-shrink-to-circle');
                    }, 400);
                }
            }, { passive: true });
        }
        // Aggressive binding to capture phase if possible, but basic click usually works
        // Use addEventListener to allow multiple listeners (e.g. from other modules)
        document.body.addEventListener('click', (e) => this.onGlobalClick(e));

        // Reader Source Button (Self-Aware Smart Toggle)
        const readerUrlBtn = document.getElementById('btn-reader-open-url');
        if (readerUrlBtn) {
            readerUrlBtn.onclick = () => {
                const url = this.currentReaderUrl;
                if (!url) return;

                // Intelligence: If we already have a snapshot, just show/expand it!
                this.smartToggleSnapshot(url);
            };
        }

        this.setupSwipeNavigation();
    }

    // Consolidated Global Click Handler
    async onGlobalClick(e) {
        const target = e.target;

        // 0. Safety Check
        if (!target) return;

        // 1. Handle Chat Links (URLs) - Priority
        // Use closest to catch clicks on inner elements of the link
        const chatLink = target.closest('.chat-link');
        if (chatLink) {
            e.preventDefault();
            e.stopPropagation(); // Stop bubbling immediately

            const url = chatLink.getAttribute('data-url');
            console.log('[GlobalClick] Link clicked:', url);

            if (url && window.mobileChat) {
                if (window.navigator.vibrate) window.navigator.vibrate(20);
                window.mobileChat.openUrl(url);
            } else {
                console.warn('[GlobalClick] MobileChat not ready or URL missing');
            }
            return;
        }

        // 2. Handle Skill Buttons
        const skillBtn = target.closest('#btn-install-skill');
        if (skillBtn && window.mobileChat) {
            const skillData = skillBtn.dataset.skill;
            if (skillData) window.mobileChat.installSkill(skillData);
            return;
        }

        // 3. Handle Note Cards
        // Important: Check for delete action first to prevent opening note
        const deleteAction = target.closest('.note-delete-action');
        if (deleteAction) {
            const wrapper = target.closest('.note-item-wrapper');
            if (wrapper) {
                const id = wrapper.dataset.id;
                const type = wrapper.dataset.type;

                if (id && confirm('Delete this item permanently?')) {
                    console.log('[Delete] Removing item:', id, 'type:', type);

                    try {
                        if (type === 'note') {
                            const parentKey = wrapper.dataset.parentKey || '';

                            // Strategy 1: Remove from user_notes array
                            const data = await window.appStorage.get('user_notes');
                            let notes = data.user_notes || [];
                            const originalLength = notes.length;
                            notes = notes.filter(n => n.id !== id);
                            if (notes.length !== originalLength) {
                                await window.appStorage.set({ user_notes: notes });
                                console.log('[Delete] Removed from user_notes array:', originalLength, '->', notes.length);
                            }

                            // Strategy 2: Remove standalone IDB key (legacy/individual storage)
                            // The note might exist as its own key in IDB (e.g., "note-1234567890")
                            if (parentKey && parentKey !== 'user_notes') {
                                await window.appStorage.remove(parentKey);
                                console.log('[Delete] Removed standalone key:', parentKey);
                            }

                            // Strategy 3: Also try removing by ID directly (covers all edge cases)
                            if (id !== parentKey) {
                                await window.appStorage.remove(id);
                                console.log('[Delete] Removed by ID key:', id);
                            }
                        } else {
                            // For reader items: Remove individual key
                            await window.appStorage.remove(id);
                        }

                        this.cacheDirty = true; // Mark cache as dirty
                        this.renderApp(true); // Force re-render to update UI
                        if (window.showToast) window.showToast('✓ Deleted', 1500);
                    } catch (e) {
                        console.error('[Delete] Error:', e);
                        if (window.showToast) window.showToast('Delete failed', 1500);
                    }
                }
            }
            return; // Stop further processing if delete action was handled
        }

        // General Card Click (Open Editor/Reader)
        // Check for wrapper first as it holds the data attributes
        const wrapper = target.closest('.note-item-wrapper');
        if (wrapper && !deleteAction) {
            const id = wrapper.dataset.id;
            const type = wrapper.dataset.type;

            if (!id) return;

            // Fetch Data from dataMap
            let data = this.dataMap.get(id);
            if (!data) {
                // Fallback: ensure ID is string, though dataMap should store as string
                data = this.dataMap.get(String(id));
            }

            if (data) {
                console.log('[GlobalClick] Opening item:', id, type);
                if (type === 'reader' || type === 'reading') {
                    this.loadReader(data);
                } else {
                    // Default to Note
                    if (window.mobileEditor) window.mobileEditor.loadNote(id, data);
                    this.navigateTo('editor');
                }
            } else {
                console.warn('[GlobalClick] Data not found for card ID:', id);
            }
        }
    }

    setupSettingsDialogs() {
        const apiDialog = document.getElementById('api-settings-dialog');
        const btnOpenApiSettings = document.getElementById('act-ai');
        const btnSaveApiSettings = document.getElementById('btn-save-api-settings');
        const btnCancelApiSettings = document.getElementById('btn-cancel-api-settings');
        const btnResetData = document.getElementById('btn-reset-data');

        const inputApiKey = document.getElementById('input-api-key');
        const inputBaseUrl = document.getElementById('input-base-url');
        const inputModel = document.getElementById('input-model');

        // GDrive Settings elements
        const gdDialog = document.getElementById('gdrive-settings-dialog');
        const btnOpenGdSettings = document.getElementById('act-gd-settings');
        const btnSaveGdSettings = document.getElementById('btn-save-gd-settings');
        const btnCancelGdSettings = document.getElementById('btn-cancel-gd-settings');

        const inputGdClientId = document.getElementById('input-gd-client-id');
        const inputGdApiKey = document.getElementById('input-gd-api-key');
        const inputGdRoot = document.getElementById('input-gd-root');

        // 1. Initial Hydration: Load settings immediately so inputs aren't empty after refresh
        const hydrateSettings = async () => {
            try {
                // Try IndexedDB/Storage first
                const res = await window.appStorage.get(['ai_api_key', 'ai_base_url', 'ai_model', 'settings']);

                // Fallback to LocalStorage (The "Bulletproof" Header)
                let apiKey = res.ai_api_key || localStorage.getItem('global_ai_api_key') || '';
                let baseUrl = res.ai_base_url || localStorage.getItem('global_ai_base_url') || 'https://api.deepseek.com';
                let model = res.ai_model || localStorage.getItem('global_ai_model') || 'deepseek-chat';

                if (inputApiKey) inputApiKey.value = apiKey;
                if (inputBaseUrl) inputBaseUrl.value = baseUrl;
                if (inputModel) inputModel.value = model;

                // GDrive Hydration
                const settings = res.settings || {};
                const gdClientId = settings.gdrive_client_id || localStorage.getItem('gdrive_client_id') || '';
                const gdApiKey = settings.gdrive_api_key || localStorage.getItem('gdrive_api_key') || '';
                const gdRoot = settings.gdrive_root_folder || 'Highlighti_Data';

                if (inputGdClientId) inputGdClientId.value = gdClientId;
                if (inputGdApiKey) inputGdApiKey.value = gdApiKey;
                if (inputGdRoot) inputGdRoot.value = gdRoot;

                // CRITICAL: Synchronize AI Core with stored settings on every load
                if (window.aiCore) {
                    window.aiCore.config.apiKey = apiKey;
                    window.aiCore.config.baseUrl = baseUrl;
                    window.aiCore.config.model = model;
                    console.log('[Settings] AI Core Synchronized (Dual-Source)', apiKey ? 'Key Found' : 'No Key');
                }
                console.log('[Settings] UI Hydrated');
            } catch (e) {
                console.warn('[Settings] Hydration failed:', e);
            }
        };
        // Call it immediately
        hydrateSettings();

        // 2. Open Dialog logic
        if (btnOpenApiSettings) {
            btnOpenApiSettings.onclick = async () => {
                const sheet = document.getElementById('action-sheet-overlay');
                if (sheet) sheet.classList.add('hidden');
                // Hydrate again just in case storage changed
                await hydrateSettings();
                if (apiDialog) apiDialog.classList.remove('hidden');
            };
        }

        if (btnOpenGdSettings) {
            btnOpenGdSettings.onclick = async () => {
                const sheet = document.getElementById('action-sheet-overlay');
                if (sheet) sheet.classList.add('hidden');
                await hydrateSettings();
                if (gdDialog) gdDialog.classList.remove('hidden');
            };
        }

        // 3. Save Logic
        if (btnSaveApiSettings) {
            btnSaveApiSettings.onclick = async () => {
                const apiKey = inputApiKey ? inputApiKey.value.trim() : '';
                const baseUrl = inputBaseUrl ? inputBaseUrl.value.trim() : 'https://api.deepseek.com';
                const model = inputModel ? inputModel.value.trim() : 'deepseek-chat';

                console.log('[Settings] Saving AI...', apiKey.slice(0, 4) + '***');

                try {
                    // 1. Save to Structured DB
                    await window.appStorage.set({
                        ai_api_key: apiKey,
                        ai_base_url: baseUrl,
                        ai_model: model
                    });

                    // 2. Save to LocalStorage (Synchronous Backup)
                    localStorage.setItem('global_ai_api_key', apiKey);
                    localStorage.setItem('global_ai_base_url', baseUrl);
                    localStorage.setItem('global_ai_model', model);

                    // Update AI Core in real-time
                    if (window.aiCore) {
                        window.aiCore.config.apiKey = apiKey;
                        window.aiCore.config.baseUrl = baseUrl;
                        window.aiCore.config.model = model;
                    }

                    if (window.showToast) window.showToast('✅ Settings Saved', 2000);
                    if (apiDialog) apiDialog.classList.add('hidden');
                } catch (e) {
                    console.error('Save failed', e);
                    alert('Save Failed: ' + e.message);
                }
            };
        }

        if (btnSaveGdSettings) {
            btnSaveGdSettings.onclick = async () => {
                const clientId = inputGdClientId ? inputGdClientId.value.trim() : '';
                const apiKey = inputGdApiKey ? inputGdApiKey.value.trim() : '';
                const rootFolder = inputGdRoot ? inputGdRoot.value.trim() : 'Highlighti_Data';

                console.log('[Settings] Saving GDrive...');

                try {
                    const res = await window.appStorage.get('settings');
                    const s = res.settings || {};
                    s.gdrive_client_id = clientId;
                    s.gdrive_api_key = apiKey;
                    s.gdrive_root_folder = rootFolder;
                    await window.appStorage.set({ settings: s });

                    localStorage.setItem('gdrive_client_id', clientId);
                    localStorage.setItem('gdrive_api_key', apiKey);

                    if (window.mobileGDrive) {
                        window.mobileGDrive.CLIENT_ID = clientId;
                        window.mobileGDrive.API_KEY = apiKey;
                        window.mobileGDrive.ROOT_FOLDER_NAME = rootFolder;
                    }

                    if (window.showToast) window.showToast('✅ GDrive Settings Saved', 2000);
                    if (gdDialog) gdDialog.classList.add('hidden');
                } catch (e) {
                    console.error('GDrive Save failed', e);
                    alert('Save Failed: ' + e.message);
                }
            };
        }

        if (btnCancelApiSettings) btnCancelApiSettings.onclick = () => apiDialog.classList.add('hidden');
        if (btnCancelGdSettings) btnCancelGdSettings.onclick = () => gdDialog.classList.add('hidden');

        // 4. Reset Logic (Danger Zone)
        if (btnResetData) {
            btnResetData.onclick = async () => {
                if (confirm('⚠️ WARNING: This will PERMANENTLY delete all local notes, chat history, and settings. Continue?')) {
                    if (window.appStorage && window.appStorage.clear) {
                        await window.appStorage.clear();
                        window.showToast('Data Wiped. Reloading...', 2000);
                        setTimeout(() => location.reload(), 2000);
                    }
                }
            };
        }
    }
    setupVoiceListeners() {
        const holdToTalk = document.getElementById('hold-to-talk');
        if (!holdToTalk) return;

        const startHold = (e) => {
            e.preventDefault();
            holdToTalk.textContent = '正在录音...';
            holdToTalk.classList.add('recording');
            if (window.navigator.vibrate) window.navigator.vibrate(40);
            this.startVoiceRecognition();
        };
        const stopHold = (e) => {
            e.preventDefault();
            holdToTalk.textContent = '按住 说话';
            holdToTalk.classList.remove('recording');
            this.stopVoiceRecognition();
        };

        holdToTalk.addEventListener('touchstart', startHold);
        holdToTalk.addEventListener('touchend', stopHold);
        holdToTalk.addEventListener('mousedown', startHold);
        holdToTalk.addEventListener('mouseup', stopHold);
        holdToTalk.addEventListener('mouseleave', stopHold);
    }

    toggleVoiceMode() {
        const homeBtn = document.getElementById('nav-btn-home');
        const holdToTalk = document.getElementById('hold-to-talk');
        const globalInput = document.getElementById('global-input');
        const globalAddBtn = document.getElementById('btn-global-add');
        if (!homeBtn || !holdToTalk || !globalInput) return;

        this.isVoiceMode = !this.isVoiceMode;
        // Reset continuous state when toggling
        this.isContinuousChat = false;

        if (window.navigator.vibrate) window.navigator.vibrate(50);

        if (this.isVoiceMode) {
            globalInput.classList.add('hidden');
            if (globalAddBtn) globalAddBtn.classList.add('hidden');
            holdToTalk.classList.remove('hidden');
            // State 2: Voice Mode (Red style is handled by CSS on .recording class, or just text)
        } else {
            globalInput.classList.remove('hidden');
            if (globalAddBtn) globalAddBtn.classList.remove('hidden');
            holdToTalk.classList.add('hidden');
            // State 1: Text Mode
        }
    }

    /**
     * Called by Chat Module after AI finishes speaking to resume listening.
     */
    continueConversation() {
        if (this.isContinuousChat && this.activeView === 'chat') {
            // Delay slightly to ensure smooth transition
            setTimeout(() => {
                if (this.isContinuousChat) {
                    this.startVoiceRecognition();
                }
            }, 800);
        }
    }

    // Proxy for backward compatibility if needed, or direct call
    openInAppBrowser(url) {
        if (window.mobileBrowser) window.mobileBrowser.open(url);
    }

    setupSwipeNavigation() {
        let touchStartX = 0;
        document.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });
        document.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].screenX;
            if (touchEndX - touchStartX > 150 && touchStartX < 50) {
                this.goBack();
            }
        }, { passive: true });
    }

    navigateTo(viewId) {
        document.querySelectorAll('.app-view').forEach(v => v.classList.remove('active'));
        const target = document.getElementById('view-' + viewId);
        if (target) {
            target.classList.add('active');
            this.activeView = viewId;

            // Auto-scroll chat to bottom
            if (viewId === 'home' || viewId === 'chat') {
                const forceScroll = () => {
                    const scroller = document.getElementById('chat-content');
                    const messages = document.getElementById('messages-container');
                    if (!scroller || !messages) return;

                    // Method 1: Scroll Top
                    scroller.scrollTop = scroller.scrollHeight + 1000;

                    // Method 2: Element Snap
                    if (messages.lastElementChild) {
                        messages.lastElementChild.scrollIntoView({ behavior: 'auto', block: 'end' });
                    }
                };

                // Immediate and staggered execution
                requestAnimationFrame(forceScroll);
                setTimeout(forceScroll, 50);
                setTimeout(forceScroll, 300);
                setTimeout(forceScroll, 800);
            }
        }

        // --- Global Nav Dock & Chat Hub Visibility ---
        const navBar = document.getElementById('global-nav-bar');
        const chatHub = document.getElementById('universal-chat-hub');

        if (navBar) {
            // Immersive/Detail views: Hide dock
            // Comprehensive visibility list
            const hideDockIn = ['home', 'editor', 'reader-detail', 'rss-feed', 'browser'];
            const shouldHideDock = hideDockIn.includes(viewId);

            if (shouldHideDock) {
                console.log('[Nav] Hiding dock for view:', viewId);
                navBar.classList.add('hidden');
                // Force hide to prevent layout interference
                navBar.style.display = 'none';
            } else {
                console.log('[Nav] Showing dock for view:', viewId);
                navBar.classList.remove('hidden');
                // Force flex to ensure visibility
                navBar.style.display = 'flex';
                // Reset transform to ensure it's not stuck off-screen
                navBar.style.transform = 'translateX(-50%)';
            }

            // Update Tab Active State
            document.querySelectorAll('.dock-tab').forEach(t => t.classList.remove('active'));
            const tabMap = {
                'home': 'nav-tab-home',
                'notes': 'nav-tab-notes',
                'reader': 'nav-tab-reader',
                'reader-detail': 'nav-tab-reader',
                'rss': 'nav-tab-rss',
                'rss-feed': 'nav-tab-rss',
                'settings': 'nav-tab-settings'
            };
            const activeTabId = tabMap[viewId];
            if (activeTabId) {
                const tab = document.getElementById(activeTabId);
                if (tab) tab.classList.add('active');
            }
        }

        if (chatHub) {
            // Chat Input Hub strictly for Assistant (Home) view
            if (viewId === 'home' || viewId === 'chat') {
                chatHub.classList.remove('hidden');
            } else {
                chatHub.classList.add('hidden');
            }
        }

        // Snappy Page Render
        const listViews = ['home', 'notes', 'reader', 'rss', 'settings'];
        if (listViews.includes(viewId)) {
            if (this.renderTimeout) clearTimeout(this.renderTimeout);
            this.renderTimeout = setTimeout(() => this.renderApp(), 10);
        }
    }

    goBack() {
        // Reset voice mode when navigating back/home
        if (this.isVoiceMode) {
            this.toggleVoiceMode();
        }
        this.navigateTo('home');
        this.renderApp();
    }

    /**
     * Setup the Attachment Action Sheet triggered by the global '+' button.
     * This allows users to add photos or files before sending to AI.
     */
    setupAttachmentSheet() {
        const attachSheet = document.getElementById('attachment-sheet-overlay');
        const globalAddBtn = document.getElementById('btn-global-add');
        const attCancel = document.getElementById('att-cancel');
        const attCamera = document.getElementById('att-camera');
        const attGallery = document.getElementById('att-gallery');
        const attFile = document.getElementById('att-file');

        // Hidden file inputs
        const cameraInput = document.getElementById('chat-camera-input');
        const galleryInput = document.getElementById('global-gallery-input');
        const fileInput = document.getElementById('chat-file-input');

        // Open attachment sheet
        if (globalAddBtn && attachSheet) {
            globalAddBtn.onclick = (e) => {
                e.stopPropagation();
                attachSheet.classList.remove('hidden');
            };
        }

        // Close on cancel or background click
        if (attCancel) attCancel.onclick = () => attachSheet.classList.add('hidden');
        if (attachSheet) {
            attachSheet.onclick = (e) => {
                if (e.target === attachSheet) attachSheet.classList.add('hidden');
            };
        }

        // Camera action
        if (attCamera && cameraInput) {
            attCamera.onclick = () => {
                attachSheet.classList.add('hidden');
                cameraInput.click();
            };
            cameraInput.onchange = (e) => this.handleAttachment(e.target.files, 'camera');
        }

        // Gallery action
        if (attGallery && galleryInput) {
            attGallery.onclick = () => {
                attachSheet.classList.add('hidden');
                galleryInput.click();
            };
            galleryInput.onchange = (e) => this.handleAttachment(e.target.files, 'gallery');
        }

        // File action
        if (attFile && fileInput) {
            attFile.onclick = () => {
                attachSheet.classList.add('hidden');
                fileInput.click();
            };
            fileInput.onchange = (e) => this.handleAttachment(e.target.files, 'file');
        }

        // Voice action
        const attVoice = document.getElementById('att-voice');
        if (attVoice) {
            attVoice.onclick = () => {
                attachSheet.classList.add('hidden');
                this.startVoiceRecognition();
            };
        }
    }

    /**
     * Swipe-to-Delete Gesture Handler.
     * Uses event delegation on document.body for efficient handling.
     * Why: The CSS for .note-card.swiped and .note-delete-action already exists,
     * but the touch gesture JS was missing entirely.
     */
    setupSwipeToDelete() {
        let startX = 0;
        let startY = 0;
        let lastDeltaX = 0;
        let activeWrapper = null;
        let isSwiping = false;
        const SWIPE_THRESHOLD = 60;
        const VERTICAL_LOCK = 15;

        const closeAllSwiped = (except = null) => {
            document.querySelectorAll('.note-card.swiped').forEach(card => {
                if (card !== except) card.classList.remove('swiped');
            });
        };

        document.body.addEventListener('touchstart', (e) => {
            const wrapper = e.target.closest('.note-item-wrapper');
            if (!wrapper) {
                closeAllSwiped();
                return;
            }
            if (e.target.closest('.note-delete-action')) return;

            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            lastDeltaX = 0;
            activeWrapper = wrapper;
            isSwiping = false;
        }, { passive: true });

        document.body.addEventListener('touchmove', (e) => {
            if (!activeWrapper) return;
            const touch = e.touches[0];
            const deltaX = touch.clientX - startX;
            const deltaY = Math.abs(touch.clientY - startY);

            if (deltaY > VERTICAL_LOCK && !isSwiping) {
                activeWrapper = null;
                return;
            }

            if (deltaX < -10) {
                isSwiping = true;
                lastDeltaX = deltaX;
                const card = activeWrapper.querySelector('.note-card');
                if (card) {
                    const offset = Math.max(-80, Math.min(0, deltaX));
                    card.style.transition = 'none';
                    card.style.transform = `translateX(${offset}px)`;
                }
            } else if (deltaX > 0 && isSwiping) {
                // Swiping back right — allow closing
                lastDeltaX = deltaX;
                const card = activeWrapper.querySelector('.note-card');
                if (card) {
                    card.style.transition = 'none';
                    card.style.transform = `translateX(0)`;
                }
            }
        }, { passive: true });

        document.body.addEventListener('touchend', () => {
            if (!activeWrapper) return;
            const card = activeWrapper.querySelector('.note-card');

            if (card) {
                card.style.transition = '';
                card.style.transform = '';

                if (isSwiping) {
                    if (lastDeltaX < -SWIPE_THRESHOLD) {
                        // Swipe past threshold — reveal delete action
                        closeAllSwiped(card);
                        card.classList.add('swiped');
                    } else {
                        // Didn't swipe far enough — snap back
                        card.classList.remove('swiped');
                    }
                }
            }

            activeWrapper = null;
            isSwiping = false;
            lastDeltaX = 0;
        }, { passive: true });
    }

    startVoiceRecognition(onFinished = null) {
        console.log('[Voice] Triggered');

        // Auto-recover from stale state
        if (this.isRecognitionActive && !this.currentRecognition) {
            console.warn('[Voice] Resetting stale active state');
            this.isRecognitionActive = false;
        }

        if (this.isRecognitionActive || this.isStartingRecognition) {
            console.log('[Voice] Already active or starting, ignoring');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            if (window.showToast) window.showToast('Speech recognition not supported');
            return;
        }

        this.isStartingRecognition = true;

        // 1. Immediate UI Feedback
        if (window.navigator.vibrate) window.navigator.vibrate(50);

        const holdBtn = document.getElementById('hold-to-talk');
        const previewOverlay = document.getElementById('voice-preview-overlay');
        const holdStatus = document.getElementById('voice-status-text');

        if (previewOverlay) previewOverlay.classList.remove('hidden');
        if (holdBtn) holdBtn.classList.add('recording');
        if (holdStatus) holdStatus.textContent = 'Preparing...';

        // Editor floating button feedback
        const editorVoiceBtn = document.getElementById('btn-editor-voice');
        if (editorVoiceBtn) editorVoiceBtn.style.color = '#ff3b30';

        const editorIndicator = document.getElementById('editor-voice-indicator');
        if (editorIndicator) {
            editorIndicator.classList.remove('hidden');
            editorIndicator.textContent = 'Listening...';
        }

        try {
            const recognition = new SpeechRecognition();
            this.currentRecognition = recognition;

            recognition.lang = 'zh-CN';
            recognition.interimResults = true;
            recognition.maxAlternatives = 1;
            recognition.continuous = true;

            recognition.onstart = () => {
                this.isRecognitionActive = true;
                this.isStartingRecognition = false;
                console.log('[Voice] Engine Started');
                if (holdStatus) holdStatus.textContent = '说吧 (Listening)';
            };

            recognition.onresult = (event) => {
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }

                this.voiceBuffer = (this.voiceBuffer || '') + finalTranscript;
                const currentText = (this.voiceBuffer + interimTranscript).trim();

                if (currentText) {
                    this.latestVoiceTranscript = currentText;
                    if (holdStatus) holdStatus.textContent = currentText;
                }

                if (editorIndicator) editorIndicator.textContent = currentText.substring(0, 30);
            };

            recognition.onerror = (event) => {
                console.error('[Voice] Error:', event.error);
                this.isRecognitionActive = false;
                this.isStartingRecognition = false;

                if (event.error === 'no-speech' || event.error === 'aborted') {
                    this.resetVoiceUI();
                    return;
                }

                if (event.error === 'not-allowed') {
                    alert('⚠️ Microphone access denied. Check HTTPS and permissions.');
                } else if (event.error !== 'already-started') {
                    if (window.showToast) window.showToast('Voice Error: ' + event.error);
                }
                this.resetVoiceUI();
            };

            recognition.onend = () => {
                console.log('[Voice] Engine Ended');
                this.isRecognitionActive = false;
                this.isStartingRecognition = false;
                this.currentRecognition = null;

                const textToSend = (this.latestVoiceTranscript || '').trim();

                this.resetVoiceUI();

                if (textToSend) {
                    console.log('[Voice] Finalizing transcript:', textToSend.substring(0, 30));
                    this.latestVoiceTranscript = '';
                    this.voiceBuffer = '';
                    this.handleVoiceResult(textToSend);
                }

                if (typeof onFinished === 'function') onFinished();
            };

            this.voiceBuffer = '';
            this.latestVoiceTranscript = '';
            recognition.start();

        } catch (e) {
            console.error('[Voice] Exception:', e);
            this.isRecognitionActive = false;
            this.isStartingRecognition = false;
            this.resetVoiceUI();
        }
    }

    resetVoiceUI() {
        const previewOverlay = document.getElementById('voice-preview-overlay');
        const holdBtn = document.getElementById('hold-to-talk');
        const holdStatus = document.getElementById('voice-status-text');

        if (previewOverlay) previewOverlay.classList.add('hidden');
        if (holdBtn) {
            holdBtn.classList.remove('recording');
            holdBtn.textContent = '按住 说话';
        }
        if (holdStatus) {
            holdStatus.textContent = '说吧 (Listening)';
        }

        const editorVoiceBtn = document.getElementById('btn-editor-voice');
        if (editorVoiceBtn) editorVoiceBtn.style.color = '';

        const editorIndicator = document.getElementById('editor-voice-indicator');
        if (editorIndicator) {
            editorIndicator.classList.add('hidden');
        }
        const dockIndicator = document.getElementById('dock-voice-indicator');
        if (dockIndicator) {
            dockIndicator.classList.add('hidden');
        }
    }

    handleVoiceResult(text) {
        if (!text || !text.trim()) return;
        const cleanText = text.trim();
        console.log('[Voice] Result Captured:', cleanText.substring(0, 30));

        if (this.activeView === 'editor' && window.mobileEditor) {
            window.mobileEditor.insertTextAtCursor(cleanText);
        } else {
            // For global chat, send directly
            this.triggerUniversalSend(cleanText);

            // Clear input buffer just in case
            const globalInput = document.getElementById('global-input');
            if (globalInput) globalInput.value = '';
        }
    }

    stopVoiceRecognition(callback) {
        if (this.currentRecognition) {
            // Release-to-send delay: 100ms for Snappy PTT
            setTimeout(() => {
                try {
                    if (this.currentRecognition) this.currentRecognition.stop();
                } catch (e) { console.log(e); }
            }, 100);
        } else {
            this.isRecognitionActive = false;
            this.resetVoiceUI();
        }

        if (callback) callback();
    }


    /**
     * Handle selected attachment files - navigate to chat and pass to mobileChat.
     * @param {FileList} files 
     * @param {string} source - 'camera', 'gallery', or 'file'
     */
    handleAttachment(files, source) {
        if (!files || files.length === 0) return;

        // Navigate to home view (where Assistant/Chat lives)
        this.navigateTo('home');

        // If mobileChat has an attachment handler, use it
        if (window.mobileChat && typeof window.mobileChat.addAttachments === 'function') {
            window.mobileChat.addAttachments(files);
        } else {
            console.log(`[Attachment] ${files.length} file(s) selected from ${source}`);
            // Fallback: store for later use
            this.pendingAttachments = Array.from(files);
        }
    }

    loadReader(data, options = {}) {
        this.navigateTo('reader-detail');
        const titleEl = document.getElementById('reader-title');
        const metaEl = document.getElementById('reader-meta');
        const contentEl = document.getElementById('reader-content');
        const scrollArea = document.querySelector('.reader-scroll-area');

        if (titleEl) titleEl.innerText = data.title || 'Untitled Article';
        if (metaEl) {
            let domain = 'Local Source';
            try {
                if (data.url && data.url.startsWith('http')) {
                    domain = new URL(data.url).hostname;
                }
            } catch (e) { console.warn('URL Parse Error', e); }

            const time = data.updatedAt || data.timestamp || Date.now();
            const date = new Date(time).toLocaleString();
            metaEl.innerText = `${domain} • ${date}`;
        }

        if (contentEl) {
            // Enhanced Readability: Preserve formatting
            let content = (data.content || data.text || '').replace(/\n/g, '<br>');

            // If content is very short (typical for RSS snippets) or missing, 
            // and we have a URL, show a loading indicator and fetch full text.
            const textContent = content.replace(/<[^>]*>/g, '').trim();
            const isShort = textContent.length < 500;
            const fromRSS = options && (options.fromRSS || options.fromRSSFeed);

            if (data.url && (isShort || fromRSS)) {
                contentEl.innerHTML = `
                    <div id="full-text-loader" style="padding: 20px; text-align: center; color: #8e8e93; font-size: 13px;">
                        <div class="typing-indicator" style="margin-bottom: 8px;">...</div>
                        📡 正在获取全文并优化排版...
                    </div>
                    <div id="original-preview" style="opacity: 0.5;">${content}</div>
                `;

                // Trigger full text extraction
                this.fetchFullArticle(data.url, contentEl);
            } else {
                contentEl.innerHTML = content || '<div style="text-align:center; color:#999; margin-top:40px;">No content available.</div>';
                this.fixContentImages(contentEl, data.url);
            }
        }

        this.currentReaderUrl = data.url;

        // Load snapshot
        this.loadSnapshot(data.url);

        // Auto-Expand Snapshot if requested (e.g. from Chat)
        if (options && options.autoExpandSnapshot) {
            setTimeout(() => {
                const toggleBtn = document.getElementById('btn-toggle-snapshot');
                if (toggleBtn) toggleBtn.click();
            }, 300);
        }

        // Handle navigation state
        if (options && options.fromChat) {
            this.returnToChat = true;
            this.returnToRSS = false;
        } else if (options && (options.fromRSS || options.fromRSSFeed)) {
            this.returnToRSS = true;
            this.returnToChat = false;
            // Explicitly mark context so back button knows
            const scrollArea = document.querySelector('.reader-scroll-area');
            if (scrollArea) scrollArea.dataset.fromContext = 'rss';
        } else {
            this.returnToChat = false;
            this.returnToRSS = false;
        }

        this.navigateTo('reader-detail');

        // Scroll to top
        document.querySelector('.reader-scroll-area').scrollTop = 0;
    }

    async loadSnapshot(url) {
        const container = document.getElementById('reader-snapshot-container');
        const contentEl = document.getElementById('reader-snapshot-content');
        const toggleBtn = document.getElementById('btn-toggle-snapshot');

        if (!container || !contentEl || !toggleBtn) return;

        // Reset state
        container.classList.add('hidden');
        contentEl.classList.add('hidden');
        toggleBtn.classList.remove('active');
        contentEl.innerHTML = '';
        const arrow = toggleBtn.querySelector('.arrow');
        if (arrow) arrow.innerText = '▼';

        if (!url) return;

        try {
            const key = 'snapshot_' + url;
            // First, just check if the key exists to show the bar
            const res = await window.appStorage.get(key);
            const snapshotData = res[key];

            if (snapshotData && snapshotData.content) {
                container.classList.remove('hidden');

                // Toggle click handler handles lazy loading
                toggleBtn.onclick = async (e) => {
                    e.stopPropagation();
                    const isHidden = contentEl.classList.contains('hidden');

                    if (isHidden) {
                        // If content is empty, fetch and render now
                        if (!contentEl.innerHTML.trim()) {
                            contentEl.innerHTML = `
                            <div style="font-size: 13px; color: #8e8e93; margin-bottom: 12px; padding: 10px; border-left: 3px solid #ddd; font-style: italic;">
                                Saved Page Content (Snapshot):
                            </div>
                            <div class="snapshot-inner-content" style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #eee; overflow-x: auto;">
                                ${snapshotData.content}
                            </div>
                        `;
                        }
                        contentEl.classList.remove('hidden');
                        toggleBtn.classList.add('active');
                        if (arrow) arrow.innerText = '▲';
                    } else {
                        contentEl.classList.add('hidden');
                        toggleBtn.classList.remove('active');
                        if (arrow) arrow.innerText = '▼';
                    }
                };
            }
        } catch (e) {
            console.warn('Failed to check/load snapshot:', e);
        }
    }

    async smartToggleSnapshot(url) {
        if (!url) return;
        const key = 'snapshot_' + url;
        const res = await window.appStorage.get(key);

        if (res[key] && res[key].content) {
            // Success: We have a snapshot. Expand it immediately.
            const container = document.getElementById('reader-snapshot-container');
            const contentEl = document.getElementById('reader-snapshot-content');
            const toggleBtn = document.getElementById('btn-toggle-snapshot');

            if (container && contentEl) {
                container.classList.remove('hidden');
                if (contentEl.classList.contains('hidden')) {
                    if (toggleBtn) toggleBtn.click(); // Trigger the expansion logic
                }
                // Scroll to snapshot
                container.scrollIntoView({ behavior: 'smooth' });
            }
        } else {
            // Failure/Missing: Fetch it now!
            console.log('[SmartLoad] No snapshot found. Fetching via AI Engine...');
            if (window.mobileChat) {
                window.mobileChat.saveUrlToReader(url);
            }
        }
    }

    async fetchFullArticle(url, targetEl) {
        if (typeof chrome === 'undefined' || !chrome.runtime) return;

        chrome.runtime.sendMessage({ action: 'FETCH_ARTICLE_SNAPSHOT', url: url }, async (response) => {
            if (!response || !response.success || !response.html) {
                const loader = targetEl.querySelector('#full-text-loader');
                if (loader) loader.innerHTML = '⚠️ 无法提取全文，显示预览版本';
                const preview = targetEl.querySelector('#original-preview');
                if (preview) preview.style.opacity = '1';
                return;
            }

            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(response.html, 'text/html');

                // 1. Core Visual Focusing (Identify the "Red Box" region)
                let mainContent = VisualContentExtractor.extract(doc);

                // 2. Focused Cleaning (Remove junk while preserving focus)
                mainContent = VisualContentExtractor.clean(mainContent);

                // 3. Title Preservation: REMOVED as per user request (Duplicate Title Fix)
                // The main title is already rendered in the reader header.
                // const docTitle = doc.querySelector('h1')?.innerText.trim();
                /* 
                if (docTitle && !mainContent.innerText.includes(docTitle)) {
                    const titleEl = doc.createElement('h1');
                    titleEl.innerText = docTitle;
                    // ... styles ...
                    mainContent.prepend(titleEl);
                } 
                */


                // 4. Final safety check & UI Update
                let html = mainContent.innerHTML;
                if (!html.trim() || html.length < 50) {
                    html = doc.body.innerHTML;
                }

                targetEl.innerHTML = `
                    <div class="full-article-content">
                        ${html}
                    </div>
                `;

                this.fixContentImages(targetEl, url);

                const key = 'snapshot_' + url;
                await window.appStorage.set({ [key]: { content: html, timestamp: Date.now() } });
                this.loadSnapshot(url);

            } catch (e) {
                console.error('[ArticleFetch] Parse error:', e);
            }
        });
    }

    fixContentImages(container, baseUri) {
        if (!container) return;

        container.querySelectorAll('img').forEach(img => {
            // 1. Handle Lazy Loading
            const lazyAttrs = ['data-src', 'original-src', 'data-original', 'data-actualsrc', 'data-srcset', 'file-src', 'data-lazy-src'];
            let realSrc = null;
            for (const attr of lazyAttrs) {
                const val = img.getAttribute(attr);
                if (val) { realSrc = val; break; }
            }
            if (!realSrc) realSrc = img.getAttribute('src');

            if (realSrc) {
                // 2. Resolve Relative URLs
                if (!realSrc.startsWith('http') && !realSrc.startsWith('data:') && baseUri) {
                    try { img.src = new URL(realSrc, baseUri).href; } catch (e) { }
                } else if (realSrc.startsWith('//')) {
                    img.src = 'https:' + realSrc;
                } else {
                    img.src = realSrc;
                }
            }

            // 3. Referer Protection (Baidu, etc.)
            img.setAttribute('referrerpolicy', 'no-referrer');

            // 4. Aggressive Style Reset (Kill excessive whitespace)
            img.removeAttribute('height'); // Remove fixed height attributes
            img.style.height = 'auto';     // Force auto height
            img.style.maxHeight = 'none';
            img.style.maxWidth = '100%';
            img.style.display = 'block';
            img.style.margin = '10px auto'; // Compact margin
            img.style.borderRadius = '6px';
            img.style.padding = '0';
            img.style.border = 'none';

            // 5. Recursive Parent Spacer Cleanup
            // Articles often wrap images in multiple nested divs with fixed aspect-ratios (padding-top: 66%)
            // We climb up to 3 levels to neutralize these spacers.
            let p = img.parentElement;
            let depth = 0;
            while (p && p !== container && depth < 3) {
                const styleAttr = p.getAttribute('style') || '';
                const hasSpacerStyle = styleAttr.includes('height:') ||
                    styleAttr.includes('padding:') ||
                    styleAttr.includes('margin:') ||
                    styleAttr.includes('width:');

                if (hasSpacerStyle || p.tagName === 'P') {
                    p.style.height = 'auto';
                    p.style.minHeight = '0';
                    p.style.paddingTop = '0';
                    p.style.marginTop = '0';
                    p.style.paddingBottom = '4px'; // Minimal gap
                    p.style.width = '100%';
                    p.style.textAlign = 'center';
                }
                p = p.parentElement;
                depth++;
            }

            // 6. Filter tiny images (icons, logos, placeholders)
            const w = parseInt(img.getAttribute('width') || '0');
            const h = parseInt(img.getAttribute('height') || '0');
            if ((w > 0 && w < 20) || (h > 0 && h < 20)) {
                img.style.display = 'none';
            }

            // 7. Error Handling
            img.onerror = () => {
                img.style.display = 'none';
            };
        });

        // 8. Final Link/Button Cleanup
        container.querySelectorAll('a').forEach(a => {
            const href = a.getAttribute('href');
            if (href && !href.startsWith('http') && !href.startsWith('#') && baseUri) {
                try { a.href = new URL(href, baseUri).href; } catch (e) { }
            }
            a.target = '_blank';
            // Suppress "Open in App" buttons that look like links
            if (a.innerText.includes('打开APP') || a.innerText.includes('App') || a.innerText.includes('全文')) {
                a.style.display = 'none';
            }
        });
    }

    async renderApp(force = false) {
        if (!window.appStorage) return;

        // Smart Render Guard: Only fetch from IDB if cache is dirty or forced
        if (this.cacheDirty || force || !this.dataCache) {
            this.dataCache = await window.appStorage.getAll();
            this.cacheDirty = false;
        }

        // Performance: Skip UI update if we are in a deep view (Detail views)
        // shallowViews are the main tabs where data needs to be rendered
        const shallowViews = ['home', 'notes', 'reader', 'rss'];
        if (!force && !shallowViews.includes(this.activeView)) {
            // But still allow RSS rendering if we are on RSS view? 
            // Actually, if we are on 'rss', we WANT to proceed to window.renderRSSFeeds below.
            return;
        }

        const all = this.dataCache || {};
        // if (!all || Object.keys(all).length === 0) {
        //     console.log('[renderApp] No data found (rendering empty state)');
        //     // Do not return early, as we still need to render RSS and empty placeholders
        // }

        const noteMap = new Map(); // Use Map to deduplicate by ID
        const readerMap = {}; // For grouping

        // Pre-filter: Skip heavy/system keys early for performance
        const systemKeys = new Set([
            'ai_api_key', 'ai_base_url', 'ai_model',
            'gdrive_client_id', 'gdrive_api_key', 'gdrive_root_folder',
            'settings', 'user_license_status', 'folder_structure'
        ]);
        const isSkippableKey = (key) => {
            if (!key) return true;
            if (systemKeys.has(key)) return true;
            if (key.startsWith('snapshot_')) return true;
            if (key.startsWith('gdrive_token')) return true;
            if (key.startsWith('chat_session_') && !key.includes('note')) return true; // Skip chat sessions
            return false;
        };

        const processItem = (val, key, arrayIdx = -1) => {
            if (!val || typeof val !== 'object') return;

            // 1. Recursive for Arrays (like user_notes)
            if (Array.isArray(val)) {
                val.forEach((sub, i) => processItem(sub, key, i));
                return;
            }

            // 2. Detection Logic
            const isReading = (val.type === 'reading' ||
                val.url ||
                (key && (key.startsWith('http') || key.startsWith('meta_')))) &&
                !(key && key.startsWith('snapshot_')); // Exclude full snapshots

            const isNote = (val.type === 'note' ||
                (key && (key.startsWith('note-') || key.startsWith('note_')))) ||
                ((val.hasOwnProperty('content') || val.hasOwnProperty('text')) && !val.url && !isReading);

            if (key && key.startsWith('snapshot_')) return; // Explicitly skip snapshot keys

            if (isNote) {
                // 1. Determine Identity (ID or ChatSession)
                const identity = String(val.chatSessionId || val.id || val.timestamp || (arrayIdx !== -1 ? `idx-${arrayIdx}` : key));

                // 2. Build Content-Based Fingerprint (Title + Compressed Content)
                // This catches duplicates even if they have different IDs/Timestamps
                const rawContent = (val.content || val.text || '').trim();
                const contentFingerprint = `${val.title}_${rawContent.substring(0, 150).replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '')}`;

                const time = this.safeParseToNumber(val.updatedAt || val.timestamp);

                // 3. Robust Search for Existing Duplicate
                const existing = noteMap.get(identity) ||
                    Array.from(noteMap.values()).find(n => n._fingerprint === contentFingerprint);

                if (!existing || (time > 0 && time > (existing.updatedAt || 0))) {
                    // If we are replacing an existing but different ID entry, remove the old one
                    if (existing && existing.id !== identity) {
                        noteMap.delete(existing.id);
                        // [Auto-Clean Registry] Disabled for performance
                        /* 
                        if (existing._storageKey && existing._storageKey !== 'user_notes' && existing._storageKey !== key) {
                             window.appStorage.remove(existing._storageKey);
                        } 
                        */
                    }

                    noteMap.set(identity, {
                        ...val,
                        id: identity,
                        updatedAt: time,
                        _fingerprint: contentFingerprint,
                        _storageKey: key,
                        _originalIdx: arrayIdx
                    });
                } else {
                    // The current item is the duplicate/older one. 
                    // If it's stored as a redundant flat key, clean it up from IDB immediately.
                    // Disabled for performance
                    /*
                    if (key !== 'user_notes' && key !== identity) {
                         window.appStorage.remove(key);
                    }
                    */
                }
            } else if (isReading) {
                const rKey = val.url || val.title || key;
                if (!readerMap[rKey]) {
                    readerMap[rKey] = {
                        ...val,
                        id: rKey,
                        _storageKey: key,
                        title: val.title || key,
                        updatedAt: val.updatedAt || val.timestamp || 0,
                        timestamp: val.updatedAt || val.timestamp || 0,
                        contents: []
                    };
                }
                const textBody = val.text || val.content || '';
                const item = {
                    text: textBody,
                    color: val.color || '#fff176',
                    timestamp: val.timestamp || Date.now()
                };
                if (textBody && !readerMap[rKey].contents.some(c => (typeof c === 'object' ? c.text : c) === textBody)) {
                    readerMap[rKey].contents.push(item);
                }
                const currentTime = this.safeParseToNumber(val.updatedAt || val.timestamp);
                if (currentTime > (readerMap[rKey].updatedAt || 0)) {
                    readerMap[rKey].updatedAt = currentTime;
                    readerMap[rKey].timestamp = currentTime;
                }
            } else {
                // 3. If neither, but it's a plain object, descend into it (for highlights objects)
                // Avoid recursing into too deep or system property objects
                Object.entries(val).forEach(([k, v]) => {
                    if (typeof v === 'object' && v !== null) {
                        processItem(v, k);
                    }
                });
            }
        };

        Object.entries(all).forEach(([key, val]) => {
            // Skip config/system keys at root level using pre-filter
            if (isSkippableKey(key)) return;
            processItem(val, key);
        });

        const readings = Object.values(readerMap).map(r => {
            // Pre-process each snippet for proper HTML wrapping
            const processedContents = r.contents.map(c => {
                const text = typeof c === 'object' ? c.text : c;
                const color = typeof c === 'object' ? c.color : '#fff176';
                if (!text) return '';

                let html = text;
                if (!html.includes('<p>') && !html.includes('<div') && !html.includes('<br')) {
                    html = html.split('\n\n').map(p => `<p>${p.trim()}</p>`).join('');
                }

                return `
                    <div class="reader-highlight-block" style="border-left: 4px solid ${color}; padding-left: 12px; margin: 16px 0; background: rgba(0,0,0,0.02); padding: 8px 8px 8px 12px; border-radius: 2px 4px 4px 2px;">
                        ${html}
                    </div>
                `;
            });

            return {
                ...r,
                content: processedContents.join('')
            };
        });

        // Filter and Sort
        const filterFn = (item) => {
            const title = (item.title || '').toLowerCase();
            const text = (item.content || '').toLowerCase();
            return title.includes(this.searchQuery) || text.includes(this.searchQuery);
        };

        const filteredNotes = Array.from(noteMap.values()).filter(filterFn).sort((a, b) => {
            const timeA = a.updatedAt || a.timestamp || 0;
            const timeB = b.updatedAt || b.timestamp || 0;
            return timeB - timeA;
        });
        const filteredReader = readings.filter(filterFn).sort((a, b) => {
            const timeA = a.updatedAt || a.timestamp || 0;
            const timeB = b.updatedAt || b.timestamp || 0;
            return timeB - timeA;
        });

        this.dataMap.clear();
        filteredNotes.forEach(n => this.dataMap.set(String(n.id), n));
        filteredReader.forEach(r => this.dataMap.set(String(r.id), r));

        // Render Home Summary (Top 10) - CRITICAL PATH (Immediate)
        this.renderNotes(filteredNotes.slice(0, 10), 'notes-list-container');
        this.renderReader(filteredReader.slice(0, 10), 'reader-list-container');

        // Defer Full Lists (Background) - Prevents UI Freeze on Startup
        if (window.requestIdleCallback) {
            window.requestIdleCallback(() => {
                this.renderNotes(filteredNotes, 'full-notes-container');
                this.renderReader(filteredReader, 'full-reader-container');
                if (window.renderRSSFeeds) window.renderRSSFeeds();
            });
        } else {
            setTimeout(() => {
                this.renderNotes(filteredNotes, 'full-notes-container');
                this.renderReader(filteredReader, 'full-reader-container');
                if (window.renderRSSFeeds) window.renderRSSFeeds();
            }, 100);
        }
    }

    createCard(data, type) {
        const isNote = type === 'notes';
        const id = isNote ? data.id : data.url;
        const title = (isNote ? data.title : data.title) || 'Untitled Note';
        const preview = (isNote ? (data.summary || data.content) : data.content) || 'No summary available...';
        const source = data.url ? new URL(data.url).hostname.replace('www.', '') : 'Highlighti';
        const timeStr = window.formatRelativeTime(data.timestamp);
        const favicon = `https://www.google.com/s2/favicons?domain=${source}&sz=32`;

        return `
            <div class="note-item-wrapper" data-id="${id}" data-type="${type}">
                <div class="note-card">
                    <div class="note-title">${this.stripHtml(title)}</div>
                    <div class="note-summary">${this.stripHtml(preview)}</div>
                    <div class="note-meta">
                        <img class="note-meta-icon" src="${favicon}" onerror="this.src='../icons/icon32.png'">
                        <span class="note-meta-url">${source}</span>
                        <span>•</span>
                        <span>${timeStr}</span>
                    </div>
                </div>
            </div>
        `;
    }

    renderNotes(notes, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = notes.map(n => this.createCard(n, 'notes')).join('');
    }

    renderReader(items, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = items.map(i => this.createCard(i, 'reader')).join('');
    }

    // End of rendering logic

    setupDataManagement() {
        // Settings Action Sheet buttons (Compatibility)
        const btnExport = document.getElementById('btn-export-json');
        const btnImport = document.getElementById('btn-import-json');
        const inputImport = document.getElementById('input-import-json');
        const btnReset = document.getElementById('btn-reset-data');

        // New Settings View buttons (V12.0)
        const btnExportAlt = document.getElementById('btn-export-json-alt');
        const btnImportAlt = document.getElementById('btn-import-json-alt');
        const btnResetAlt = document.getElementById('btn-reset-data-alt');

        const handleExport = async () => {
            try {
                const allData = await window.appStorage.get(null);
                const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `highlighti_backup_${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
            } catch (e) {
                alert('导出失败: ' + e.message);
            }
        };

        const handleReset = async () => {
            if (confirm('⚠️ 确定要清空所有本地数据吗？此操作不可撤销！')) {
                await window.appStorage.clear();
                alert('数据已重置。');
                window.location.reload();
            }
        };

        if (btnExport) btnExport.onclick = handleExport;
        if (btnExportAlt) btnExportAlt.onclick = handleExport;
        if (btnReset) btnReset.onclick = handleReset;
        if (btnResetAlt) btnResetAlt.onclick = handleReset;

        if ((btnImport || btnImportAlt) && inputImport) {
            const triggerImport = () => inputImport.click();
            if (btnImport) btnImport.onclick = triggerImport;
            if (btnImportAlt) btnImportAlt.onclick = triggerImport;

            inputImport.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const data = JSON.parse(event.target.result);
                        if (confirm('导入的数据将合并到当前存储。确定继续吗？')) {
                            await window.appStorage.set(data);
                            alert('数据导入成功，应用将自动刷新。');
                            window.location.reload();
                        }
                    } catch (err) {
                        alert('导入失败: 无效的 JSON 文件。');
                    }
                    inputImport.value = '';
                };
                reader.readAsText(file);
            };
        }

        // New Settings Navigation Items
        const setLang = document.getElementById('set-language');
        if (setLang) setLang.onclick = () => alert('Language options: CN/EN (Auto-detected)');

        const setGDrive = document.getElementById('act-sync'); // GDrive
        const setWebDAV = document.getElementById('act-sync-webdav'); // WebDAV
        const setAI = document.getElementById('act-ai'); // AI Key

        // These already have listeners in setupEvents, but we can enhance them here if needed
    }

    stripHtml(html) {
        const doc = new Array();
        return html.replace(/<[^>]*>?/gm, '');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.mobileCore = new MobileApp();
    window.app = window.mobileCore; // Support for legacy 'app.navigateTo' calls
    // Optimization: Immediate render for perceived speed (was 500ms)
    setTimeout(() => window.mobileCore.renderApp(), 10);
});

// Service Worker Registration (Moved for CSP compliance)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW registered:', reg.scope))
            .catch(e => console.log('SW failed:', e));
    });
}
