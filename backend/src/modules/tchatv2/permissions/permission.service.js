'use strict';

const { Permission, hasPermission } = require('../tchatv2.constants');

/**
 * Résolution permissions guild (sans overwrites channel).
 *
 * @param {object} p
 * @param {boolean} p.isOwner
 * @param {bigint[]} p.memberRoleIds
 * @param {Map<bigint, bigint>} p.rolePermissions  roleId → permissions bitfield
 * @param {bigint} p.everyoneRoleId
 * @returns {bigint}
 */
function resolveGuildPermissions({ isOwner, memberRoleIds, rolePermissions, everyoneRoleId }) {
    if (isOwner) return ~0n;

    const everyonePerms = BigInt(rolePermissions.get(BigInt(everyoneRoleId)) ?? 0n);

    if ((everyonePerms & Permission.ADMINISTRATOR) === Permission.ADMINISTRATOR) return ~0n;

    let perms = everyonePerms;

    for (const rawId of memberRoleIds) {
        const rid = BigInt(rawId);
        if (rid === BigInt(everyoneRoleId)) continue;
        const rp = BigInt(rolePermissions.get(rid) ?? 0n);
        perms |= rp;
    }

    if ((perms & Permission.ADMINISTRATOR) === Permission.ADMINISTRATOR) return ~0n;

    return perms;
}

/**
 * Applique un jeu d'overwrites (catégorie ou salon) sur le bitfield de permissions.
 * Ordre : @everyone overwrite → deny rôles cumulés + allow rôles cumulés → member overwrite.
 *
 * @param {bigint} perms
 * @param {Array<{targetId: bigint, type: number, allow: bigint, deny: bigint}>} overwrites
 * @param {bigint[]} memberRoleIds
 * @param {bigint} everyoneId
 * @param {bigint} uid
 * @returns {bigint}
 */
function _applyOverwrites(perms, overwrites, memberRoleIds, everyoneId, uid) {
    // @everyone overwrite
    const everyoneOw = overwrites.find(ow => ow.type === 0 && BigInt(ow.targetId) === everyoneId);
    if (everyoneOw) {
        perms &= ~BigInt(everyoneOw.deny);
        perms |= BigInt(everyoneOw.allow);
    }

    // Role overwrites : deny cumulés puis allow cumulés
    let roleDeny = 0n;
    let roleAllow = 0n;
    for (const rawId of memberRoleIds) {
        const rid = BigInt(rawId);
        if (rid === everyoneId) continue;
        const ow = overwrites.find(o => o.type === 0 && BigInt(o.targetId) === rid);
        if (ow) {
            roleDeny |= BigInt(ow.deny);
            roleAllow |= BigInt(ow.allow);
        }
    }
    perms &= ~roleDeny;
    perms |= roleAllow;

    // Member overwrite
    const memberOw = overwrites.find(ow => ow.type === 1 && BigInt(ow.targetId) === uid);
    if (memberOw) {
        perms &= ~BigInt(memberOw.deny);
        perms |= BigInt(memberOw.allow);
    }

    return perms;
}

/**
 * Résolution permissions channel selon l'ordre Discord :
 *  owner → admin cumulé → @everyone base → cumul rôles
 *  → overwrites catégorie (si parentId) → overwrites salon
 *  → member overwrite → sans VIEW_CHANNEL → 0n
 *
 * @param {object} p
 * @param {boolean} p.isOwner
 * @param {bigint[]} p.memberRoleIds
 * @param {Map<bigint, bigint>} p.rolePermissions  roleId → permissions bitfield
 * @param {bigint} p.everyoneRoleId
 * @param {Array<{targetId: bigint, type: number, allow: bigint, deny: bigint}>} [p.categoryOverwrites]  overwrites de la catégorie parente
 * @param {Array<{targetId: bigint, type: number, allow: bigint, deny: bigint}>} p.overwrites  overwrites du salon
 * @param {bigint|number} p.userId
 * @returns {bigint}
 */
function resolveChannelPermissions({ isOwner, memberRoleIds, rolePermissions, everyoneRoleId, categoryOverwrites, overwrites, userId }) {
    if (isOwner) return ~0n;

    let perms = resolveGuildPermissions({ isOwner, memberRoleIds, rolePermissions, everyoneRoleId });

    if ((perms & Permission.ADMINISTRATOR) === Permission.ADMINISTRATOR) return ~0n;

    const everyoneId = BigInt(everyoneRoleId);
    const uid = BigInt(userId);

    // Overwrites catégorie (priorité < salon)
    if (categoryOverwrites && categoryOverwrites.length > 0) {
        perms = _applyOverwrites(perms, categoryOverwrites, memberRoleIds, everyoneId, uid);
    }

    // Overwrites salon
    perms = _applyOverwrites(perms, overwrites, memberRoleIds, everyoneId, uid);

    // Sans VIEW_CHANNEL → aucune permission
    if ((perms & Permission.VIEW_CHANNEL) === 0n) return 0n;

    return perms;
}

module.exports = { resolveGuildPermissions, resolveChannelPermissions };
