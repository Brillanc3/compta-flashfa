'use strict';

const repo             = require('./message.repository');
const svc              = require('./message.service');
const readSvc          = require('./readstate.service');
const emitter          = require('../sockets/socket.emitter');
const { prisma }       = require('../../../shards/database');
const { redis }        = require('../../../shards/redisClient');

async function getGuildMemberCount(guildId) {
    const key = `v2:membercount:${guildId}`;
    if (redis) {
        const cached = await redis.get(key);
        if (cached !== null) return Number(cached);
    }
    const count = await prisma.v2Member.count({ where: { guildId: BigInt(guildId) } });
    if (redis) await redis.set(key, count, 'EX', 60);
    return count;
}

async function list(req, reply) {
    const { channelId } = req.params;
    const { limit, before, after, around } = req.query;
    const messages = await repo.findMessages(channelId, { limit, before, after, around });
    // before query returns DESC — reverse to chronological
    if (before && !around) messages.reverse();
    const hydrated = await repo.hydrateMessages(messages, req.user.id);
    return reply.send(hydrated);
}

async function getOne(req, reply) {
    const msg = await repo.findById(req.params.messageId);
    if (!msg) return reply.code(404).send({ code: 10008, message: 'Unknown Message' });
    const hydrated = await repo.hydrateOne(msg, req.user.id);
    return reply.send(hydrated);
}

async function create(req, reply) {
    const { guildId, channelId } = req.params;
    const { content, nonce, referencedMessageId, attachmentIds = [] } = req.body;
    const msg = await svc.createMessage({
        channelId,
        guildId,
        authorId: req.user.id,
        content,
        nonce,
        referencedMessageId,
        attachmentIds,
        perms: req.perms,
    });
    const hydrated = await repo.hydrateOne(msg, req.user.id);
    return reply.code(201).send(hydrated);
}

async function edit(req, reply) {
    const { messageId } = req.params;
    const msg = await svc.editMessage(messageId, req.user.id, req.body);
    const hydrated = await repo.hydrateOne(msg, req.user.id);
    return reply.send(hydrated);
}

async function destroy(req, reply) {
    const { channelId, guildId, messageId } = req.params;
    await svc.deleteMessage(messageId, req.user.id, { perms: req.perms, channelId, guildId });
    return reply.code(204).send();
}

async function bulkDelete(req, reply) {
    const { channelId } = req.params;
    const result = await svc.bulkDeleteMessages(channelId, req.body.messages);
    return reply.send(result);
}

async function getHistory(req, reply) {
    const { messageId } = req.params;
    const msg = await repo.findById(messageId);
    if (!msg) return reply.code(404).send({ code: 10008, message: 'Unknown Message' });

    const isAuthor = msg.authorId === req.user.id;
    const canManage = req.perms && require('../tchatv2.constants').hasPermission(req.perms, require('../tchatv2.constants').Permission.MANAGE_MESSAGES);
    if (!isAuthor && !canManage) return reply.code(403).send({ code: 50013, message: 'Missing Permissions' });

    const { prisma } = require('../../../shards/database');
    const edits = await prisma.v2MessageEdit.findMany({
        where: { messageId: BigInt(messageId) },
        orderBy: { editedAt: 'desc' },
        select: {
            id: true, content: true, editorId: true, editedAt: true,
            editor: { select: { username: true, name: true } },
        },
    });
    return reply.send(edits.map(e => ({
        id:             String(e.id),
        content:        e.content,
        editorId:       e.editorId,
        editorUsername: e.editor?.username ?? null,
        editorNickname: e.editor?.name ?? null,
        editedAt:       e.editedAt,
    })));
}

async function ack(req, reply) {
    const { guildId, channelId } = req.params;
    const { messageId } = req.body;
    await readSvc.upsertReadState(req.user.id, channelId, messageId);

    // Broadcast only for small guilds (<= 50 members) to avoid read receipt spam
    try {
        const memberCount = await getGuildMemberCount(guildId);
        if (memberCount <= 50) {
            emitter.readStateUpdate(channelId, {
                userId: String(req.user.id),
                channelId: String(channelId),
                lastReadMessageId: String(messageId),
            });
        }
    } catch { /* non-blocking — broadcast failure must not break ack */ }

    return reply.code(204).send();
}

async function getReadStates(req, reply) {
    const { channelId } = req.params;
    const states = await readSvc.getChannelReadStates(channelId);
    return reply.send(states);
}

module.exports = { list, getOne, create, edit, destroy, bulkDelete, ack, getHistory, getReadStates };
