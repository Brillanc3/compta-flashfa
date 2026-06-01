'use strict';

/**
 * Parse les mentions dans un contenu markdown brut.
 * Ignore les mentions à l'intérieur de blocs code ou inline code.
 *
 * @param {string} content
 * @returns {{ users: bigint[], roles: bigint[], channels: bigint[], everyone: boolean, here: boolean }}
 */
function parseMentions(content) {
    if (!content) return { users: [], roles: [], channels: [], everyone: false, here: false };

    // Supprimer les blocs code et inline code avant de parser
    const stripped = content
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/`[^`\n]*`/g, ' ');

    const users    = [];
    const roles    = [];
    const channels = [];
    let everyone   = false;
    let here       = false;

    const userRe = /<@(\d+)>/g;
    const roleRe = /<@&(\d+)>/g;
    const chanRe = /<#(\d+)>/g;

    let m;
    while ((m = userRe.exec(stripped)) !== null)    users.push(BigInt(m[1]));
    while ((m = roleRe.exec(stripped)) !== null)    roles.push(BigInt(m[1]));
    while ((m = chanRe.exec(stripped)) !== null) channels.push(BigInt(m[1]));

    if (/(?<!\w)@everyone/.test(stripped)) everyone = true;
    if (/(?<!\w)@here/.test(stripped))     here     = true;

    return { users, roles, channels, everyone, here };
}

module.exports = { parseMentions };
