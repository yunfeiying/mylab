/**
 * notes-ai.js
 * Handles all AI instructions, library knowledge retrieval, and markdown formatting.
 */

window.handleInlineAI = async function (block, query, originalText, fullText, providedId = null) {
    const uniqueId = providedId || ('ai-stream-' + Date.now());
    const title = document.getElementById('note-title').value || "Untitled";

    let dbContext = "";
    const lowerQuery = query.toLowerCase();

    // --- Detect Skills ---
    let skillSystemPrompt = null;
    let skillQuery = query;
    const skillMatch = query.match(/^[:：]([a-z0-9-]+)([:：\s]+(.*))?$/i);

    if (skillMatch) {
        const skillId = skillMatch[1].toLowerCase();
        const skill = window.getAISkill ? window.getAISkill(skillId) : null;
        if (skill) {
            skillSystemPrompt = skill.systemPrompt;
            skillQuery = skillMatch[3] || "";
            if (!skillQuery.trim()) {
                const prevBlock = block.previousElementSibling;
                if (prevBlock) skillQuery = prevBlock.innerText.trim();
            }
        }
    }

    const routedDomain = window.routeQuery ? window.routeQuery(query) : null;
    if (routedDomain && !skillSystemPrompt) {
        skillSystemPrompt = routedDomain.systemPrompt;
    }

    if (!providedId) {
        let placeholder = "AI is processing...";
        if (skillMatch) placeholder = `AI Skill: ${skillMatch[1]}...`;
        else if (routedDomain) placeholder = `Expert: ${routedDomain.name}...`;
        insertPlaceholder(uniqueId, placeholder);
    }

    let verticalContext = "";
    const isAboveRequest = query.includes("上面") || query.includes("以上") || query.includes("此前") || lowerQuery.includes("above");
    if (isAboveRequest) {
        let prev = block.previousElementSibling;
        const aboveLines = [];
        while (prev) {
            const text = prev.innerText.trim();
            if (text) aboveLines.unshift(text);
            prev = prev.previousElementSibling;
        }
        if (aboveLines.length > 0) verticalContext += `[CONTEXT_ABOVE]:\n${aboveLines.join('\n')}\n\n`;
    }

    const localKeywords = ["标亮", "highlight", "highlighti", "库里", "收藏", "今天", "最近", "原文", "搜索", "查询", "查找", "本地", "全库"];
    const hasLocalTrigger = localKeywords.some(t => lowerQuery.includes(t));
    if (hasLocalTrigger) {
        const searchKwd = query.replace(/(请将|请帮我|帮我|本地|知识库|资料|素材|相关|查找|搜索|总结|汇总|整理|一下|标亮|内容|全库|有关|的内容|关于|分析|highlighti|highlight|原文|输出|不要改动)/gi, "").trim();
        const libraryDocs = await fetchLibraryData(searchKwd || "");
        if (libraryDocs.length > 0) {
            dbContext += `[RAW_LIBRARY_HIGHLIGHTS]:\n` + libraryDocs.map(l => `Document: ${l.title}\nHighlights:\n${l.content}`).join('\n---\n') + "\n\n";
        }
    }

    const contextWindow = 3000;
    const commandIdx = fullText.lastIndexOf(originalText);
    const localContext = commandIdx > 0 ? fullText.substring(0, commandIdx).trim().slice(-contextWindow) : "";
    const globalContext = fullText.substring(0, 1000);

    const systemPromptAssistant = skillSystemPrompt || `You are a professional writing assistant. 
Match user language. Concise output. 
You can use specialized actions for productivity:
- To create a table: [[ACTION:INSERT_TABLE|{"headers":["H1","H2"],"rows":[["R1C1","R1C2"]]}]]
- To add tasks: [[ACTION:ADD_TODO|{"tasks":["Task 1","Task 2"]}]]
`;

    const messages = [
        { role: "system", content: systemPromptAssistant },
        {
            role: "user",
            content: `CONTEXT:\n${globalContext}\n${dbContext}\n${verticalContext}\n${localContext}\n\nINSTRUCTION: ${skillQuery}`
        }
    ];

    await runInlineAI_Core(messages, uniqueId, window.currentNoteId, query, block);
};

async function runInlineAI_Core(messages, elementId, noteIdAtStart, query, commandBlock = null) {
    const checkEl = document.getElementById(elementId);
    if (!checkEl || !window.aiCore) return;

    try {
        checkEl.innerText = '';
        checkEl.className = 'ai-generated-span';
        let fullText = "";
        const stream = window.aiCore.streamChat(messages);

        for await (const chunk of stream) {
            if (window.currentNoteId !== noteIdAtStart) return;
            const el = document.getElementById(elementId);
            if (!el) return;

            if (chunk.type === 'token') {
                fullText = chunk.fullText;
                el.innerHTML = renderMarkdown(fullText);
                el.classList.remove('ai-loading-placeholder');
            }
        }

        // --- Tool Dispatch Phase ---
        if (window.toolDispatcher) {
            await window.toolDispatcher.dispatch(fullText);
        }

        // --- Memory Phase ---
        if (window.memoryAgent) {
            // Process the interaction for memory background extraction
            window.memoryAgent.processInteraction(query, fullText);
        }

        const finalEl = document.getElementById(elementId);
        if (finalEl) {
            finalEl.removeAttribute('id');
            // If we have a command block (the /ai line), remove it to make it "disappear"
            if (commandBlock && commandBlock.parentNode) {
                commandBlock.remove();
            }
            if (typeof saveCurrentNote === 'function') saveCurrentNote(true);
        }
    } catch (e) {
        if (checkEl) checkEl.innerText = `[AI Error: ${e.message}]`;
    }
}

function renderMarkdown(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/\n+/g, '<br>');
}

async function fetchLibraryData(query = "") {
    const cached = await chrome.storage.local.get('library_metadata_index');
    const index = cached.library_metadata_index?.data || [];
    let filtered = [];

    if (!query) return [];

    const keywords = query.toLowerCase().match(/[\w\u4e00-\u9fa5]{2,}/g) || [];

    // Weighted search: Title (1pt), Tags (3pts)
    const scoredIndex = index.map(item => {
        let score = 0;
        const lowerTitle = (item.title || "").toLowerCase();
        const lowerTags = (item.tags || []).join(',').toLowerCase();

        keywords.forEach(kw => {
            if (lowerTags.includes(kw)) score += 3;
            if (lowerTitle.includes(kw)) score += 1;
        });
        return { ...item, score };
    }).filter(i => i.score > 0);

    scoredIndex.sort((a, b) => b.score - a.score);

    const urls = scoredIndex.slice(0, 10).map(i => i.url);
    const data = await chrome.storage.local.get(urls);

    return urls.map(url => ({
        url,
        title: data[url]?.[0]?.title || "Untitled",
        content: data[url]?.map(it => it.text || "").join('\n').substring(0, 4000) || ""
    })).filter(a => a.content);
}

function insertPlaceholder(id, text) {
    const sel = window.getSelection();
    if (sel.rangeCount) {
        const placeholderHtml = `<br><span id="${id}" class="ai-loading-placeholder">${text}</span>`;
        document.execCommand('insertHTML', false, placeholderHtml);
    }
}

window.performCommandAction = function (lineText, block, sel) {
    if (lineText.match(/^\/(ai|smart|ppt|report)/i)) {
        const uniqueId = 'ai-stream-' + Date.now();
        const placeholder = "AI is processing...";
        block.innerHTML = `<b>${lineText.substring(1)}</b>`;
        const aiBlock = document.createElement('div');
        aiBlock.className = 'ai-generated-block';
        aiBlock.innerHTML = `<span id="${uniqueId}" class="ai-loading-placeholder">${placeholder}</span>`;
        block.parentNode.insertBefore(aiBlock, block.nextSibling);

        window.handleInlineAI(block, lineText.substring(1), lineText, document.getElementById('note-body').innerText, uniqueId);

        const newRange = document.createRange();
        newRange.selectNodeContents(aiBlock);
        newRange.collapse(false);
        sel.removeAllRanges();
        sel.addRange(newRange);
        if (typeof saveCurrentNote === 'function') saveCurrentNote(true);
    } else {
        if (window.insertNewline) window.insertNewline(block, sel);
    }
};
