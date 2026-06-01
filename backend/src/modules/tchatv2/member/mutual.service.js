'use strict';

const { prisma } = require('../../../shards/database');

function clampLimit(n) {
    const v = Number(n);
    if (!Number.isFinite(v) || v < 1) return 20;
    return Math.min(50, Math.floor(v));
}

async function findMutualUsers({ callerId, excludeGuildId, q, limit }) {
    const take = clampLimit(limit);
    const callerInt = Number(callerId);

    const callerGuilds = await prisma.v2Member.findMany({
        where:  { userId: callerInt },
        select: { guildId: true },
    });
    if (callerGuilds.length === 0) return [];
    const guildIds = callerGuilds.map(g => g.guildId);

    let excludedUserIds = [];
    if (excludeGuildId != null) {
        const excluded = await prisma.v2Member.findMany({
            where:  { guildId: BigInt(excludeGuildId) },
            select: { userId: true },
        });
        excludedUserIds = excluded.map(e => e.userId);
    }

    const where = {
        guildId: { in: guildIds },
        userId:  {
            notIn: excludedUserIds.length > 0
                ? [callerInt, ...excludedUserIds]
                : [callerInt],
        },
    };
    if (q && typeof q === 'string' && q.trim().length > 0) {
        where.user = { name: { contains: q.trim(), mode: 'insensitive' } };
    }

    const rows = await prisma.v2Member.findMany({
        where,
        distinct: ['userId'],
        select: { userId: true, user: { select: { id: true, name: true, imageUrl: true } } },
        orderBy: { user: { name: 'asc' } },
        take,
    });

    return rows.map(r => ({
        id:         String(r.user.id),
        name:       r.user.name,
        avatarHash: r.user.avatarHash ?? null,
    }));
}

module.exports = { findMutualUsers };
