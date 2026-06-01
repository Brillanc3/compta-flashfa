'use strict';

const { prisma } = require('../../../shards/database');

async function findReaction(messageId, userId, emoji) {
    return prisma.v2Reaction.findUnique({
        where: { messageId_userId_emoji: {
            messageId: BigInt(messageId),
            userId: Number(userId),
            emoji,
        }},
    });
}

async function addReaction(data) {
    return prisma.v2Reaction.create({ data });
}

async function removeReaction(messageId, userId, emoji) {
    return prisma.v2Reaction.deleteMany({
        where: {
            messageId: BigInt(messageId),
            userId: Number(userId),
            emoji,
        },
    });
}

async function removeReactionByUser(messageId, userId, emoji) {
    return prisma.v2Reaction.deleteMany({
        where: { messageId: BigInt(messageId), userId: Number(userId), emoji },
    });
}

async function removeAllReactions(messageId) {
    return prisma.v2Reaction.deleteMany({ where: { messageId: BigInt(messageId) } });
}

async function removeEmojiReactions(messageId, emoji) {
    return prisma.v2Reaction.deleteMany({ where: { messageId: BigInt(messageId), emoji } });
}

async function listReactions(messageId, emoji, { after, limit = 25 } = {}) {
    return prisma.v2Reaction.findMany({
        where: {
            messageId: BigInt(messageId),
            emoji,
            ...(after && { userId: { gt: Number(after) } }),
        },
        orderBy: { userId: 'asc' },
        take: Math.min(Number(limit), 100),
        include: { user: { select: { id: true, username: true, imageUrl: true } } },
    });
}

async function getReactionSummary(messageId) {
    return prisma.v2Reaction.groupBy({
        by: ['emoji'],
        where: { messageId: BigInt(messageId) },
        _count: { emoji: true },
    });
}

module.exports = {
    findReaction,
    addReaction,
    removeReaction,
    removeReactionByUser,
    removeAllReactions,
    removeEmojiReactions,
    listReactions,
    getReactionSummary,
};
