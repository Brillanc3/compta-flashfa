'use strict';

const { prisma } = require('../../../shards/database');
const cache = require('../lib/cache');

const CHANNELS_TTL   = 30 * 60; // 30min
const guildChansKey  = (gid) => cache.key('guild', String(gid), 'channels');

const CHANNEL_SELECT = {
    id: true, guildId: true, parentId: true, type: true,
    name: true, topic: true, position: true, nsfw: true,
    rateLimitPerUser: true, lastMessageId: true, lastPinTimestamp: true,
    createdAt: true, updatedAt: true,
    overwrites: { select: { id: true, targetId: true, type: true, allow: true, deny: true } },
};

async function findById(channelId) {
    return prisma.v2Channel.findUnique({
        where: { id: BigInt(channelId) },
        select: CHANNEL_SELECT,
    });
}

async function findByGuild(guildId) {
    const k = guildChansKey(guildId);
    return cache.getOrCompute(k, CHANNELS_TTL, () =>
        prisma.v2Channel.findMany({
            where: { guildId: BigInt(guildId) },
            orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
            select: CHANNEL_SELECT,
        })
    );
}

async function _invalidateGuildChannels(channel) {
    if (channel?.guildId) await cache.del(guildChansKey(String(channel.guildId)));
}

async function invalidateGuildChannelsCache(guildId) {
    await cache.del(guildChansKey(String(guildId)));
}

async function create(data) {
    const channel = await prisma.v2Channel.create({ data, select: CHANNEL_SELECT });
    await cache.del(guildChansKey(String(channel.guildId)));
    return channel;
}

async function update(channelId, data) {
    const channel = await prisma.v2Channel.update({
        where: { id: BigInt(channelId) },
        data,
        select: CHANNEL_SELECT,
    });
    await cache.del(guildChansKey(String(channel.guildId)));
    return channel;
}

async function remove(channelId) {
    const existing = await prisma.v2Channel.findUnique({
        where: { id: BigInt(channelId) }, select: { guildId: true },
    });
    const result = await prisma.v2Channel.delete({ where: { id: BigInt(channelId) } });
    if (existing) await cache.del(guildChansKey(String(existing.guildId)));
    return result;
}

async function batchUpdatePositions(updates) {
    const rows = await prisma.$transaction(
        updates.map(u => prisma.v2Channel.update({
            where: { id: BigInt(u.id) },
            data: {
                position: u.position,
                ...(u.parentId !== undefined && { parentId: u.parentId ? BigInt(u.parentId) : null }),
            },
            select: { guildId: true },
        }))
    );
    const guildIds = [...new Set(rows.map(r => String(r.guildId)))];
    await Promise.all(guildIds.map(gid => cache.del(guildChansKey(gid))));
}

module.exports = { findById, findByGuild, create, update, remove, batchUpdatePositions, invalidateGuildChannelsCache, CHANNEL_SELECT };
