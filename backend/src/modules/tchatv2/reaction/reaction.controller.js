'use strict';

const service = require('./reaction.service');

async function add(req, reply) {
    const { channelId, guildId, messageId, emoji } = req.params;
    console.log(channelId, guildId, messageId, emoji);
    const result = await service.addReaction({
        channelId, guildId, messageId,
        userId: req.user.id,
        emoji: decodeURIComponent(emoji),
        perms: req.perms,
    });
    return reply.code(204).send(result);
}

async function removeSelf(req, reply) {
    const { channelId, guildId, messageId, emoji } = req.params;
    await service.removeReaction({
        channelId, guildId, messageId,
        userId: req.user.id,
        targetUserId: req.user.id,
        emoji: decodeURIComponent(emoji),
        perms: req.perms,
    });
    return reply.code(204).send();
}

async function removeUser(req, reply) {
    const { channelId, guildId, messageId, emoji, userId: targetUserId } = req.params;
    await service.removeReaction({
        channelId, guildId, messageId,
        userId: req.user.id,
        targetUserId,
        emoji: decodeURIComponent(emoji),
        perms: req.perms,
    });
    return reply.code(204).send();
}

async function removeAll(req, reply) {
    const { channelId, guildId, messageId } = req.params;
    await service.removeAllReactions({
        channelId, guildId, messageId,
        userId: req.user.id,
        perms: req.perms,
    });
    return reply.code(204).send();
}

async function removeEmoji(req, reply) {
    const { channelId, guildId, messageId, emoji } = req.params;
    await service.removeEmojiReactions({
        channelId, guildId, messageId,
        userId: req.user.id,
        emoji: decodeURIComponent(emoji),
        perms: req.perms,
    });
    return reply.code(204).send();
}

async function list(req, reply) {
    const { messageId, emoji } = req.params;
    const { after, limit } = req.query;
    const reactions = await service.listReactions({
        messageId,
        emoji: decodeURIComponent(emoji),
        after, limit,
    });
    return reply.send(reactions);
}

module.exports = { add, removeSelf, removeUser, removeAll, removeEmoji, list };
