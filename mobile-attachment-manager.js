/**
 * mobile-attachment-manager.js - Handles File processing and attachments
 * Decoupled from mobile-chat.js to reduce file size.
 */

class MobileAttachmentManager {
    constructor(mobileChat) {
        this.chat = mobileChat;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    async handleAttachments(files) {
        for (const file of files) {
            const fileName = file.name || `attachment_${Date.now()}.${file.type.split('/')[1] || 'png'}`;
            const fileType = file.type;
            const sizeStr = this.formatFileSize(file.size);

            try {
                let extractedText = "";
                let base64 = null;  // For images
                let attachmentObj = null;

                if (fileType.startsWith('image/')) {
                    // Image Logic
                    const reader = new FileReader();
                    const result = await new Promise((resolve, reject) => {
                        reader.onload = async (e) => {
                            const b64 = e.target.result;

                            // 1. Show Preview Immediately
                            this.chat.addUserMessage(`[Image] ${fileName} - Processing OCR...`, true, {
                                type: 'image',
                                url: b64,
                                name: fileName
                            });

                            if (window.showToast) window.showToast('Extracting text...', 2000);

                            try {
                                const TESS = await this.loadLibrary('Tesseract', '../tesseract.min.js');
                                const worker = await TESS.createWorker('chi_sim+eng', 1, {
                                    workerPath: '../worker.min.js',
                                    corePath: '../tesseract-core.wasm.js',
                                    langPath: '../',
                                    logger: m => console.log('[Tesseract]', m)
                                });

                                let { data: { text } } = await worker.recognize(file);
                                await worker.terminate();

                                if (text) text = text.replace(/\s+/g, '').replace(/[|｜_]/g, '');
                                resolve({ text, base64: b64 });
                            } catch (err) { reject(err); }
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                    extractedText = result.text;
                    base64 = result.base64;
                    attachmentObj = { type: 'image', url: base64, name: fileName };

                } else {
                    // Generic File Logic
                    // 1. Show Preview Immediately
                    attachmentObj = {
                        type: 'file',
                        name: fileName,
                        size: sizeStr,
                        mime: fileType
                    };

                    this.chat.addUserMessage(`[Attachment] ${fileName} - Analyzing...`, true, attachmentObj);

                    extractedText = await this.processFile(file);
                }

                // SAVE AS PERMANENT RECORD
                await this.saveAttachmentAsRecord(file, extractedText, base64);

                if (extractedText) {
                    // 2. Perform automated analysis without RAG interference
                    // We don't need to re-echo the file, just the analysis.
                    const prompt = `分析刚刚上传的文件 "${fileName}" 的内容，并给出核心摘要（3-5点）：\n\n${extractedText}`;
                    const thinkingEl = this.chat.showAIThinking();
                    this.chat.isGenerating = true;
                    await this.chat.getAIResponse(prompt, thinkingEl, { skipKnowledge: true });
                    this.chat.isGenerating = false;
                } else {
                    this.chat.addAIMessage(`已收到文件 "${fileName}"，但未能提取到有效文字内容。`, false);
                }
            } catch (err) {
                console.error('File Processing Error:', err);
                this.chat.addAIMessage(`Error processing "${fileName}": ` + err.message, false);
            }
        }
    }

    async processFile(file) {
        const fileName = file.name.toLowerCase();

        if (fileName.endsWith('.docx')) {
            const mammoth = await this.loadLibrary('mammoth', '../lib/mammoth.browser.min.js');
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
            return result.value;
        }

        if (fileName.endsWith('.epub')) {
            const JSZip = await this.loadLibrary('JSZip', '../lib/jszip.min.js');
            return await this.extractEpubText(file, JSZip);
        }

        if (fileName.endsWith('.pdf')) {
            const arrayBuffer = await file.arrayBuffer();
            const typedarray = new Uint8Array(arrayBuffer);

            // Lazy load PDF.js
            if (!window.pdfjsLib) {
                const pdfjs = await import('../lib/pdf.mjs');
                window.pdfjsLib = pdfjs;
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = '../lib/pdf.worker.mjs';
            }

            const loadingTask = window.pdfjsLib.getDocument(typedarray);
            const pdf = await loadingTask.promise;
            let fullText = "";
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + "\n";
            }
            return fullText;
        }

        if (fileName.endsWith('.pptx')) {
            const JSZip = await this.loadLibrary('JSZip', '../lib/jszip.min.js');
            const zip = await JSZip.loadAsync(file);
            let fullText = "";
            const slideFiles = Object.keys(zip.files).filter(f => f.match(/^ppt\/slides\/slide\d+\.xml$/));
            slideFiles.sort((a, b) => {
                const numA = parseInt(a.match(/slide(\d+)\.xml/)[1]);
                const numB = parseInt(b.match(/slide(\d+)\.xml/)[1]);
                return numA - numB;
            });
            for (const slidePath of slideFiles) {
                const xmlText = await zip.file(slidePath).async("string");
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, "text/xml");
                const textNodes = xmlDoc.getElementsByTagName("a:t");
                for (let i = 0; i < textNodes.length; i++) fullText += textNodes[i].textContent + " ";
                fullText += "\n";
            }
            return fullText;
        }

        if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            const XLSX = await this.loadLibrary('XLSX', '../lib/xlsx.full.min.js');
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            let fullText = "";
            workbook.SheetNames.forEach(sheetName => {
                fullText += `\n[Sheet: ${sheetName}]\n`;
                const sheet = workbook.Sheets[sheetName];
                fullText += XLSX.utils.sheet_to_csv(sheet);
            });
            return fullText;
        }

        if (fileName.endsWith('.txt') || fileName.endsWith('.md') || fileName.endsWith('.js') || fileName.endsWith('.json')) {
            return await file.text();
        }

        throw new Error("Unsupported file format for direct processing.");
    }

    async loadLibrary(globalName, path) {
        if (window[globalName]) return window[globalName];
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = path;
            script.onload = () => resolve(window[globalName]);
            script.onerror = () => reject(new Error(`Failed to load library: ${globalName}`));
            document.head.appendChild(script);
        });
    }

    async extractEpubText(file, JSZip) {
        const zip = await JSZip.loadAsync(file);
        let fullText = "";
        const parser = new DOMParser();

        try {
            // 1. Locate OPF via container.xml
            const containerXml = await zip.file("META-INF/container.xml").async("string");
            const containerDoc = parser.parseFromString(containerXml, "text/xml");
            const rootfile = containerDoc.querySelector("rootfile");
            if (!rootfile) throw new Error("No rootfile in container.xml");

            const opfPath = rootfile.getAttribute("full-path");
            const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

            // 2. Parse OPF to get Spin (reading order)
            const opfXml = await zip.file(opfPath).async("string");
            const opfDoc = parser.parseFromString(opfXml, "text/xml");

            // Map ID -> Href
            const manifestItems = opfDoc.querySelectorAll("manifest > item");
            const manifest = {};
            manifestItems.forEach(item => {
                manifest[item.getAttribute("id")] = item.getAttribute("href");
            });

            // Iterate Spine
            const spineItems = opfDoc.querySelectorAll("spine > itemref");
            for (const item of spineItems) {
                const id = item.getAttribute("idref");
                let href = manifest[id];
                if (!href) continue;

                href = decodeURIComponent(href);
                // Fix path resolution (simplify relative paths)
                const fullPath = opfDir + href;

                // Fallback for some weird epub paths
                const fileInZip = zip.file(fullPath) || zip.file(href);

                if (fileInZip) {
                    const content = await fileInZip.async("string");
                    const doc = parser.parseFromString(content, "text/html");

                    // Remove Style/Script for cleaner text
                    doc.querySelectorAll('style, script').forEach(el => el.remove());

                    // Preserve Paragraphs: Extract text from <p> tags explicitly if they exist
                    const paragraphs = doc.querySelectorAll('p');
                    let chapterText = "";

                    if (paragraphs.length > 0) {
                        paragraphs.forEach(p => {
                            const pText = p.innerText.trim();
                            if (pText) chapterText += pText + "\n\n";
                        });
                    } else {
                        // Fallback to body text if no <p> tags found
                        chapterText = doc.body ? doc.body.innerText : (doc.documentElement ? doc.documentElement.textContent : "");
                    }

                    if (chapterText && chapterText.trim().length > 0) {
                        fullText += `\n\n--- [Chapter: ${href}] ---\n\n${chapterText.trim()}\n`;
                    }
                }
            }
        } catch (e) {
            console.warn("[EPUB] Strict parsing failed, using fallback:", e);
            // Fallback: Dump all HTML/XHTML files found
            const htmlFiles = Object.keys(zip.files).filter(f => f.match(/\.(html|xhtml|htm)$/i));
            // Naive sort by filename length/alpha might not be correct reading order, but better than nothing
            htmlFiles.sort();

            for (const path of htmlFiles) {
                if (path.includes('nav.xhtml') || path.includes('toc.xhtml')) continue;
                const content = await zip.file(path).async("string");
                const doc = parser.parseFromString(content, "text/html");
                doc.querySelectorAll('style, script').forEach(el => el.remove());

                // Preserve Paragraphs in fallback
                const paragraphs = doc.querySelectorAll('p');
                let chapterText = "";
                if (paragraphs.length > 0) {
                    paragraphs.forEach(p => {
                        const pText = p.innerText.trim();
                        if (pText) chapterText += pText + "\n\n";
                    });
                } else {
                    chapterText = doc.body ? doc.body.innerText : "";
                }

                if (chapterText.trim()) fullText += `\n\n--- ${path} ---\n\n${chapterText.trim()}\n`;
            }
        }

        return fullText || "Unable to extract text from this EPUB.";
    }

    async saveAttachmentAsRecord(file, extractedText = '', base64 = null) {
        if (!window.appStorage) return;

        const timestamp = Date.now();
        const id = 'attach_' + timestamp;

        // --- 1. Intelligent Content Formatting ---
        let finalContent = `<p>File attached: <strong>${file.name}</strong></p>`;

        if (extractedText) {
            // Split by double newline to preserve paragraphs (Standard Markdown/Text behavior)
            const paragraphs = extractedText.split(/\n\s*\n/);

            // Reconstruct as HTML with indentation-friendly tags
            finalContent = paragraphs.map(p => {
                const trimmed = p.trim();
                if (!trimmed) return '';

                // Handle Chapter/Section headers (detected from our specific format or markdown headers)
                if (trimmed.startsWith('--- [Chapter:') || trimmed.match(/^--- .* ---$/) || trimmed.startsWith('# ')) {
                    return `<h3>${trimmed.replace(/---|\[Chapter:|\]/g, '').trim()}</h3>`;
                }

                // Standard paragraph
                return `<p>${trimmed}</p>`;
            }).join('');

            // Fallback if empty or single block
            if (!finalContent) finalContent = `<p>${extractedText}</p>`;
        }

        // Determine nice prefix
        let prefix = '[File]';
        if (file.name.toLowerCase().endsWith('.epub')) prefix = '[Book]';
        else if (file.name.toLowerCase().endsWith('.pdf')) prefix = '[PDF]';

        const record = {
            id: id,
            type: 'reading', // SAVE AS READING to appear in Reader section
            title: `${prefix} ${file.name.replace(/\.[^/.]+$/, "")}`,
            content: finalContent, // HTML structure for Reader view
            text: extractedText,   // Raw text for search/AI
            timestamp: timestamp,
            updatedAt: timestamp,
            fileType: file.type,
            fileName: file.name,
            fileSize: file.size,
            isAttachment: true,
            rawText: extractedText
        };

        if (base64) record.imagePreview = base64;

        await window.appStorage.set({ [id]: record });
        if (window.mobileCore) window.mobileCore.renderApp();
    }
}
