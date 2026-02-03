/**
 * AI Skills Module - Predefined AI behaviors and prompts
 * 
 * Each skill has a name, id, description, and system prompt.
 * Skills can be accessed via /ai:id or through the slash menu.
 */

const AISkills = [
    {
        id: 'summarize',
        name: 'Summarize',
        icon: '📝',
        description: 'Create a concise summary of the content',
        systemPrompt: 'You are an expert at information synthesis. Create a concise, structured summary of the provided text. Use bullet points and bold key terms. Always match the tone of the source material.'
    },
    {
        id: 'explain',
        name: 'Explain',
        icon: '💡',
        description: 'Explain complex concepts simply',
        systemPrompt: 'You are a master teacher. Explain the following concepts in simple, easy-to-understand language. Use analogies and break down complex ideas into manageable pieces.'
    },
    {
        id: 'translate',
        name: 'Translate',
        icon: '🌐',
        description: 'Translate to a specific language',
        systemPrompt: 'You are a professional translator. Translate the following text accurately while preserving the original nuance and style. If no target language is specified, translate Chinese to English and vice versa.'
    },
    {
        id: 'brainstorm',
        name: 'Brainstorm',
        icon: '🧠',
        description: 'Generate creative ideas',
        systemPrompt: 'You are a creative strategist. Based on the topic, generate 10 unique, actionable, and creative ideas. Be bold and think outside the box.'
    },
    {
        id: 'polish',
        name: 'Polish',
        icon: '✨',
        description: 'Improve writing quality',
        systemPrompt: 'You are a professional editor. Rewrite the following text to make it more professional, fluent, and engaging. Improve the grammar and vocabulary without changing the core meaning.'
    },
    {
        id: 'draft',
        name: 'Draft',
        icon: '🖋️',
        description: 'Create a draft based on keywords',
        systemPrompt: 'You are a professional copywriter. Create a well-structured draft based on the provided keywords and context. Use appropriate headings and ensure smooth transitions.'
    },
    {
        id: 'report',
        name: 'Report',
        icon: '📊',
        description: 'Generate a professional report',
        systemPrompt: 'You are a business analyst. Create a professional, structured report based on the provided data and highlights. Use formal language and clear sections (Introduction, Analysis, Conclusion).'
    },
    {
        id: 'action',
        name: 'Action Items',
        icon: '✅',
        description: 'Extract tasks and to-dos',
        systemPrompt: 'You are a project manager. Extract all actionable tasks, to-dos, and follow-ups from the text. Present them as a clear, prioritized list.'
    }
];

const AIDomains = [
    {
        id: 'finance',
        name: 'Financial Expert',
        keywords: ['财务', '报表', '财报', '投资', '收益', '资产', '负债', '现金流', '审计', 'finance', 'accounting', 'profit', 'investment', 'audit'],
        systemPrompt: 'You are a Senior Financial Analyst and Chartered Accountant. Provide deep, accurate financial insights, analyze numbers with precision, and use professional accounting terminology. Focus on risk, ROI, and compliance.'
    },
    {
        id: 'writing',
        name: 'Creative Writer',
        keywords: ['写作', '创作', '文学', '小说', '剧本', '诗歌', '文案', 'writing', 'literary', 'story', 'novel', 'creative writing'],
        systemPrompt: 'You are a Pulitzer Prize-winning Writer and master storyteller. Enrich descriptions, improve narrative structure, and ensure emotional resonance. Focus on "Show, Don\'t Tell" and evocative language.'
    },
    {
        id: 'dev',
        name: 'Full-stack Architect',
        keywords: ['代码', '程序', 'bug', '开发', '架构', '后端', '前端', '数据库', 'programming', 'code', 'debug', 'architecture', 'api', 'git'],
        systemPrompt: 'You are a World-class Software Architect. Provide clean, efficient, and secure code. Explain technical decisions based on industry best practices (SOLID, Design Patterns). focus on scalability and performance.'
    },
    {
        id: 'legal',
        name: 'Legal Counsel',
        keywords: ['法律', '合同', '条款', '合规', '诉讼', '权利', '义务', 'legal', 'contract', 'law', 'compliance', 'litigation'],
        systemPrompt: 'You are a seasoned Legal Counsel. Analyze provided text with strict legal rigor, identify potential liabilities, ensure regulatory compliance, and use precise legal terminology.'
    },
    {
        id: 'research',
        name: 'Research Scientist',
        keywords: ['研究', '论文', '实验', '数据分析', '综述', '方法论', 'research', 'paper', 'scientific', 'experiment', 'analysis', 'methodology'],
        systemPrompt: 'You are an Academic Researcher and Scientist. Provide evidence-based analysis, maintain a formal academic tone, cite logical connections, and evaluate data with critical scientific methods.'
    }
];

/**
 * Route a query to the most relevant expert domain
 * @param {string} query 
 * @returns {Object|null} The matched domain or null
 */
function routeQuery(query) {
    if (!query) return null;
    const q = query.toLowerCase();

    // Simple keyword matching for routing
    let bestMatch = null;
    let maxMatches = 0;

    AIDomains.forEach(domain => {
        const matches = domain.keywords.filter(k => q.includes(k)).length;
        if (matches > maxMatches) {
            maxMatches = matches;
            bestMatch = domain;
        }
    });

    return bestMatch;
}

// Helper to get skill by ID
function getAISkill(id) {
    return AISkills.find(s => s.id === id);
}

// Export for browser global scope
if (typeof window !== 'undefined') {
    window.AISkills = AISkills;
    window.AIDomains = AIDomains;
    window.getAISkill = getAISkill;
    window.routeQuery = routeQuery;
}
