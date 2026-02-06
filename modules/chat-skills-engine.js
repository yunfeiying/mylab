/**
 * ChatSkillsEngine.js - Extensible skill system for AI Chat
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
            name: 'Weather Forecast',
            patterns: [/(天气|气温|下雨|weather|forecast|气象)/i],
            async execute(query) {
                return new Promise((resolve) => {
                    chrome.runtime.sendMessage({ action: 'FETCH_URL_CONTENT', url: `https://wttr.in?format=3&m` }, (response) => {
                        if (response && response.success) {
                            resolve(`[Real-time Weather]: ${response.text.trim()}`);
                        } else {
                            resolve(null);
                        }
                    });
                });
            }
        });

        // 2. Movie Skill
        this.registerSkill({
            id: 'movies',
            name: 'Douban Movies',
            patterns: [/(电影|上映|排片|movie|cinema|film)/i],
            async execute(query) {
                return new Promise((resolve) => {
                    chrome.runtime.sendMessage({ action: 'FETCH_URL_CONTENT', url: 'https://m.douban.com/movie/' }, (response) => {
                        if (response && response.success) {
                            const titles = response.text.match(/[《](.*?)[》]/g) || [];
                            const uniqueTitles = [...new Set(titles)].slice(0, 8);
                            resolve(`[Real-time Movies (Douban)]: ${uniqueTitles.join(', ')}\n(Source: Douban Mobile)`);
                        } else {
                            resolve(null);
                        }
                    });
                });
            }
        });

        // 3. Search Skill
        this.registerSkill({
            id: 'baidu_search',
            name: 'Baidu Search',
            patterns: [/(搜索|查一下|查找|找一下|百度|search|who is|what is|find out)/i],
            async execute(query) {
                let searchQuery = query.replace(/(搜索|查一下|查找|找一下|百度|search|who is|what is|find out)/gi, '').trim();
                if (searchQuery.length < 2) return null;

                return new Promise((resolve) => {
                    const searchUrl = `https://m.baidu.com/s?word=${encodeURIComponent(searchQuery)}`;
                    chrome.runtime.sendMessage({ action: 'FETCH_URL_CONTENT', url: searchUrl }, (response) => {
                        if (response && response.success) {
                            let snippet = response.text.substring(0, 2500);
                            resolve(`[Baidu Search Results for "${searchQuery}"]: \n${snippet}\n---`);
                        } else {
                            resolve(null);
                        }
                    });
                });
            }
        });

        // 4. News Skill
        this.registerSkill({
            id: 'baidu_news',
            name: 'Baidu News',
            patterns: [/(新闻|消息|头条|动态|news|headlines|hot topics)/i],
            async execute(query) {
                return new Promise((resolve) => {
                    chrome.runtime.sendMessage({ action: 'FETCH_URL_CONTENT', url: 'https://news.baidu.com/' }, async (response) => {
                        if (response && response.success && response.html) {
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(response.html, 'text/html');
                            const links = Array.from(doc.querySelectorAll('a'))
                                .filter(a => a.textContent.trim().length > 6 && !a.href.includes('baidu.com/s?'))
                                .slice(0, 10);

                            let newsList = links.map((a, i) => {
                                let title = a.textContent.trim().replace(/\n/g, ' ');
                                let href = a.getAttribute('href') || '';
                                if (href.startsWith('//')) href = 'https:' + href;
                                else if (href.startsWith('/')) href = 'https://news.baidu.com' + href;
                                return `${i + 1}. [${title}](${href})`;
                            }).join('\n');

                            // Hot Searches
                            let hotInfo = "";
                            try {
                                const hotRes = await new Promise(r => chrome.runtime.sendMessage({ action: 'FETCH_URL_CONTENT', url: 'https://top.baidu.com/board?tab=realtime' }, r));
                                if (hotRes && hotRes.success) {
                                    const hotTitles = hotRes.text.match(/[^\s]{5,20}(?=\s\d{6,})/g) || [];
                                    if (hotTitles.length > 0) {
                                        hotInfo = `\n[Current Hot Searches]: \n${hotTitles.slice(0, 5).map((t, i) => `${i + 1}. ${t}`).join('\n')}`;
                                    }
                                }
                            } catch (e) { }

                            resolve(`[Real-time News Headlines]: \n${newsList}${hotInfo}`);
                        } else {
                            resolve(null);
                        }
                    });
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
