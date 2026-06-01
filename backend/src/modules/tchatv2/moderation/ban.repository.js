'use strict';

const { prisma } = require('../../../shards/database');

async function findBan(guildId, userId) {
    return prisma.v2Ban.findUnique({
        where: { guildId_userId: { guildId: BigInt(guildId), userId: Number(userId) } },
    });
}

async function findBans(guildId, { limit = 100, before } = {}) {
    return prisma.v2Ban.findMany({
        where: {
            guildId: BigInt(guildId),
            ...(before != null && { userId: { lt: Number(before) } }),
        },
        take: Math.min(limit, 1000),
        orderBy: { userId: 'desc' },
        include: { user: { select: { id: true, username: true } } },
    });
}

async function createBan(guildId, userId, reason) {
    return prisma.v2Ban.create({
        data: { guildId: BigInt(guildId), userId: Number(userId), reason: reason ?? null },
    });
}

async function deleteBan(guildId, userId) {
    return prisma.v2Ban.delete({
        where: { guildId_userId: { guildId: BigInt(guildId), userId: Number(userId) } },
    });
}

module.exports = { findBan, findBans, createBan, deleteBan };
