'use strict';

const { prisma } = require('../../../shards/database');
const { Prisma } = require('@prisma/client');
const { getChannelPermissions } = require('../permissions/permission.cache');
const { hasPermission, Permission } = require('../tchatv2.constants');

async function getAccessibleChannelIds(guildId, userId) {
    const channels = await prisma.v2Channel.findMany({
        where: { guildId: BigInt(guildId), deletedAt: null },
        select: { id: true },
    });

    // getChannelPermissions reads from Redis cache (TTL 10min) — not a DB N+1 in steady state.
    const results = [];
    await Promise.all(
        channels.map(async (ch) => {
            const perms = await getChannelPermissions(ch.id, guildId, userId);
            if (hasPermission(perms, Permission.VIEW_CHANNEL)) {
                results.push(ch.id);
            }
        })
    );
    return results;
}

async function searchMessages({ guildId, userId, q, channelId, fromUserId, before, after, limit, cursor }) {
    if (before && isNaN(new Date(before))) {
        const e = new Error('Invalid before date'); e.statusCode = 400; e.code = 'VALIDATION_ERROR'; throw e;
    }
    if (after && isNaN(new Date(after))) {
        const e = new Error('Invalid after date'); e.statusCode = 400; e.code = 'VALIDATION_ERROR'; throw e;
    }

    const member = await prisma.v2Member.findUnique({
        where: { guildId_userId: { guildId: BigInt(guildId), userId: Number(userId) } },
        select: { id: true },
    });
    if (!member) {
        const e = new Error('Not a member of this guild');
        e.statusCode = 403;
        e.code = 'FORBIDDEN';
        throw e;
    }

    const accessibleIds = await getAccessibleChannelIds(guildId, userId);

    if (accessibleIds.length === 0) {
        return { results: [], total: 0, hasMore: false, nextCursor: null };
    }

    // If filtering by channel, verify access
    if (channelId) {
        const hasAccess = accessibleIds.some((id) => id === BigInt(channelId));
        if (!hasAccess) {
            const e = new Error('Missing Permissions');
            e.statusCode = 403;
            e.code = 'FORBIDDEN';
            throw e;
        }
    }

    const searchIds = channelId ? [BigInt(channelId)] : accessibleIds;

    // Build raw query with optional filters
    const conditions = [
        Prisma.sql`m.deletedAt IS NULL`,
        Prisma.sql`m.channelId IN (${Prisma.join(searchIds)})`,
        Prisma.sql`MATCH(m.content) AGAINST (${q} IN BOOLEAN MODE)`,
    ];

    if (fromUserId) conditions.push(Prisma.sql`m.authorId = ${Number(fromUserId)}`);
    if (before) conditions.push(Prisma.sql`m.createdAt < ${new Date(before)}`);
    if (after) conditions.push(Prisma.sql`m.createdAt > ${new Date(after)}`);
    if (cursor) conditions.push(Prisma.sql`m.id < ${BigInt(cursor)}`);

    const whereClause = Prisma.join(conditions, ' AND ');

    // Count conditions exclude cursor so total reflects the full result set
    const countConditions = [
        Prisma.sql`m.deletedAt IS NULL`,
        Prisma.sql`m.channelId IN (${Prisma.join(searchIds)})`,
        Prisma.sql`MATCH(m.content) AGAINST (${q} IN BOOLEAN MODE)`,
    ];
    if (fromUserId) countConditions.push(Prisma.sql`m.authorId = ${Number(fromUserId)}`);
    if (before) countConditions.push(Prisma.sql`m.createdAt < ${new Date(before)}`);
    if (after) countConditions.push(Prisma.sql`m.createdAt > ${new Date(after)}`);

    const countWhere = Prisma.join(countConditions, ' AND ');

    const [rows, countRows] = await Promise.all([
        prisma.$queryRaw(
            Prisma.sql`
                SELECT m.id, m.channelId, m.authorId, m.content, m.createdAt, m.editedAt,
                       m.authorUsername, m.authorAvatarHash, m.authorNickname,
                       c.name as channelName
                FROM v2_message m
                JOIN v2_channel c ON c.id = m.channelId
                WHERE ${whereClause}
                ORDER BY m.id DESC
                LIMIT ${limit}
            `
        ),
        prisma.$queryRaw(
            Prisma.sql`SELECT COUNT(*) as total FROM v2_message m WHERE ${countWhere}`
        ),
    ]);

    const [{ total }] = countRows;

    const results = rows.map((r) => ({
        id: String(r.id),
        channelId: String(r.channelId),
        channelName: r.channelName,
        authorId: String(r.authorId),
        authorUsername: r.authorUsername,
        authorAvatarHash: r.authorAvatarHash ?? null,
        authorNickname: r.authorNickname ?? null,
        content: r.content,
        createdAt: r.createdAt,
        editedAt: r.editedAt ?? null,
    }));

    const hasMore = rows.length === limit;
    const nextCursor = hasMore ? String(rows[rows.length - 1].id) : null;

    return { results, total: Number(total), hasMore, nextCursor };
}

module.exports = { searchMessages };
