'use strict';

const { prisma } = require('../../../shards/database');
const cache = require('../lib/cache');

const LASTMSG_TTL = 5 * 60; // 5 min
const lastMsgKey  = (cid) => cache.key('channel', String(cid), 'lastmsg');

const MESSAGE_SELECT = {
    id: true,
    channelId: true,
    authorId: true,
    authorUsername: true,
    authorAvatarHash: true,
    authorNickname: true,
    type: true,
    content: true,
    editedAt: true,
    pinned: true,
    tts: true,
    nonce: true,
    flags: true,
    referencedMessageId: true,
    mentionsJson: true,
    reactionsSummary: true,
    deletedAt: true,
    createdAt: true,
    attachments: {
        select: { id: true, filename: true, contentType: true, size: true, url: true, width: true, height: true },
    },
    embeds: {
        select: { id: true, type: true, url: true, title: true, description: true, color: true, imageUrl: true, thumbnailUrl: true, authorName: true, authorUrl: true, footerText: true, rawJson: true },
    },
    poll: {
        select: {
            id: true,
            question: true,
            multiple: true,
            expiresAt: true,
            options: { select: { id: true, text: true } },
            votes:   { select: { optionId: true, userId: true } },
        },
    },
};

async function findMessages(channelId, { before, after, around, limit = 50 } = {}) {
    const cid = BigInt(channelId);
    const n = Math.min(Number(limit), 100);

    // Cache des 50 derniers messages (chemin chaud sans curseur)
    if (!before && !after && !around && n <= 50) {
        const k = lastMsgKey(channelId);
        const cached = await cache.get(k);
        if (cached !== null) return cached;
        const messages = await prisma.v2Message.findMany({
            where: { channelId: cid, deletedAt: null },
            orderBy: { id: 'desc' },
            take: n,
            select: MESSAGE_SELECT,
        });
        await cache.set(k, messages, LASTMSG_TTL);
        return messages;
    }

    if (around) {
        const pivot = BigInt(around);
        const half = Math.floor(n / 2);
        const [older, newer] = await Promise.all([
            prisma.v2Message.findMany({
                where: { channelId: cid, id: { lt: pivot }, deletedAt: null },
                orderBy: { id: 'desc' },
                take: half,
                select: MESSAGE_SELECT,
            }),
            prisma.v2Message.findMany({
                where: { channelId: cid, id: { gte: pivot }, deletedAt: null },
                orderBy: { id: 'asc' },
                take: n - half,
                select: MESSAGE_SELECT,
            }),
        ]);
        return [...older.reverse(), ...newer];
    }

    if (before) {
        return prisma.v2Message.findMany({
            where: { channelId: cid, id: { lt: BigInt(before) }, deletedAt: null },
            orderBy: { id: 'desc' },
            take: n,
            select: MESSAGE_SELECT,
        });
    }

    if (after) {
        return prisma.v2Message.findMany({
            where: { channelId: cid, id: { gt: BigInt(after) }, deletedAt: null },
            orderBy: { id: 'asc' },
            take: n,
            select: MESSAGE_SELECT,
        });
    }

    return prisma.v2Message.findMany({
        where: { channelId: cid, deletedAt: null },
        orderBy: { id: 'desc' },
        take: n,
        select: MESSAGE_SELECT,
    });
}

async function findById(messageId) {
    return prisma.v2Message.findUnique({
        where: { id: BigInt(messageId) },
        select: MESSAGE_SELECT,
    });
}

async function create(data) {
    return prisma.v2Message.create({ data, select: MESSAGE_SELECT });
}

async function update(messageId, data) {
    return prisma.v2Message.update({
        where: { id: BigInt(messageId) },
        data,
        select: MESSAGE_SELECT,
    });
}

async function remove(messageId) {
    const mid = BigInt(messageId);
    await prisma.v2Poll.deleteMany({ where: { messageId: mid } });
    return prisma.v2Message.update({
        where: { id: mid },
        data:  { deletedAt: new Date() },
    });
}

async function bulkDelete(channelId, ids) {
    return prisma.v2Message.updateMany({
        where: { channelId: BigInt(channelId), id: { in: ids.map(BigInt) }, deletedAt: null },
        data:  { deletedAt: new Date() },
    });
}

function invalidateLastMsgCache(channelId) {
    return cache.del(lastMsgKey(channelId));
}

const REFERENCED_SELECT = {
    id: true,
    channelId: true,
    authorId: true,
    authorUsername: true,
    authorNickname: true,
    authorAvatarHash: true,
    content: true,
    deletedAt: true,
};

async function fetchReferencedMessages(refIds) {
    if (!refIds.length) return new Map();
    const rows = await prisma.v2Message.findMany({
        where: { id: { in: refIds.map(BigInt) } },
        select: REFERENCED_SELECT,
    });
    const map = new Map();
    rows.forEach(r => map.set(String(r.id), r));
    return map;
}

async function fetchUserReactionEmojis(messageIds, userId) {
    if (!messageIds.length || !userId) return new Map();
    const rows = await prisma.v2Reaction.findMany({
        where: { userId: Number(userId), messageId: { in: messageIds.map(BigInt) } },
        select: { messageId: true, emoji: true },
    });
    const map = new Map();
    rows.forEach(r => {
        const k = String(r.messageId);
        const arr = map.get(k) ?? [];
        arr.push(r.emoji);
        map.set(k, arr);
    });
    return map;
}

async function hydrateMessages(messages, userId) {
    if (!messages || messages.length === 0) return messages;
    const refIds = [...new Set(
        messages.map(m => m.referencedMessageId ? String(m.referencedMessageId) : null).filter(Boolean)
    )];
    const ids = messages.map(m => String(m.id));
    const [refMap, reactionMap] = await Promise.all([
        fetchReferencedMessages(refIds),
        fetchUserReactionEmojis(ids, userId),
    ]);
    return messages.map(m => ({
        ...m,
        referencedMessage: m.referencedMessageId ? (refMap.get(String(m.referencedMessageId)) ?? null) : null,
        userReactions: reactionMap.get(String(m.id)) ?? [],
    }));
}

async function hydrateOne(message, userId) {
    if (!message) return message;
    const [list] = await hydrateMessages([message], userId);
    return list;
}

module.exports = {
    findMessages, findById, create, update, remove, bulkDelete,
    invalidateLastMsgCache, MESSAGE_SELECT,
    hydrateMessages, hydrateOne,
};
