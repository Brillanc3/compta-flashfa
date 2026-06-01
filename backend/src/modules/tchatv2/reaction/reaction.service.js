'use strict';

const { prisma } = require('../../../shards/database');
const repo = require('./reaction.repository');
const { nextV2 } = require('../lib/snowflake');
const { Permission, hasPermission } = require('../tchatv2.constants');
const { getChannelPermissions } = require('../permissions/permission.cache');
const emitter = require('../sockets/socket.emitter');

function err(msg, status, code) {
    const e = new Error(msg);
    e.statusCode = status;
    e.code = code;
    return e;
}

async function recomputeSummary(messageId) {
    const groups = await repo.getReactionSummary(messageId);
    const summary = groups.map(g => ({ emoji: g.emoji, count: g._count.emoji }));
    await prisma.v2Message.update({
        where: { id: BigInt(messageId) },
        data: { reactionsSummary: JSON.stringify(summary) },
    });
    return summary;
}

async function addReaction({ channelId, guildId, messageId, userId, emoji, perms }) {
    const p = perms ?? await getChannelPermissions(channelId, guildId, userId);
    if (!hasPermission(p, Permission.ADD_REACTIONS)) throw err('Missing Permissions', 403, 50013);

    const existing = await repo.findReaction(messageId, userId, emoji);
    if (!existing) {
        await repo.addReaction({
            id: nextV2(),
            messageId: BigInt(messageId),
            userId: Number(userId),
            emoji,
        });
    }

    const summary = await recomputeSummary(messageId);

    emitter.messageReactionAdd(String(channelId), {
        userId:    String(userId),
        channelId: String(channelId),
        messageId: String(messageId),
        emoji,
        summary,
    });

    return { emoji, summary };
}

async function removeReaction({ channelId, guildId, messageId, userId, emoji, targetUserId, perms }) {
    const isSelf = String(targetUserId) === String(userId);

    if (!isSelf) {
        const p = perms ?? await getChannelPermissions(channelId, guildId, userId);
        if (!hasPermission(p, Permission.MANAGE_MESSAGES)) throw err('Missing Permissions', 403, 50013);
    }

    await repo.removeReactionByUser(messageId, targetUserId, emoji);
    const summary = await recomputeSummary(messageId);

    emitter.messageReactionRemove(String(channelId), {
        userId:    String(targetUserId),
        channelId: String(channelId),
        messageId: String(messageId),
        emoji,
        summary,
    });

    return { emoji, summary };
}

async function removeAllReactions({ channelId, guildId, messageId, userId, perms }) {
    const p = perms ?? await getChannelPermissions(channelId, guildId, userId);
    if (!hasPermission(p, Permission.MANAGE_MESSAGES)) throw err('Missing Permissions', 403, 50013);

    await repo.removeAllReactions(messageId);
    await prisma.v2Message.update({
        where: { id: BigInt(messageId) },
        data: { reactionsSummary: null },
    });

    emitter.messageReactionRemoveAll(String(channelId), String(messageId));
}

async function removeEmojiReactions({ channelId, guildId, messageId, userId, emoji, perms }) {
    const p = perms ?? await getChannelPermissions(channelId, guildId, userId);
    if (!hasPermission(p, Permission.MANAGE_MESSAGES)) throw err('Missing Permissions', 403, 50013);

    await repo.removeEmojiReactions(messageId, emoji);
    const summary = await recomputeSummary(messageId);

    emitter.messageReactionRemoveEmoji(String(channelId), String(messageId), emoji);
    return { summary };
}

async function listReactions({ messageId, emoji, after, limit }) {
    return repo.listReactions(messageId, emoji, { after, limit });
}

module.exports = { addReaction, removeReaction, removeAllReactions, removeEmojiReactions, listReactions };
