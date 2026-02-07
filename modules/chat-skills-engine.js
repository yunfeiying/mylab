/**
 * ChatSkillsEngine.js - Extensible skill system for AI Chat (V10.12 Web/Hybrid)
 * Managed by PureJS Tech Lead
 */

class ChatSkillsEngine {
    constructor() {
        this.skills = new Map();
        this.initDefaultSkills();
    }

    initDefaultSkills() {
        // 1. Weather Skill
        this.registerSkill({
            id: 'weather',
            name: 'Weather',
            execute: async (query) => {
                // 1. Try wttr.in (Simple Text)
                try {
                    const res = await fetch('https://wttr.in?format=3');
                    if (res.ok) return `[Weather]: ${await res.text()}`;
                } catch (e) { console.log('wttr.in failed, switching to Geolocation strategy...'); }

                // 2. "Figure it out": Geo-IP + Open-Meteo (CORS Friendly, No Key)
                try {
                    // Get Location
                    const locRes = await fetch('https://ipwho.is/');
                    if (!locRes.ok) throw new Error('Geo-IP failed');
                    const loc = await locRes.json();

                    if (loc.success) {
                        // Get Weather
                        const wUrl = `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current_weather=true&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
                        const wRes = await fetch(wUrl);
                        const wData = await wRes.json();

                        if (wData.current_weather) {
                            const c = wData.current_weather;
                            return `[Real-time Weather (Auto-Located: ${loc.city}, ${loc.country})]:
- Temp: ${c.temperature}°C
- Wind: ${c.windspeed} km/h
- Status: Code ${c.weathercode} (0=Clear, 1-3=Cloudy, >50=Rain/Snow)`;
                        }
                    }
                } catch (e) { console.error('Auto-Weather strategy failed:', e); }

                return null; // Let AI fallback to general knowledge or apology if ALL fails
            }
        });

        // 2. Movie Skill
        this.registerSkill({
            id: 'movies',
            name: 'Douban Movies',
            patterns: [/(电影|上映|排片|movie|cinema|film)/i],
            execute: async (query) => {
                const url = 'https://m.douban.com/movie/';

                if (window.chrome && window.chrome.runtime && window.chrome.runtime.sendMessage) {
                    const res = await new Promise(r => chrome.runtime.sendMessage({ action: 'FETCH_URL_CONTENT', url }, r));
                    if (res && res.success) {
                        const titles = res.text.match(/[《](.*?)[》]/g) || [];
                        const uniqueTitles = [...new Set(titles)].slice(0, 8);
                        return `[Real-time Movies (Douban)]: ${uniqueTitles.join(', ')}\n(Source: Douban Mobile)`;
                    }
                }

                return `[Web Mode]: Cannot fetch Douban data directly due to CORS.\nClick to view: [Douban Movies](${url})`;
            }
        });

        // 3. Search Skill
        this.registerSkill({
            id: 'baidu_search',
            name: 'Baidu Search',
            patterns: [/(搜索|查一下|查找|找一下|百度|search|who is|what is|find out)/i],
            execute: async (query) => {
                let searchQuery = query.replace(/(搜索|查一下|查找|找一下|百度|search|who is|what is|find out)/gi, '').trim();
                if (searchQuery.length < 2) return null;
                const searchUrl = `https://m.baidu.com/s?word=${encodeURIComponent(searchQuery)}`;

                if (window.chrome && window.chrome.runtime && window.chrome.runtime.sendMessage) {
                    const res = await new Promise(r => chrome.runtime.sendMessage({ action: 'FETCH_URL_CONTENT', url: searchUrl }, r));
                    if (res && res.success) {
                        return `[Baidu Search Results for "${searchQuery}"]: \n${res.text.substring(0, 2500)}\n---`;
                    }
                }

                return `[Web Mode]: Search capabilities are limited in the browser.\nClick to search: [Baidu: ${searchQuery}](${searchUrl})`;
            }
        });

        // 4. News Skill
        this.registerSkill({
            id: 'baidu_news',
            name: 'Baidu News',
            patterns: [/(新闻|消息|头条|动态|news|headlines|hot topics)/i],
            execute: async (query) => {
                const url = 'https://news.baidu.com/';

                if (window.chrome && window.chrome.runtime && window.chrome.runtime.sendMessage) {
                    const res = await new Promise(r => chrome.runtime.sendMessage({ action: 'FETCH_URL_CONTENT', url }, r));
                    if (res && res.success && res.html) {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(res.html, 'text/html');
                        const links = Array.from(doc.querySelectorAll('a'))
                            .filter(a => a.textContent.trim().length > 6 && !a.href.includes('baidu.com/s?'))
                            .slice(0, 10);
                        const newsList = links.map((a, i) => {
                            let title = a.textContent.trim().replace(/\n/g, ' ');
                            let href = a.getAttribute('href') || '';
                            if (href.startsWith('//')) href = 'https:' + href;
                            else if (href.startsWith('/')) href = 'https://news.baidu.com' + href;
                            return `${i + 1}. [${title}](${href})`;
                        }).join('\n');
                        return `[Real-time News Headlines]: \n${newsList}`;
                    }
                }

                return `[Web Mode]: Cannot background fetch news.\nView Top News: [Baidu News](${url})`;
            }
        });

        // 5. Daily Briefing Skill (Market Scout)
        this.registerSkill({
            id: 'daily_briefing',
            name: 'Daily Briefing',
            patterns: [/(每日复盘|复盘|daily review|daily briefing|财经早报|市场总结)/i],
            async execute(query) {
                return new Promise(async (resolve) => {
                    const searchUrl = `https://m.baidu.com/s?word=${encodeURIComponent('今日财经新闻 全球股市 黄金 原油 重大事件')}`;
                    const newsUrl = 'https://news.baidu.com/';

                    // WEB ENVIRONMENT CHECK (CORS Limitation)
                    if (!window.chrome || !window.chrome.runtime || !window.chrome.runtime.sendMessage) {
                        resolve(`[SYSTEM INFO: WEB MODE DETECTED]
无法在纯网页环境进行后台跨域抓取。
请按以下格式回复用户：

⚠️ **网页版功能受限**
由于浏览器安全策略，网页版无法自动抓取实时财经数据。请使用插件版，或直接点击下方链接查看：

1. [百度财经搜索](${searchUrl})
2. [百度新闻头条](${newsUrl})

(不要生成任何其他内容)`);
                        return;
                    }

                    // 1. Fetch Market Overview search
                    let context = "";

                    try {
                        const searchRes = await new Promise(r => chrome.runtime.sendMessage({ action: 'FETCH_URL_CONTENT', url: searchUrl }, r));
                        if (searchRes && searchRes.success) {
                            context += `[Source: Baidu Search - Market Data]\n${searchRes.text.substring(0, 3000)}\n\n`;
                        }
                    } catch (e) { console.warn('Search fetch failed', e); }

                    // 2. Fetch News Home for Headlines
                    try {
                        const newsRes = await new Promise(r => chrome.runtime.sendMessage({ action: 'FETCH_URL_CONTENT', url: 'https://news.baidu.com/' }, r));
                        if (newsRes && newsRes.success) {
                            context += `[Source: Baidu News - Headlines]\n${newsRes.text.substring(0, 2000)}\n\n`;
                        }
                    } catch (e) { console.warn('News fetch failed', e); }

                    if (context.length > 100) {
                        resolve(`[DATA FOR DAILY REVIEW]:\n${context}\n\n[STRICT FORMAT INSTRUCTION]:
[角色设定]: 你是一位资深的财经新闻编辑。
[核心任务]: 根据以上提供的实时数据，直接生成一份极其精炼的“每日复盘”简报。
[绝对禁止]: 不要输出任何开场白、方法论介绍或“核心三问复盘法”之类的理论内容。

请严格完全照搬以下格式输出（日期替换为今日）：

2026xxxx 周x 【24h热点】
1. [全球市场]: 简单列出标普/纳指/A股/恒指/黄金的涨跌数据（如在数据中找到）。
2. [新闻]: ...
3. [新闻]: ...
...
[玫瑰]【24h前瞻】
1. TIME [事件描述]
2. TIME [事件描述]

(如果在数据中找不到确切的未来时间点事件，请根据常识或数据中提到的即将发生的事件列出1-2条即可)`);
                    } else {
                        resolve(null);
                    }
                });
            }
        });

        // 6. Hot Trends Skill
        this.registerSkill({
            id: 'hot_trends',
            name: 'Trending Topics',
            patterns: [/(值得关注|热点|hot topics|trending|what's new|whats new|热门|热搜|news)/i],
            async execute(query) {
                return new Promise(async (resolve) => {
                    const baiduHotUrl = 'https://top.baidu.com/board?tab=realtime';
                    const weiboHotUrl = 'https://s.weibo.com/top/summary';

                    // Strategy 1: Extension Background Fetch (Best Quality)
                    let content = "";
                    let fetchSuccess = false;

                    if (window.chrome && window.chrome.runtime && window.chrome.runtime.sendMessage) {
                        try {
                            const res = await new Promise(r => chrome.runtime.sendMessage({ action: 'FETCH_URL_CONTENT', url: baiduHotUrl }, r));
                            if (res && res.success) {
                                const hotTitles = res.text.match(/[^\s]{4,30}(?=\s\d{5,})/g) || [];
                                const uniqueTitles = [...new Set(hotTitles)].slice(0, 15);
                                if (uniqueTitles.length > 0) {
                                    content = `[Real-time Hot Topics (Source: Baidu Hot)]:\n${uniqueTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n`;
                                    fetchSuccess = true;
                                }
                            }
                        } catch (e) { console.warn('Extension fetch failed, trying fallback...'); }
                    }

                    // Strategy 2: Web Mode Fallback (RSS2JSON Proxy)
                    if (!fetchSuccess) {
                        try {
                            // Use Baidu Civil News RSS via RSS2JSON to bypass CORS
                            // Using a consistent, public proxy to fetch headers
                            const rssApi = 'https://api.rss2json.com/v1/api.json?rss_url=http%3A%2F%2Fnews.baidu.com%2Fn%3Fcmd%3D1%26class%3Dcivilnews%26tn%3Drss';
                            const res = await fetch(rssApi);
                            if (res.ok) {
                                const data = await res.json();
                                if (data && data.items) {
                                    content = `[Real-time News (Source: Baidu RSS)]:\n${data.items.slice(0, 10).map((item, i) => `${i + 1}. [${item.title}](${item.link})`).join('\n')}\n`;
                                    fetchSuccess = true;
                                }
                            }
                        } catch (e) { console.warn('RSS fallback failed'); }
                    }

                    // Final Output Construction
                    if (fetchSuccess) {
                        content += `\n[More Live Data]:\n- [Weibo Hot Search](${weiboHotUrl})\n- [Baidu Hot Search](${baiduHotUrl})`;
                        resolve(content);
                        return;
                    }

                    // Strategy 3: Graceful Link Fallback (No Error Message)
                    resolve(`[DATA STREAM]:
Unable to retrieve plain text list at this moment. Please verify live status via direct feeds:

1. [Baidu Real-time Hot](${baiduHotUrl})
2. [Weibo Top Summary](${weiboHotUrl})

(Present these links immediately to the user)`);
                    return;

                });
            }
        });

        // 7. Stock Sniper Skill (Technical Pullback)
        this.registerSkill({
            id: 'stock_hunt',
            name: 'Stock Sniper',
            patterns: [/(推荐股票|值得关注的股票|潜力股|stock pick|bullish stock|what stock|买什么股)/i],
            async execute(query) {
                return new Promise(async (resolve) => {
                    // Logic: Search for "Technical Pullback" (Active 3-5 days, Down 2-3 days)
                    // Keywords: "Strong stock" + "Pullback"
                    const searchUrl = `https://m.baidu.com/s?word=${encodeURIComponent('近期强势股缩量回调名单 热门资金回调')}`;

                    let content = "";
                    let fetchSuccess = false;

                    // 1. Extension Fetch
                    if (window.chrome && typeof window.chrome.runtime !== 'undefined' && typeof window.chrome.runtime.sendMessage === 'function') {
                        try {
                            const res = await new Promise(r => chrome.runtime.sendMessage({ action: 'FETCH_URL_CONTENT', url: searchUrl }, r));
                            if (res && res.success) {
                                content = `[Strategy: Active 3-5d, Pullback 2-3d]\n[Raw Search Data]:\n${res.text.substring(0, 3000)}\n`;
                                fetchSuccess = true;
                            }
                        } catch (e) { }
                    }

                    if (fetchSuccess) {
                        resolve(`${content}
[MANDATORY INSTRUCTION]:
The user demands CONCRETE RESULTS, NOT THEORY.
1. Analyze the raw search snippets for specific Stock Names/Codes that are mentioned as "Strong/Hot" but currently "Pulling back/Adjusting".
2. Select 3-5 candidates from the text.
3. Format each line as: **Name (Code if found)**: Brief reason based on the text.
4. DO NOT write an introduction. DO NOT write a disclaimer. DO NOT explain the strategy. JUST THE LIST.
`);
                    } else {
                        // 2. Graceful Link
                        resolve(`[DATA STREAM]:
Unable to auto-scan market data. Please view this pre-configured strategy search:

🔗 [Strategy: Strong Stocks Pullback (Click to see results)](${searchUrl})

(Directly provide this link to the user)`);
                    }
                });
            }
        });
    }

    registerSkill(skill) {
        this.skills.set(skill.id, skill);
    }

    async run(query) {
        let contexts = [];
        for (const [id, skill] of this.skills) {
            const matched = skill.patterns.some(p => query.match(p));
            if (matched) {
                console.log(`[SkillsEngine] Triggered: ${skill.name}`);
                if (window.showToast) window.showToast(`Skill: ${skill.name}...`, 1000);
                const result = await skill.execute(query);
                if (result) contexts.push(result);
            }
        }
        return contexts.join('\n\n');
    }

    /**
     * Skill Supplementation: Allows adding skills dynamically from an object
     * This can be called when AI proposes a new skill.
     */
    async addDynamicSkill(config) {
        // config example: { id: 'crypto', name: 'Crypto Price', patterns: [...], apiUrl: '...' }
        // We'll implement a 'Generic Fetch Skill' template for dynamic skills
        const newSkill = {
            id: config.id,
            name: config.name,
            patterns: config.patterns.map(p => new RegExp(p, 'i')),
            async execute(query) {
                try {
                    // Logic for dynamic skills usually involves fetching a URL and extracting info
                    if (config.apiUrl) {
                        const res = await fetch(config.apiUrl.replace('{query}', encodeURIComponent(query)));
                        if (res.ok) {
                            const data = await res.json();
                            // Simple mapping logic would be defined in config
                            return `[${config.name} Data]: ${JSON.stringify(data).substring(0, 500)}`;
                        }
                    }
                } catch (e) { return null; }
            }
        };
        this.registerSkill(newSkill);
        // Persist to IDB
        if (window.idb) {
            const savedSkills = await window.idb.get('user_custom_skills') || [];
            savedSkills.push(config);
            await window.idb.set('user_custom_skills', savedSkills);
        }
    }

    async loadCustomSkills() {
        if (!window.idb) return;
        const savedSkills = await window.idb.get('user_custom_skills') || [];
        savedSkills.forEach(conf => this.addDynamicSkill(conf));
    }
}

// Export
window.chatSkillsEngine = new ChatSkillsEngine();
window.chatSkillsEngine.loadCustomSkills();
