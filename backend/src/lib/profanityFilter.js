// backend/src/lib/profanityFilter.js
// Wrapper glin-profanity + liste custom + mise en gras des mots détectés

const fs = require('node:fs');
const path = require('node:path');
let Filter;

// glin-profanity peut être ESM ou CJS selon versions ; on tente require puis import()
try {
    // CJS
    // eslint-disable-next-line import/no-extraneous-dependencies
    Filter = require('glin-profanity').Filter;
} catch {
    // ESM fallback (Node >=18 a import() dispo)
    // eslint-disable-next-line no-new-func
    const dynamicImport = new Function('m', 'return import(m)');
    Filter = null;
    dynamicImport('glin-profanity')
        .then((mod) => { Filter = mod.Filter; })
        .catch(() => { /* si l’import échoue, on restera sans filtre (soft-fail) */ });
}

const DEFAULT_LANGS = (process.env.PROFANITY_LANGS || 'french,english')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

function loadCustomWords() {
    const fromEnv = (process.env.PROFANITY_CUSTOM_WORDS || '')
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);

    const filePath = path.resolve(process.cwd(), 'config/profanity.custom.json');
    let fromFile = [];
    try {
        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf8');
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) fromFile = arr.map(s => String(s).trim().toLowerCase()).filter(Boolean);
        }
    } catch {
        // ignore erreurs de lecture/JSON
    }
    return Array.from(new Set([...fromEnv, ...fromFile]));
}

let filter = null;
function ensureFilter() {
    if (filter || !Filter) return filter;
    filter = new Filter({
        languages: DEFAULT_LANGS,
        enableContextAware: true,
        allowObfuscatedMatch: true,
        severityLevels: true,
        customWords: loadCustomWords(),
    });
    return filter;
}

function reloadProfanityDictionaries() {
    if (!Filter) return;
    filter = new Filter({
        languages: DEFAULT_LANGS,
        enableContextAware: true,
        allowObfuscatedMatch: true,
        severityLevels: true,
        customWords: loadCustomWords(),
    });
}

// Mise en gras robuste (insensible casse/accents + 1337 basique)
function boldWordsIn(text, words) {
    if (!words?.length || !text) return text;

    const leet = (ch) => {
        const map = {
            a: '[aàáâä@4]', e: '[eèéêë3]', i: '[i1!íïîï]', o: '[o0óòôö]', u: '[uùúûü]',
            s: '[s$5]', t: '[t7+]', c: '[cç]', g: '[g9]', b: '[b8]',
        };
        const escaped = ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return map[ch] || escaped;
    };

    // traiter d’abord les plus longs pour éviter les collisions
    const patterns = words
        .map(w => String(w || '').toLowerCase())
        .filter(Boolean)
        .sort((a, b) => b.length - a.length)
        .map(w => {
            const body = [...w].map(leet).join('');
            const hasSpace = /\s/.test(w);
            return new RegExp(hasSpace ? body : `\\b${body}\\b`, 'gi');
        });

    let highlighted = text;
    for (const rx of patterns) {
        highlighted = highlighted.replace(rx, (m) => `**${m}**`);
    }
    return highlighted;
}

/**
 * Scanne un texte, retourne :
 * { flagged: boolean, words: string[], highlighted: string, details: any }
 */
function scanText(content) {
    if (!content || typeof content !== 'string') {
        return { flagged: false, words: [], highlighted: content || '', details: null };
    }
    const f = ensureFilter();
    if (!f) {
        // Si glin-profanity pas ready, soft-fail: pas de blocage
        return { flagged: false, words: [], highlighted: content, details: null };
    }
    const res = f.checkProfanity(content); // { containsProfanity, profaneWords, ... }
    const words = Array.from(new Set(res?.profaneWords || []));
    if (!res?.containsProfanity || words.length === 0) {
        return { flagged: false, words: [], highlighted: content, details: res || null };
    }
    const highlighted = boldWordsIn(content, words);
    return { flagged: true, words, highlighted, details: res || null };
}

module.exports = {
    scanText,
    reloadProfanityDictionaries,
};
