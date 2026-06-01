'use strict';

const cache = require('../lib/cache');
const { resolveGuildPermissions, resolveChannelPermissions } = require('./permission.service');
const { loadGuildPermData, loadChannelPermData } = require('./permission.repository');

const TTL_GUILD_PERM  = 3600;  // 1h
const TTL_CHAN_PERM   = 600;   // 10min

const SUPERUSER_ID = 4;

function _guildKey(guildId, userId)   { return cache.key('perm', 'guild', String(guildId), 'user', String(userId)); }
function _chanKey(channelId, userId)  { return cache.key('perm', 'chan',  String(channelId), 'user', String(userId)); }

/**
 * Résolution permissions guild avec cache Redis.
 * @param {bigint|string} guildId
 * @param {number} userId
 * @returns {Promise<bigint>}
 */
async function getGuildPermissions(guildId, userId) {
    if (Number(userId) === SUPERUSER_ID) return ~0n;
    const k = _guildKey(guildId, userId);
    return cache.getOrCompute(k, TTL_GUILD_PERM, async () => {
        const data = await loadGuildPermData(BigInt(guildId), Number(userId));
        const perms = resolveGuildPermissions(data);
        return perms.toString();
    }).then(v => BigInt(v));
}

/**
 * Résolution permissions channel avec cache Redis.
 * @param {bigint|string} channelId
 * @param {bigint|string} guildId
 * @param {number} userId
 * @returns {Promise<bigint>}
 */
async function getChannelPermissions(channelId, guildId, userId) {
    if (Number(userId) === SUPERUSER_ID) return ~0n;
    const k = _chanKey(channelId, userId);
    return cache.getOrCompute(k, TTL_CHAN_PERM, async () => {
        const data = await loadChannelPermData(BigInt(guildId), Number(userId), BigInt(channelId));
        const perms = resolveChannelPermissions(data);
        return perms.toString();
    }).then(v => BigInt(v));
}

/**
 * @param {bigint|string} channelId
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
async function canView(channelId, guildId, userId) {
    const { Permission, hasPermission } = require('../tchatv2.constants');
    const perms = await getChannelPermissions(channelId, guildId, userId);
    return hasPermission(perms, Permission.VIEW_CHANNEL);
}

/**
 * @param {bigint|string} channelId
 * @param {bigint|string} guildId
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
async function canSend(channelId, guildId, userId) {
    const { Permission, hasPermission } = require('../tchatv2.constants');
    const perms = await getChannelPermissions(channelId, guildId, userId);
    return hasPermission(perms, Permission.SEND_MESSAGES);
}

// ─── Invalidation ────────────────────────────────────────────────────────────

/**
 * Invalide toutes les permissions d'un user dans une guild
 * (guild perm + tous ses channel perms).
 */
async function invalidateUser(guildId, userId) {
    await Promise.all([
        cache.del(_guildKey(guildId, userId)),
        cache.delPattern(cache.key('perm', 'chan', '*', 'user', String(userId))),
    ]);
}

/**
 * Invalide les perms de tous les users sur un channel.
 */
async function invalidateChannel(channelId) {
    await cache.delPattern(cache.key('perm', 'chan', String(channelId), 'user', '*'));
}

/**
 * Invalide toutes les perms liées à une guild.
 */
async function invalidateGuild(guildId) {
    await Promise.all([
        cache.delPattern(cache.key('perm', 'guild', String(guildId), 'user', '*')),
        cache.delPattern(cache.key('perm', 'chan', '*', 'user', '*')),
    ]);
}

/**
 * Invalide les perms de tous les membres ayant le rôle donné.
 * Utilise le SET Redis v2:role:{rid}:members maintenu à jour à chaque assign/unassign.
 */
async function invalidateRole(guildId, roleId) {
    const { redis } = require('../../../shards/redisClient');
    const membersKey = cache.key('role', String(roleId), 'members');
    const userIds = await redis.smembers(membersKey);
    await Promise.all(userIds.map(uid => invalidateUser(guildId, uid)));
}

/**
 * Maintient le SET v2:role:{rid}:members.
 * Appeler à chaque assign / unassign de rôle.
 */
async function trackRoleMember(roleId, userId, action /* 'add'|'remove' */) {
    const { redis } = require('../../../shards/redisClient');
    const k = cache.key('role', String(roleId), 'members');
    if (action === 'add') {
        await redis.sadd(k, String(userId));
    } else {
        await redis.srem(k, String(userId));
    }
}

module.exports = {
    getGuildPermissions,
    getChannelPermissions,
    canView,
    canSend,
    invalidateUser,
    invalidateChannel,
    invalidateGuild,
    invalidateRole,
    trackRoleMember,
};
