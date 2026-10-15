// backend/src/lib/apiKeyHash.js
// Les clés API sont aléatoires (256 bits) : un SHA-256 suffit à ne pas les stocker en clair.
const crypto = require('crypto');

function hashApiKey(rawKey) {
    return crypto.createHash('sha256').update(String(rawKey)).digest('hex');
}

/** Début et fin de la clé, pour l'afficher masquée sans la conserver. */
function apiKeyHint(rawKey) {
    return `${rawKey.slice(0, 8)}...${rawKey.slice(-4)}`;
}

module.exports = { hashApiKey, apiKeyHint };
