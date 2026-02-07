/**
 * mobile-core.js - The Brain of Mobile App (V10.7)
 */

class MobileApp {
    constructor() {
        this.homeView = document.getElementById('view-home');
        this.chatView = document.getElementById('view-chat');
        this.editorView = document.getElementById('view-editor');
        this.globalSearch = document.getElementById('global-search');

        this.searchQuery = '';
        this.activeView = 'home';
        this.dataMap = new Map();
        this.dataCache = null; // Performance: Persistent cache for lists
        this.cacheDirty = true; // Flag for re-fetch

        this.setupKeyboardTracking();
        this.setupEvents();
        this.setupVoiceListeners();

        // Initialize external modules if available
        if (window.initMobileBrowser) window.initMobileBrowser(this);

        console.log('MobileCore V10.7 (Modular) Initialized');
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
        if (window.visualViewport) {
            const updateOffset = () => {
                const offset = window.innerHeight - window.visualViewport.height;
                // Only apply if offset is significant
                const finalOffset = offset > 50 ? offset : 0;
                document.documentElement.style.setProperty('--keyboard-offset', `${finalOffset}px`);

                if (finalOffset > 0) {
                    document.body.classList.add('keyboard-visible');
                } else {
                    document.body.classList.remove('keyboard-visible');
                }

                if (finalOffset > 0 && document.activeElement) {
                    setTimeout(() => {
                        document.activeElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
                    }, 300);
                }
            };
            window.visualViewport.addEventListener('resize', updateOffset);
            window.visualViewport.addEventListener('scroll', updateOffset);
        }
    }

    triggerUniversalSend(inputEl) {
        if (!inputEl) return;
        const text = inputEl.value ? inputEl.value.trim() : '';
        if (!text) return;

        // Auto-exit voice mode for visual feedback
        if (this.isVoiceMode) this.toggleVoiceMode();

        if (window.mobileChat) {
            // Case 1: Already in Chat view
            if (this.activeView === 'chat') {
                window.mobileChat.handleExternalSend(text);
                if (inputEl.tagName === 'INPUT') inputEl.value = '';
            }
            // Case 2: In Home or List views
            else {
                this.navigateTo('chat');
                window.mobileChat.handleExternalSend(text);
                if (inputEl.tagName === 'INPUT') inputEl.value = '';
            }
        }
    }

    navigateToChat() {
        this.navigateTo('chat');
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
                sheet.classList.add('hidden');
                if (window.mobileEditor) window.mobileEditor.saveNote();
            };
        }

        // --- Attachment Action Sheet Logic ---
        this.setupAttachmentSheet();

        // Headers
        const notesHeader = document.getElementById('header-notes-all');
        if (notesHeader) notesHeader.onclick = () => this.navigateTo('notes-all');

        const readingHeader = document.getElementById('header-reading-all');
        if (readingHeader) readingHeader.onclick = () => this.navigateTo('reading-all');

        // New Note Buttons
        const notesAllNew = document.getElementById('btn-notes-all-new');
        if (notesAllNew) {
            notesAllNew.onclick = () => {
                if (window.mobileEditor) window.mobileEditor.initNewNote();
            };
        }

        const notesPageNew = document.getElementById('btn-notes-page-new');
        if (notesPageNew) {
            notesPageNew.onclick = () => {
                if (window.mobileEditor) window.mobileEditor.initNewNote();
            };
        }

        // --- Global Nav: Home/Back Button with Voice Toggle (Long Press) ---
        // --- Global Nav: Home/Back Button (Pure Home Function) ---
        const homeNavBtn = document.getElementById('nav-btn-home');
        if (homeNavBtn) {
            homeNavBtn.onclick = (e) => {
                // If in voice mode, valid to reset to text mode
                if (this.isVoiceMode) {
                    this.toggleVoiceMode();
                }

                // Always navigate home
                if (this.activeView !== 'home') {
                    this.navigateTo('home');
                } else {
                    // If already at home, maybe refresh or scroll to top?
                    // For now, just reset search if any
                    if (this.searchQuery) {
                        this.searchQuery = '';
                        const input = document.getElementById('global-input');
                        if (input) input.value = '';
                        this.renderApp();
                    }
                }
            };
        }

        // Back logic for specific views
        document.querySelectorAll('.btn-go-home').forEach(btn => {
            if (btn.id !== 'nav-btn-home') btn.onclick = () => {
                // Ensure voice mode is off when leaving deep views?
                if (this.isVoiceMode) this.toggleVoiceMode();
                this.navigateTo('home');
            };
        });
        document.querySelectorAll('.btn-back-to-notes').forEach(btn => {
            btn.onclick = async () => {
                if (window.mobileEditor) {
                    // Wait for save before navigating
                    await window.mobileEditor.saveNote(true);
                }
                this.navigateTo('notes-all');
            };
        });
        document.querySelectorAll('.btn-back-to-reader').forEach(btn => {
            btn.onclick = () => this.navigateTo('reading-all');
        });

        // --- Global Core Hub: Input & Send ---
        const globalInput = document.getElementById('global-input');
        const globalSendBtn = document.getElementById('btn-global-send');

        if (globalInput) {
            let inputLongPressTimer;
            let isLongPressActive = false;

            const startInputPress = (e) => {
                // Only left click or single touch
                if (e.type === 'mousedown' && e.button !== 0) return;

                isLongPressActive = false;
                inputLongPressTimer = setTimeout(() => {
                    isLongPressActive = true;
                    // Trigger Voice Mode
                    if (window.navigator.vibrate) window.navigator.vibrate(50);

                    // Switch UI to Voice Mode manually to ensure smooth transition
                    this.isVoiceMode = true;
                    globalInput.classList.add('hidden');
                    if (globalAddBtn) globalAddBtn.classList.add('hidden');

                    const holdBtn = document.getElementById('hold-to-talk');
                    if (holdBtn) {
                        holdBtn.classList.remove('hidden');
                        holdBtn.textContent = 'Recording... (Release to Send)';
                        holdBtn.classList.add('recording');
                    }

                    // Start Recognition Immediately
                    this.startVoiceRecognition();

                }, 500); // 500ms threshold
            };

            const endInputPress = (e) => {
                clearTimeout(inputLongPressTimer);

                if (isLongPressActive) {
                    // It was a voice action
                    e.preventDefault(); // Prevent click/focus
                    isLongPressActive = false;

                    // Stop Recognition
                    this.stopVoiceRecognition((text) => {
                        // Optional callback if needed, but stopVoiceRecognition already sends
                    });

                    // Reset UI slightly delayed to show "Sent" state or just snap back
                    setTimeout(() => {
                        this.isVoiceMode = false;
                        globalInput.classList.remove('hidden');
                        if (globalAddBtn) globalAddBtn.classList.remove('hidden');
                        const holdBtn = document.getElementById('hold-to-talk');
                        if (holdBtn) {
                            holdBtn.classList.add('hidden');
                            holdBtn.classList.remove('recording');
                            holdBtn.textContent = '按住 说话';
                        }
                    }, 300);

                } else {
                    // It was a short tap (normal input) handled by click/focus events
                }
            };

            // Attach to Input
            globalInput.addEventListener('touchstart', startInputPress, { passive: true });
            globalInput.addEventListener('mousedown', startInputPress);

            // Attach End to Window to catch release anywhere
            window.addEventListener('touchend', (e) => {
                if (inputLongPressTimer) endInputPress(e);
            });
            window.addEventListener('mouseup', (e) => {
                if (inputLongPressTimer) endInputPress(e);
            });
            globalInput.addEventListener('touchmove', () => {
                // Optional: Cancel if moved too much? For now, keep simple.
                // clearTimeout(inputLongPressTimer); 
            });

            // Prevent Context Menu on long press
            globalInput.addEventListener('contextmenu', (e) => {
                if (isLongPressActive) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            });

            // 2. Normal Input Behavior
            globalInput.oninput = (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.renderApp();
                if (globalSendBtn) {
                    if (e.target.value.trim().length > 0) globalSendBtn.classList.remove('hidden');
                    else globalSendBtn.classList.add('hidden');
                }
            };
            globalInput.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.triggerUniversalSend(globalInput);
                    if (globalSendBtn) globalSendBtn.classList.add('hidden');
                }
            };
            globalInput.onfocus = () => {
                // Delay to see if it was a long press (which would hide the input)
                // But generally, touchstart happens first.
                setTimeout(() => {
                    if (!this.isVoiceMode) {
                        const viewsToAutoChat = ['home', 'notes-all', 'reading-all', 'reader-detail'];
                        if (viewsToAutoChat.includes(this.activeView)) this.navigateToChat();
                    }
                }, 100);
            };
        }

        if (globalSendBtn && globalInput) {
            globalSendBtn.onclick = () => {
                this.triggerUniversalSend(globalInput);
                globalSendBtn.classList.add('hidden');
            };
        }

        // --- Toggle Voice Mode Back Handler ---
        const holdToTalk = document.getElementById('hold-to-talk');
        if (holdToTalk) {
            // If user taps (short press) hold-to-talk, switch back to text
            holdToTalk.addEventListener('click', () => {
                this.toggleVoiceMode();
                // Re-focus input?
                setTimeout(() => {
                    if (globalInput) globalInput.focus();
                }, 100);
            });
        }

        // --- API \u0026 GDrive Settings Dialogs ---
        this.setupSettingsDialogs();

        // Delegation for dynamic cards & Chat Links
        const handleGlobalClick = async (e) => {
            const target = e.target;

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
            const card = target.closest('.note-card');
            if (card) {
                const id = card.dataset.id;
                const type = card.dataset.type;
                if (!id) return;
                const data = this.dataMap.get(id);
                if (data) {
                    if (type === 'reader') {
                        this.loadReader(data);
                    } else {
                        // Default to Note
                        if (window.mobileEditor) window.mobileEditor.loadNote(id, data);
                        this.navigateTo('editor');
                    }
                }
            }
        };

        // Aggressive binding to capture phase if possible, but basic click usually works
        document.body.addEventListener('click', handleGlobalClick);

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

    setupSettingsDialogs() {
        const apiDialog = document.getElementById('api-settings-dialog');
        const btnOpenApiSettings = document.getElementById('act-ai');
        const btnSaveApiSettings = document.getElementById('btn-save-api-settings');
        const btnCancelApiSettings = document.getElementById('btn-cancel-api-settings');
        const btnResetData = document.getElementById('btn-reset-data');

        const inputApiKey = document.getElementById('input-api-key');
        const inputBaseUrl = document.getElementById('input-base-url');
        const inputModel = document.getElementById('input-model');

        // 1. Initial Hydration: Load settings immediately so inputs aren't empty after refresh
        const hydrateSettings = async () => {
            try {
                // Try IndexedDB/Storage first
                const res = await window.appStorage.get(['ai_api_key', 'ai_base_url', 'ai_model']);

                // Fallback to LocalStorage (The "Bulletproof" Header)
                let apiKey = res.ai_api_key || localStorage.getItem('global_ai_api_key') || '';
                let baseUrl = res.ai_base_url || localStorage.getItem('global_ai_base_url') || 'https://api.deepseek.com';
                let model = res.ai_model || localStorage.getItem('global_ai_model') || 'deepseek-chat';

                if (inputApiKey) inputApiKey.value = apiKey;
                if (inputBaseUrl) inputBaseUrl.value = baseUrl;
                if (inputModel) inputModel.value = model;

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

        // 3. Save Logic
        if (btnSaveApiSettings) {
            btnSaveApiSettings.onclick = async () => {
                const apiKey = inputApiKey ? inputApiKey.value.trim() : '';
                const baseUrl = inputBaseUrl ? inputBaseUrl.value.trim() : 'https://api.deepseek.com';
                const model = inputModel ? inputModel.value.trim() : 'deepseek-chat';

                console.log('[Settings] Saving...', apiKey.slice(0, 4) + '***');

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

        if (btnCancelApiSettings) btnCancelApiSettings.onclick = () => apiDialog.classList.add('hidden');

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
        }

        // --- Global Nav Dock Visibility ---
        const navBar = document.getElementById('global-nav-bar');
        if (navBar) {
            // ONLY hide in these specific deep-level views or views with their own Local Dock
            // User requested that List views (notes-all, reading-all) AND Chat use the Global Dock.
            // We now keep it visible in Editor & Reader as per V4.0 request.
            const hideIn = ['browser', 'editor']; // Hide in browser and editor for focus
            if (hideIn.includes(viewId)) {
                navBar.classList.add('hidden');
            } else {
                navBar.classList.remove('hidden');
            }

            // Sync active state for the Home button
            const homeBtn = document.getElementById('nav-btn-home');
            if (homeBtn) {
                if (viewId === 'home') homeBtn.classList.add('active');
                else homeBtn.classList.remove('active');
            }

            // Snappy Page Render - for Home and List views
            if (viewId === 'home' || viewId === 'notes-all' || viewId === 'reading-all') {
                if (this.renderTimeout) clearTimeout(this.renderTimeout);
                this.renderTimeout = setTimeout(() => this.renderApp(), 10);
            }
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

    startVoiceRecognition(onFinished = null) {
        console.log('[Voice] Triggered');

        // Auto-recover from stale state
        if (this.isRecognitionActive && !this.currentRecognition) {
            console.warn('[Voice] Resetting stale active state');
            this.isRecognitionActive = false;
        }

        if (this.isRecognitionActive) {
            console.log('[Voice] Already active, ignoring');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('Speech recognition is not supported in this browser.');
            return;
        }

        // 1. Immediate UI Feedback (Crucial for UX)
        if (window.navigator.vibrate) window.navigator.vibrate(50);

        const holdBtn = document.getElementById('hold-to-talk');
        if (holdBtn) {
            holdBtn.classList.remove('hidden'); // Ensure visible
            holdBtn.style.backgroundColor = '#ff3b30'; // Red
            holdBtn.textContent = 'Listening...';
            holdBtn.classList.add('recording');
        }

        // Editor floating button feedback
        const editorVoiceBtn = document.getElementById('btn-editor-voice');
        if (editorVoiceBtn) editorVoiceBtn.style.color = '#ff3b30';

        const editorIndicator = document.getElementById('editor-voice-indicator');
        if (editorIndicator) editorIndicator.classList.remove('hidden');

        try {
            const recognition = new SpeechRecognition();
            this.currentRecognition = recognition;

            recognition.lang = 'zh-CN';
            recognition.interimResults = true;
            recognition.maxAlternatives = 1;
            recognition.continuous = true;

            recognition.onstart = () => {
                this.isRecognitionActive = true;
                console.log('[Voice] Engine Started');
                // Double confirm UI
                if (holdBtn) holdBtn.textContent = '说吧 (Listening)';
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

                // Visual feedback
                const displayText = (finalTranscript + interimTranscript).substring(0, 15) + '...';
                if (holdBtn && (finalTranscript || interimTranscript)) {
                    holdBtn.textContent = displayText;
                }
                if (editorIndicator && (finalTranscript || interimTranscript)) {
                    editorIndicator.textContent = displayText;
                }

                // Buffer logic
                this.voiceBuffer = (this.voiceBuffer || '') + finalTranscript;
            };

            recognition.onerror = (event) => {
                console.error('[Voice] Error:', event.error);

                // Allow restart on next try
                this.isRecognitionActive = false;

                // Ignore harmless errors
                if (event.error === 'no-speech' || event.error === 'aborted') {
                    return;
                }

                if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                    alert('⚠️ Microphone access denied. Please check permission settings (HTTPS required).');
                } else {
                    if (window.showToast) window.showToast('Voice Error: ' + event.error);
                }

                // Reset UI
                this.resetVoiceUI();
            };

            recognition.onend = () => {
                console.log('[Voice] Engine Ended');
                this.isRecognitionActive = false;
                this.currentRecognition = null;

                // Don't reset UI here immediately if we want to show 'Sending...', 
                // but for now, reset is safer.
                this.resetVoiceUI();

                // Process Buffer
                if (this.voiceBuffer && this.voiceBuffer.trim()) {
                    const text = this.voiceBuffer.trim();
                    this.voiceBuffer = '';
                    this.handleVoiceResult(text);
                }

                if (typeof onFinished === 'function') onFinished();
            };

            this.voiceBuffer = '';
            recognition.start();

        } catch (e) {
            console.error('[Voice] Start exception:', e);
            this.isRecognitionActive = false;
            this.resetVoiceUI();
            alert('Voice Start Failed: ' + e.message);
        }
    }

    resetVoiceUI() {
        const holdBtn = document.getElementById('hold-to-talk');
        if (holdBtn) {
            holdBtn.style.backgroundColor = '';
            holdBtn.textContent = '按住 说话';
            holdBtn.classList.remove('recording');
        }
        const editorVoiceBtn = document.getElementById('btn-editor-voice');
        if (editorVoiceBtn) editorVoiceBtn.style.color = '';

        const editorIndicator = document.getElementById('editor-voice-indicator');
        if (editorIndicator) {
            editorIndicator.classList.add('hidden');
            editorIndicator.textContent = 'Recording...';
        }
    }

    handleVoiceResult(text) {
        if (!text) return;
        if (this.activeView === 'editor' && window.mobileEditor) {
            window.mobileEditor.insertTextAtCursor(text);
        } else {
            // For global chat, send directly
            this.triggerUniversalSend({ value: text, id: 'voice-input' });
        }
    }

    stopVoiceRecognition(callback) {
        // Immediate UI feedback to show "Processing"
        const holdBtn = document.getElementById('hold-to-talk');
        if (holdBtn) holdBtn.textContent = 'Processing...';

        if (this.currentRecognition) {
            // Delay stop slightly to catch trailing audio
            setTimeout(() => {
                try {
                    if (this.currentRecognition) this.currentRecognition.stop();
                } catch (e) { console.log(e); }
            }, 500);
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

        // Navigate to chat view
        this.navigateTo('chat');

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

        if (titleEl) titleEl.innerText = data.title || 'Untitled Article';
        if (metaEl) {
            const domain = data.url ? new URL(data.url).hostname : 'Local Source';
            const time = data.updatedAt || data.timestamp || Date.now();
            const date = new Date(time).toLocaleString();
            metaEl.innerText = `${domain} • ${date}`;
        }

        if (contentEl) {
            // Enhanced Readability: Preserve some formatting
            contentEl.innerHTML = (data.content || data.text || '').replace(/\n/g, '<br>');
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
        } else {
            this.returnToChat = false;
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

    async renderApp(force = false) {
        if (!window.appStorage) return;

        // Smart Render Guard: Only fetch from IDB if cache is dirty or forced
        if (this.cacheDirty || force || !this.dataCache) {
            this.dataCache = await window.appStorage.getAll();
            this.cacheDirty = false;
        }

        // Performance: Skip UI update if we are in a deep view
        const shallowViews = ['home', 'notes-all', 'reading-all'];
        if (!force && !shallowViews.includes(this.activeView)) {
            return;
        }

        const all = this.dataCache;
        const noteMap = new Map(); // Use Map to deduplicate by ID
        const readerMap = {}; // For grouping

        const processItem = (val, key, arrayIdx = -1) => {
            if (!val || typeof val !== 'object') return;

            // 1. Recursive for Arrays (like user_notes)
            if (Array.isArray(val)) {
                val.forEach((sub, i) => processItem(sub, key, i));
                return;
            }

            // 2. Detection Logic
            const isNote = val.type === 'note' ||
                ((val.hasOwnProperty('content') || val.hasOwnProperty('text')) && !val.url) ||
                (key && (key.startsWith('note-') || key.startsWith('note_')));

            const isReading = (val.type === 'reading' ||
                val.url ||
                (key && (key.startsWith('http') || key.startsWith('meta_')))) &&
                !(key && key.startsWith('snapshot_')); // Exclude full snapshots

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
                        // [Auto-Clean Registry] If we found a redundant physical key, mark for background removal
                        if (existing._storageKey && existing._storageKey !== 'user_notes' && existing._storageKey !== key) {
                            window.appStorage.remove(existing._storageKey);
                        }
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
                    if (key !== 'user_notes' && key !== identity) {
                        window.appStorage.remove(key);
                    }
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
                const body = val.content || val.text || val.body || '';
                if (body && !readerMap[rKey].contents.includes(body)) {
                    readerMap[rKey].contents.push(body);
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
            // Skip config/system keys at root level
            const systemKeys = [
                'ai_api_key', 'ai_base_url', 'ai_model',
                'gdrive_client_id', 'gdrive_api_key', 'gdrive_root_folder',
                'settings', 'user_license_status', 'folder_structure'
            ];
            if (systemKeys.includes(key)) return;
            processItem(val, key);
        });

        const readings = Object.values(readerMap).map(r => {
            // Pre-process each snippet for proper HTML wrapping
            const processedContents = r.contents.map(c => {
                if (!c) return '';
                if (c.includes('<p>') || c.includes('<div') || c.includes('<br')) return c;
                return c.split('\n\n').map(p => `<p>${p.trim()}</p>`).join('');
            });

            return {
                ...r,
                content: processedContents.join('<hr style="border:none; border-top:1px dashed #ddd; margin:24px 0;">')
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

        // Render Home Summary (Top 10)
        this.renderNotes(filteredNotes.slice(0, 10), 'notes-list-container');
        this.renderReader(filteredReader.slice(0, 10), 'reader-list-container');

        // Render Full Lists
        this.renderNotes(filteredNotes, 'full-notes-container');
        this.renderReader(filteredReader, 'full-reader-container');
    }

    renderNotes(notes, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = notes.map((n) => {
            const displayTitle = n.title || 'Untitled Note';
            const body = n.content || n.text || '';
            const id = n.id;
            const parentKey = n._storageKey || '';

            // Format time: MM/DD HH:mm
            const timeVal = this.safeParseToNumber(n.updatedAt || n.timestamp);
            let dateStr = '';
            try {
                if (timeVal > 0) {
                    const d = new Date(timeVal);
                    const now = new Date();
                    const isToday = d.toDateString() === now.toDateString();

                    if (isToday) {
                        dateStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                    } else {
                        dateStr = d.toLocaleDateString([], { month: 'numeric', day: 'numeric' });
                    }
                }
            } catch (e) {
                dateStr = '';
            }

            return `
                <div class="note-item-wrapper" data-id="${id}" data-parent-key="${parentKey}" data-type="note">
                    <div class="note-card" data-type="note" data-id="${id}">
                        <div class="note-title-row">
                            <div class="note-title">${displayTitle}</div>
                            <div class="note-date-tag">${dateStr}</div>
                        </div>
                        <div class="note-preview">${this.stripHtml(body).substring(0, 80)}</div>
                    </div>
                    <div class="note-delete-action">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderReader(items, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = items.map(i => {
            const date = i.date || new Date(i.timestamp || Date.now()).toLocaleDateString();
            const parentKey = i._storageKey || '';
            return `
                <div class="note-item-wrapper" data-id="${i.id}" data-parent-key="${parentKey}" data-type="reader">
                    <div class="note-card" data-type="reader" data-id="${i.id}">
                        <div class="note-title">${i.title || 'Untitled Article'}</div>
                        <div class="note-preview">${date}</div>
                    </div>
                    <div class="note-delete-action">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </div>
                </div>
            `;
        }).join('');
    }

    stripHtml(html) {
        const doc = new Array();
        return html.replace(/<[^>]*>?/gm, '');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.mobileCore = new MobileApp();
    setTimeout(() => window.mobileCore.renderApp(), 500);
});
