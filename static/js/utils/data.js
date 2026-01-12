/**
 * static/js/utils/data.js
 * 数据清洗、转换与归一化
 */

// 递归键排序函数 (解决 JSON 乱序导致的大量 Diff 问题)
export function recursiveSort(obj) {
    // 如果是数组，递归处理每一项，但不改变数组本身的顺序
    if (Array.isArray(obj)) {
        return obj.map(recursiveSort);
    }
    // 如果是对象，按键名排序重建对象
    if (obj && typeof obj === 'object') {
        return Object.keys(obj).sort().reduce((acc, key) => {
            acc[key] = recursiveSort(obj[key]);
            return acc;
        }, {});
    }
    // 基本类型直接返回
    return obj;
}

// 辅助：更新 Keys (String -> Array)
export function updateWiKeys(entry, value) {
    // 按逗号分割，去空格，去空值
    entry.keys = value.split(',').map(s => s.trim()).filter(s => s);
}

// 清洗 ST 世界书条目的默认值 (用于导出或保存)
export function stripStLoreEntryDefaults(entry) {
    const e = entry;

    // 1) 删 null
    Object.keys(e).forEach(k => {
        if (e[k] === null) delete e[k];
    });

    // 2) 删空字符串
    Object.keys(e).forEach(k => {
        if (typeof e[k] === 'string' && e[k] === '') delete e[k];
    });

    // 3) 删空数组 (保留 key)
    Object.keys(e).forEach(k => {
        if (Array.isArray(e[k]) && e[k].length === 0 && k !== 'key') delete e[k];
    });

    // 4) 删默认 false 的布尔字段
    const defaultFalseKeys = [
        'constant', 'disable', 'use_regex', 'vectorized',
        'addMemo', 'ignoreBudget', 'excludeRecursion', 'preventRecursion',
        'caseSensitive', 'matchWholeWords', 'groupOverride', 'useGroupScoring',
        'matchPersonaDescription', 'matchCharacterDescription',
        'matchCharacterPersonality', 'matchCharacterDepthPrompt',
        'matchScenario', 'matchCreatorNotes'
    ];
    defaultFalseKeys.forEach(k => {
        if (e[k] === false) delete e[k];
    });

    return e;
}

// 反向转换回 SillyTavern Lorebook V3 常见规范
export function toStV3Worldbook(bookData, fallbackName = "World Info") {
    if (!bookData) {
        return { name: fallbackName, entries: {} };
    }

    // 允许传入 V2 array
    const book = Array.isArray(bookData) ? { name: fallbackName, entries: bookData } : bookData;

    // entries: array / dict 都兼容
    let entries = book.entries ?? [];
    if (entries && !Array.isArray(entries)) {
        entries = Object.values(entries);
    }
    entries = entries || [];

    const exportEntries = {};
    entries.forEach((e, idx) => {
        const out = { ...e };

        // enabled -> disable (反向)
        const enabled = (e.enabled !== undefined) ? !!e.enabled : !(e.disable === true);
        out.disable = !enabled;

        // keys -> key
        out.key = (e.keys !== undefined) ? e.keys : (e.key ?? []);
        out.keysecondary = (e.secondary_keys !== undefined) ? e.secondary_keys : (e.keysecondary ?? []);

        // insertion_order -> order
        const order = (e.insertion_order !== undefined) ? Number(e.insertion_order)
                    : (e.order !== undefined ? Number(e.order) : 100);
        out.order = Number.isFinite(order) ? order : 100;

        // ST 常用字段：uid/displayIndex（用 idx 统一）
        out.uid = idx;
        out.displayIndex = idx;

        // 清理内部字段（避免写回文件污染）
        delete out.enabled;
        delete out.keys;
        delete out.secondary_keys;
        delete out.insertion_order;

        // 可选：你内部生成的 id 通常没必要写回 ST 文件（避免混淆）
        delete out.id;

        stripStLoreEntryDefaults(out);
        exportEntries[String(idx)] = out;
    });

    // 保留世界书顶层其他字段（如果有），但覆盖 entries/name
    return {
        ...book,
        name: book.name || fallbackName,
        entries: exportEntries
    };
}

// 前端归一化 entry 字段
export function normalizeWiEntry(entry) {
    // === 辅助转换函数：确保是数字，且处理 boolean ===
    const toNumber = (val, fieldName) => {
        // 如果是 boolean，强制转 0/1
        if (val === true) return 1;
        if (val === false) return 0;
        
        // 如果是 null/undefined/空串
        if (val === null || val === undefined || val === '') {
            // 针对特定字段给默认值
            if (fieldName === 'delayUntilRecursion') return 0;
            if (fieldName === 'probability') return 100;
            return 0; // 默认兜底
        }
        
        const n = Number(val);
        return isNaN(n) ? 0 : n;
    };

    return {
        ...entry,

        // === UI/内部统一字段 ===
        id: entry.id ?? entry.uid ?? Math.floor(Math.random() * 1000000000),
        
        // 强制转换为数字，避免 "false" 传入 input[type=number]
        insertion_order: toNumber(entry.insertion_order ?? entry.order, 'order'),
        position: toNumber(entry.position, 'position'),
        depth: toNumber(entry.depth, 'depth'),
        role: toNumber(entry.role, 'role'),
        probability: toNumber(entry.probability, 'probability'),
        selectiveLogic: toNumber(entry.selectiveLogic, 'selectiveLogic'),
        
        // 核心报错点：必须转为数字
        delayUntilRecursion: toNumber(entry.delayUntilRecursion, 'delayUntilRecursion'),
        
        // 布尔值字段保持布尔值
        enabled: (entry.enabled !== undefined) ? !!entry.enabled : !(entry.disable === true),
        constant: !!entry.constant,
        vectorized: !!entry.vectorized,
        excludeRecursion: !!entry.excludeRecursion,
        preventRecursion: !!entry.preventRecursion,
        ignoreBudget: !!entry.ignoreBudget,
        matchWholeWords: !!entry.matchWholeWords,
        caseSensitive: !!entry.caseSensitive,
        use_regex: !!entry.use_regex,
        selective: entry.selective !== undefined ? !!entry.selective : true,
        useProbability: entry.useProbability !== undefined ? !!entry.useProbability : true,

        // 确保数组
        keys: Array.isArray(entry.keys || entry.key) ? (entry.keys || entry.key) : [],
        secondary_keys: Array.isArray(entry.secondary_keys || entry.keysecondary) ? (entry.secondary_keys || entry.keysecondary) : [],
        
        // 文本
        content: entry.content || "",
        comment: entry.comment || ""
    };
}

// 归一化整本世界书
export function normalizeWiBook(bookData, fallbackName = "World Info") {
    let book = bookData || {};
    
    // 兼容 Array
    if (Array.isArray(book)) {
        book = { entries: book, name: fallbackName };
    }
    
    let entries = book.entries;
    // 兼容 Dict entries
    if (entries && !Array.isArray(entries)) {
        entries = Object.values(entries);
    }
    if (!entries) entries = [];

    // 执行归一化
    const fixedEntries = entries.map(e => normalizeWiEntry(e));
    
    return {
        ...book,
        name: book.name || fallbackName,
        entries: fixedEntries
    };
}

// === 获取清洗后的标准 V3 数据对象 ===
export function getCleanedV3Data(editingData) {
    // 1. 深拷贝当前编辑数据
    const raw = JSON.parse(JSON.stringify(editingData));

    // 2. 清洗备用开场白 (移除空字符串)
    if (raw.alternate_greetings && Array.isArray(raw.alternate_greetings)) {
        raw.alternate_greetings = raw.alternate_greetings.filter(s => s && s.trim() !== "");
    }

    // 3. 清洗世界书 (防止空对象或只有默认名的情况)
    if (raw.character_book) {
        const entries = raw.character_book.entries;
        const name = raw.character_book.name;
        // 如果既无条目，名字又是默认/空，视为无世界书，存为 null
        if ((!entries || entries.length === 0) && (!name || name === "World Info" || name === "")) {
            raw.character_book = null;
        }
    }

    // 4. 清洗扩展数据 (确保是数组)
    if (raw.extensions) {
        if (!Array.isArray(raw.extensions.regex_scripts)) raw.extensions.regex_scripts = [];
        if (!Array.isArray(raw.extensions.tavern_helper)) raw.extensions.tavern_helper = [];
    }
    
    // 5. 构建标准 V3 结构 (明确指定字段，丢弃多余的 UI 临时状态)
    return {
        name: raw.char_name,
        description: raw.description || "",
        first_mes: raw.first_mes || "",
        mes_example: raw.mes_example || "",
        personality: raw.personality || "",
        scenario: raw.scenario || "",
        creator_notes: raw.creator_notes || "",
        system_prompt: raw.system_prompt || "",
        post_history_instructions: raw.post_history_instructions || "",
        tags: raw.tags || [],
        creator: raw.creator || "",
        character_version: raw.character_version || "",
        alternate_greetings: raw.alternate_greetings || [],
        extensions: raw.extensions || {},
        character_book: raw.character_book,
        spec: "chara_card_v3",
        spec_version: "3.0",
        data: {
            name: raw.char_name,
            description: raw.description || "",
            first_mes: raw.first_mes || "",
            mes_example: raw.mes_example || "",
            personality: raw.personality || "",
            scenario: raw.scenario || "",
            creator_notes: raw.creator_notes || "",
            system_prompt: raw.system_prompt || "",
            post_history_instructions: raw.post_history_instructions || "",
            tags: raw.tags || [],
            creator: raw.creator || "",
            character_version: raw.character_version || "",
            alternate_greetings: raw.alternate_greetings || [],
            extensions: raw.extensions || {},
            character_book: raw.character_book,
        }
    };
}