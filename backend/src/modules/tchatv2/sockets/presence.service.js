'use strict';

const { redis }  = require('../../../shards/redisClient');
const { prisma } = require('../../../shards/database');

function _key(userId)       { return `v2:presence:${userId}`; }
function _statusKey(userId) { return `v2:presence:status:${userId}`; }

const VALID_STATUSES = new Set(['online', 'idle', 'dnd']);

async function setOnline(userId, socketId) {
    await redis.hset(_key(userId), socketId, `online:${Date.now()}`);
    // Initialise chosen status to 'online' only if not already set (preserves idle/dnd across reconnects)
    await redis.set(_statusKey(userId), 'online', 'NX');
}

async function setChosenStatus(userId, status) {
    if (!VALID_STATUSES.has(status)) return;
    await redis.set(_statusKey(userId), status);
}

async function setOffline(userId, socketId, v2namespace) {
    await redis.hdel(_key(userId), socketId);
    const remaining = await redis.hlen(_key(userId));

    if (remaining > 0) return;

    await redis.del(_statusKey(userId));

    try {
        const memberships = await prisma.v2Member.findMany({
            where:  { userId: Number(userId) },
            select: { guildId: true },
        });
        const payload = { userId: String(userId), status: 'offline' };
        for (const { guildId } of memberships) {
            v2namespace.to(`guild:${String(guildId)}`).emit('PRESENCE_UPDATE', payload);
        }
    } catch (e) {
        console.error('[tchatv2/presence] setOffline broadcast error:', e.message);
    }
}

async function getStatus(userId) {
    const len = await redis.hlen(_key(userId));
    if (len === 0) return 'offline';
    return (await redis.get(_statusKey(userId))) || 'online';
}

async function getBulkStatuses(userIds) {
    if (!userIds.length) return [];
    const pipeline = redis.pipeline();
    for (const uid of userIds) {
        pipeline.hlen(_key(uid));
        pipeline.get(_statusKey(uid));
    }
    const results = await pipeline.exec();
    return userIds.map((uid, i) => {
        const hlen   = results[i * 2][1];
        const chosen = results[i * 2 + 1][1];
        return {
            userId: String(uid),
            status: hlen > 0 ? (chosen || 'online') : 'offline',
        };
    });
}

module.exports = { setOnline, setChosenStatus, setOffline, getStatus, getBulkStatuses };
