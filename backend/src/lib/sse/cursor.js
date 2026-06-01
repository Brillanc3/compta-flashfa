// backend/src/lib/sse/cursor.js
'use strict';

// Curseur multi-streams : { "<streamKey>": "<lastId>" }
// On l’encode en base64url pour le mettre dans le champ SSE "id"
function encodeCursor(map) {
    const json = JSON.stringify(map);
    return Buffer.from(json).toString('base64url');
}
function decodeCursor(id) {
    if (!id) return null;
    try { return JSON.parse(Buffer.from(id, 'base64url').toString('utf8')); }
    catch { return null; }
}
/**
 * Merge : complète "target" avec les clés manquantes de "defaults"
 * sans écraser celles déjà présentes.
 */
function withDefaults(target, defaults) {
    const out = { ...(target || {}) };
    for (const k of Object.keys(defaults)) {
        if (out[k] == null) out[k] = defaults[k];
    }
    return out;
}

module.exports = { encodeCursor, decodeCursor, withDefaults };
