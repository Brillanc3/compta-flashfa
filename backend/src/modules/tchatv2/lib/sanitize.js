'use strict';

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/**
 * Échappe les caractères HTML spéciaux (pour notifications email ou indexation).
 * Le markdown brut est stocké tel quel en base ; la sanitization côté front
 * est assurée par isomorphic-dompurify à l'affichage.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => HTML_ESCAPES[c]);
}

module.exports = { escapeHtml };
