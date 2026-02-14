/**
 * mobile-editor.js - Plain Text Optimized & Auto-Save (V11.0)
 */

class MobileEditor {
    constructor() {
        this.editor = document.querySelector('.editor-body');
        this.headerTitle = document.querySelector('.editor-header-title');
        this.currentNoteId = null;
        this.isSaved = true;
        this.autoSaveTimer = null;
        this.setupEditorEvents();
    }

    loadNote(noteId, noteData) {
        this.currentNoteId = noteId;
        if (this.headerTitle) this.headerTitle.innerText = noteData.title || '';
        if (this.editor) this.editor.innerHTML = noteData.content || '';
        this.isSaved = true;
        if (window.mobileCore) window.mobileCore.navigateTo('editor');

        // Auto-scroll to bottom on load
        setTimeout(() => this.scrollToBottom(), 100);
    }

    initNewNote() {
        this.currentNoteId = 'note-' + Date.now();
        if (this.headerTitle) this.headerTitle.innerText = '';
        if (this.editor) {
            this.editor.innerHTML = '';
            this.editor.focus();
        }
        this.isSaved = false;
        if (window.mobileCore) window.mobileCore.navigateTo('editor');
        this.scrollToBottom();
    }

    setupEditorEvents() {
        if (!this.editor) return;

        // Auto-save on input (Body)
        this.editor.oninput = () => {
            if (this.currentNoteId) {
                this.isSaved = false;
                this.triggerAutoSave();
            }
        };

        // Auto-save on input (Title)
        if (this.headerTitle) {
            this.headerTitle.oninput = () => {
                if (this.currentNoteId) {
                    this.isSaved = false;
                    this.triggerAutoSave();
                }
            };
        }

        this.editor.onkeydown = (e) => {
            if (e.key === 'Enter') {
                if (this.checkSlashCommand(e)) return;
                this.handleAutoList(e);
            }
        };

        // Slash button handler
        const slashBtn = document.getElementById('btn-editor-ai-slash');
        if (slashBtn) {
            slashBtn.onclick = () => {
                if (this.editor) {
                    this.editor.focus();
                    const selection = window.getSelection();
                    if (selection.rangeCount > 0) {
                        const range = selection.getRangeAt(0);
                        range.deleteContents();
                        document.execCommand('insertText', false, '@ai ');
                    } else {
                        this.editor.innerText += '@ai ';
                    }
                }
            };
        }

        // Voice button handler (Long Press to Talk)
        const voiceBtn = document.getElementById('btn-editor-voice');
        if (voiceBtn) {
            const startRecording = (e) => {
                e.preventDefault();
                if (window.navigator.vibrate) window.navigator.vibrate(50);
                voiceBtn.style.color = '#ff3b30'; // Red
                if (window.mobileCore) window.mobileCore.startVoiceRecognition();
            };

            const stopRecording = (e) => {
                e.preventDefault();
                voiceBtn.style.color = ''; // Reset
                if (window.mobileCore) window.mobileCore.stopVoiceRecognition();
            };

            voiceBtn.addEventListener('touchstart', startRecording, { passive: false });
            voiceBtn.addEventListener('touchend', stopRecording);
            voiceBtn.addEventListener('mousedown', startRecording);
            voiceBtn.addEventListener('mouseup', stopRecording);
            voiceBtn.addEventListener('mouseleave', stopRecording);
        }

        // Attachment Button Handler
        const attachBtn = document.getElementById('btn-editor-attach');
        if (attachBtn) {
            let fileInput = document.getElementById('editor-file-input');
            if (!fileInput) {
                fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.id = 'editor-file-input';
                fileInput.style.display = 'none';
                document.body.appendChild(fileInput);

                fileInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                            const result = evt.target.result;
                            if (file.type.startsWith('image/')) {
                                document.execCommand('insertHTML', false, `<br><img src="${result}" style="max-width:100%; border-radius:8px; margin:10px 0;"><br>`);
                            } else {
                                document.execCommand('insertHTML', false, `<br><a href="${result}" download="${file.name}">📎 ${file.name}</a><br>`);
                            }
                        };
                        reader.readAsDataURL(file);
                    }
                    fileInput.value = ''; // Reset
                });
            }

            attachBtn.onclick = (e) => {
                e.stopPropagation();
                fileInput.click();
            };
        }

        // Editor Menu Button
        const menuBtn = document.getElementById('btn-editor-menu');
        const menuOverlay = document.getElementById('editor-menu-overlay');
        const actEditorSave = document.getElementById('act-editor-save');
        const actEditorDelete = document.getElementById('act-editor-delete');
        const actEditorCancel = document.getElementById('act-editor-cancel');
        const actEditorShare = document.getElementById('act-editor-share');
        const actEditorRead = document.getElementById('act-editor-read');

        if (menuBtn && menuOverlay) {
            menuBtn.onclick = () => {
                menuOverlay.classList.remove('hidden');
            };
            menuOverlay.onclick = (e) => {
                if (e.target === menuOverlay) menuOverlay.classList.add('hidden');
            };
        }

        if (actEditorShare) {
            actEditorShare.onclick = async () => {
                menuOverlay.classList.add('hidden');
                const title = this.headerTitle?.innerText || 'Note';
                const text = this.editor?.innerText || '';
                if (navigator.share) {
                    try {
                        await navigator.share({
                            title: title,
                            text: text,
                        });
                    } catch (err) {
                        console.log('Share failed:', err);
                    }
                } else {
                    // Fallback to copy
                    navigator.clipboard.writeText(title + '\n\n' + text);
                    this.showToast('Copied to clipboard');
                }
            };
        }

        if (actEditorRead) {
            actEditorRead.onclick = () => {
                menuOverlay.classList.add('hidden');
                const text = this.editor?.innerText || '';
                if (!text) return;

                if (window.speechSynthesis.speaking) {
                    window.speechSynthesis.cancel();
                    this.showToast('Stopped reading');
                } else {
                    const utterance = new SpeechSynthesisUtterance(text);
                    utterance.rate = 1.0;
                    window.speechSynthesis.speak(utterance);
                    this.showToast('Reading aloud...');
                }
            };
        }

        if (actEditorSave) {
            actEditorSave.onclick = () => {
                menuOverlay.classList.add('hidden');
                this.saveNote();
            };
        }

        if (actEditorDelete) {
            actEditorDelete.onclick = async () => {
                if (this.currentNoteId && confirm('Delete this note permanently?')) {
                    menuOverlay.classList.add('hidden');
                    if (window.appStorage) {
                        const data = await window.appStorage.get('user_notes');
                        let notes = data.user_notes || [];
                        const filtered = notes.filter(n => n.id !== this.currentNoteId);
                        if (filtered.length !== notes.length) {
                            await window.appStorage.set({ user_notes: filtered });
                        }
                        await window.appStorage.remove(this.currentNoteId);
                        if (window.mobileCore) {
                            window.mobileCore.cacheDirty = true;
                            // Critical Fix: Target valid view ID 'notes' (not 'notes-all')
                            window.mobileCore.navigateTo('notes');
                            window.mobileCore.renderApp(true);
                        }
                        if (window.showToast) window.showToast('Note deleted', 1500);
                    }
                }
            };
        }

        if (actEditorCancel) {
            actEditorCancel.onclick = () => {
                menuOverlay.classList.add('hidden');
            };
        }

        this.setupFloatingToolbar();
    }

    /**
     * Floating Toolbar Interaction Controller (V8.0)
     */
    setupFloatingToolbar() {
        const capsule = document.querySelector('.editor-toolbar-capsule');
        if (!capsule) return;

        let autoCollapseTimer = null;
        let touchStartX = 0;
        let touchStartY = 0;
        let longPressTimer = null;
        let isLongPress = false;
        let isSwiping = false;

        const expand = () => {
            capsule.classList.remove('collapsed');
            resetAutoCollapse();
        };

        const collapse = () => {
            capsule.classList.add('collapsed');
            if (autoCollapseTimer) clearTimeout(autoCollapseTimer);
        };

        const resetAutoCollapse = () => {
            if (autoCollapseTimer) clearTimeout(autoCollapseTimer);
            autoCollapseTimer = setTimeout(collapse, 8000); // 8s inactivity
        };

        const startVoice = () => {
            if (!capsule.classList.contains('collapsed')) return;
            isLongPress = true;
            if (window.navigator.vibrate) window.navigator.vibrate(60);
            if (window.mobileCore) window.mobileCore.startVoiceRecognition();
        };

        const stopVoice = () => {
            if (isLongPress) {
                if (window.mobileCore) window.mobileCore.stopVoiceRecognition();
                isLongPress = false;
            }
        };

        // Touch Listeners
        capsule.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            isSwiping = false;
            isLongPress = false;

            if (capsule.classList.contains('collapsed')) {
                longPressTimer = setTimeout(startVoice, 600);
            }
        }, { passive: true });

        capsule.addEventListener('touchmove', (e) => {
            const deltaX = e.touches[0].clientX - touchStartX;
            const deltaY = e.touches[0].clientY - touchStartY;
            if (Math.abs(deltaX) > 15 || Math.abs(deltaY) > 15) {
                if (longPressTimer) clearTimeout(longPressTimer);
                isSwiping = true;
            }
        }, { passive: true });

        capsule.addEventListener('touchend', (e) => {
            if (longPressTimer) clearTimeout(longPressTimer);
            if (isLongPress) {
                stopVoice();
                return;
            }

            const deltaX = (e.changedTouches[0]?.clientX || 0) - touchStartX;

            if (capsule.classList.contains('collapsed')) {
                // === BALL STATE ===
                if (isSwiping && deltaX < -40) {
                    expand();
                } else if (!isSwiping) {
                    // Quick Click on BALL → Insert @ai
                    // PREVENT KEYBOARD HIDE
                    if (e.cancelable) e.preventDefault();
                    this.insertTextAtCursor('@ai ');
                    if (this.editor) this.editor.focus();
                }
            } else {
                // === EXPANDED STATE ===
                if (isSwiping && deltaX > 40) {
                    collapse();
                } else {
                    // Check if clicked exactly on a button (like Attach)
                    const targetBtn = e.target.closest('button');
                    if (targetBtn) {
                        resetAutoCollapse();
                        return; // Allow default click
                    }
                    resetAutoCollapse();
                }
            }
            isSwiping = false;
        }, { passive: false });

        capsule.querySelectorAll('.toolbar-btn-mini').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                resetAutoCollapse();
            });
        });
    }

    triggerAutoSave() {
        if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
        this.autoSaveTimer = setTimeout(() => {
            this.saveNote(true);
        }, 1500);
    }

    handleAutoList(e) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        const line = range.startContainer.textContent || '';
        if (line.match(/^\d+\.\s/)) {
            const num = parseInt(line.match(/^(\d+)\./)[1]);
            document.execCommand('insertHTML', false, `<br>${num + 1}.&nbsp;`);
            e.preventDefault();
        } else if (line.match(/^[\*\-]\s/)) {
            document.execCommand('insertHTML', false, '<br>•&nbsp;');
            e.preventDefault();
        }
    }

    checkSlashCommand(e) {
        const text = this.editor.innerText;
        const match = text.match(/[@/]ai(?:\s+(.*))?\s*$/);
        if (match) {
            e.preventDefault();
            const prompt = (match[1] || "").trim();
            this.editor.innerHTML = this.editor.innerHTML.replace(/[@/]ai(?:\s+.*)?\s*$/, '');
            this.streamAIContent(prompt || "整理内容并排版");
            return true;
        }
        return false;
    }

    insertTextAtCursor(text) {
        if (!text) return;
        if (this.editor) {
            this.editor.focus();
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                const node = document.createTextNode(text);
                range.insertNode(node);
                range.setStartAfter(node);
                range.setEndAfter(node);
                selection.removeAllRanges();
                selection.addRange(range);
            } else {
                this.editor.innerText += text;
            }
            this.triggerAutoSave();
        }
    }

    formatMarkdown(text) {
        return text
            .replace(/### (.*)/g, '<div style="display:inline-block; width:100%; font-weight:bold; font-size:17px;">$1</div>')
            .replace(/## (.*)/g, '<div style="display:inline-block; width:100%; font-weight:bold; font-size:18px;">$1</div>')
            .replace(/# (.*)/g, '<div style="display:inline-block; width:100%; font-weight:bold; font-size:20px;">$1</div>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/^- (.*)/gm, '<div style="margin-left:4px;">• $1</div>')
            .replace(/^\d+\. (.*)/gm, '<div style="margin-left:4px;">$1</div>')
            .replace(/\n{2,}/g, '\n')
            .replace(/\n/g, '<br>');
    }

    async streamAIContent(prompt) {
        if (!window.aiCore || !window.aiCore.config.apiKey) {
            this.showToast('⚠️ 未设置 API Key', 3000);
            return;
        }

        const responseDiv = document.createElement('div');
        responseDiv.className = 'ai-response';
        responseDiv.style.cssText = 'color: #000; padding: 4px 0; margin: 8px 0; font-size: 16px; line-height: 1.6;';
        responseDiv.innerHTML = '<span class="typing-indicator">●●●</span>';
        this.editor.appendChild(responseDiv);
        this.editor.scrollTop = this.editor.scrollHeight;

        try {
            const context = this.editor.innerText.slice(-800);
            const messages = [
                { role: 'system', content: '你是一个擅长逻辑架构与创意激发的笔记助手。能够根据上下文生成结构清晰、有深度的内容。请务必使用 Markdown 格式（如 # 标题、- 列表）来组织内容结构，确保段落分明，重点突出。' },
                { role: 'user', content: `上下文：${context}\n指令：${prompt}` }
            ];

            const stream = window.aiCore.streamChat(messages);
            let fullText = '';
            let hasToken = false;

            for await (const chunk of stream) {
                if (chunk.type === 'token') {
                    if (!hasToken) {
                        hasToken = true;
                        responseDiv.innerHTML = '';
                    }
                    fullText = chunk.fullText;
                    responseDiv.innerHTML = this.formatMarkdown(fullText);
                    this.editor.scrollTop = this.editor.scrollHeight;
                }
            }
            this.isSaved = false;
            this.saveNote(true);
        } catch (err) {
            responseDiv.innerHTML = `<div style="color:red; font-size:12px;">❌ 错误: ${err.message}</div>`;
        }
    }

    showToast(msg, duration = 2000) {
        let toast = document.getElementById('editor-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'editor-toast';
            toast.style.cssText = 'position:fixed; bottom:100px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:white; padding:8px 16px; border-radius:20px; z-index:5000; font-size:14px; transition: opacity 0.3s;';
            document.body.appendChild(toast);
        }
        toast.innerText = msg;
        toast.style.display = 'block';
        toast.style.opacity = '1';
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => { toast.style.display = 'none'; }, 300);
        }, duration);
    }

    async saveNote(isSilent = false) {
        console.log('[Editor] saveNote() called, currentNoteId:', this.currentNoteId);

        if (!this.currentNoteId) {
            console.warn('[Editor] No currentNoteId, aborting save');
            return;
        }

        let title = this.headerTitle?.innerText?.trim();
        const content = this.editor.innerHTML;
        const text = this.editor.innerText.trim();

        if (!title && !text) {
            return;
        }

        if (!title && text) {
            const firstLine = text.split('\n')[0].substring(0, 25).trim();
            if (firstLine) {
                title = firstLine;
                if (this.headerTitle) this.headerTitle.innerText = title;
            }
        }

        if (window.appStorage) {
            try {
                const data = await window.appStorage.get('user_notes');
                let notes = data.user_notes || [];

                const existingIndex = notes.findIndex(n => n.id === this.currentNoteId);

                const noteData = {
                    id: this.currentNoteId,
                    title: title || 'Untitled Note',
                    content: content,
                    type: 'note',
                    timestamp: existingIndex >= 0 ? notes[existingIndex].timestamp : Date.now(),
                    updatedAt: Date.now()
                };

                if (existingIndex >= 0) {
                    notes[existingIndex] = noteData;
                } else {
                    notes.unshift(noteData);
                }

                await window.appStorage.set({ user_notes: notes });

                this.isSaved = true;
                if (!isSilent) this.showToast('Saved');

                if (window.mobileCore) {
                    window.mobileCore.cacheDirty = true;
                    await window.mobileCore.renderApp(true);
                }
            } catch (e) {
                console.error('[Editor] Save failed:', e);
                this.showToast('Save Error: ' + e.message);
            }
        }
    }

    formatMarkdown(text) {
        return text
            // Markdown Headers
            .replace(/^### (.*)(\n|$)/gm, '<div style="display:block; width:100%; font-weight:bold; font-size:18px; margin:8px 0 2px; line-height:1.3;">$1</div>')
            .replace(/^## (.*)(\n|$)/gm, '<div style="display:block; width:100%; font-weight:bold; font-size:20px; margin:10px 0 4px; line-height:1.3;">$1</div>')
            .replace(/^# (.*)(\n|$)/gm, '<div style="display:block; width:100%; font-weight:bold; font-size:22px; margin:12px 0 6px; line-height:1.3;">$1</div>')

            // Auto-detect Chinese/Numeric Headers (e.g., "一、...", "1. ...") if not already marked
            // Regex matches start of line, number/char + dot/comma, and content. 
            // We assume short lines (< 30 chars) with this pattern are likely headers.
            .replace(/^([一二三四五六七八九十]+[、\.]\s*.*?)(\n|$)/gm, '<div style="display:block; width:100%; font-weight:bold; font-size:19px; margin:10px 0 4px; line-height:1.3;">$1</div>')

            // Bold
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

            // Lists
            .replace(/^- (.*)/gm, '<div style="margin-left:4px; line-height:1.4;">• $1</div>')
            .replace(/^\d+\. (.*)/gm, '<div style="margin-left:4px; line-height:1.4;">$1</div>')

            // Clean up newlines
            .replace(/\n{2,}/g, '\n') // Collapse multiple newlines
            .replace(/\n/g, '<br>'); // Convert remaining newlines
    }

    scrollToBottom() {
        const container = document.querySelector('.editor-content');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.mobileEditor = new MobileEditor();
    console.log('[Editor] MobileEditor initialized');
});
