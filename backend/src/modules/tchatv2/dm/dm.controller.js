'use strict';

const svc    = require('./dm.service');
const { prisma } = require('../../../shards/database');
const { nextV2 } = require('../lib/snowflake');
const emitter    = require('../sockets/socket.emitter');

// POST /dm/:targetUserId — ouvrir/créer DM 1-1
async function open(req, reply) {
    const targetUserId = Number(req.params.targetUserId);
    if (!targetUserId || isNaN(targetUserId)) {
        return reply.code(400).send({ error: 'Invalid targetUserId' });
    }
    const result = await svc.openDm(req.user.id, targetUserId);
    return reply.code(200).send(result);
}

// POST /dm/group — créer GROUP_DM
async function createGroup(req, reply) {
    const { memberIds, name = '' } = req.body;
    const result = await svc.createGroupDm(req.user.id, memberIds, name);
    return reply.code(201).send(result);
}

// GET /dm — lister ses DMs
async function list(req, reply) {
    const dms = await svc.listDms(req.user.id);
    return reply.code(200).send(dms);
}

// DELETE /dm/:channelId — cacher un DM
async function close(req, reply) {
    await svc.assertDmMember(req.params.channelId, req.user.id);
    await svc.closeDm(req.params.channelId, req.user.id);
    return reply.code(204).send();
}

// GET /dm/:channelId/messages — lister les messages d'un DM
async function getMessages(req, reply) {
    const channelId = req.params.channelId;
    const before    = req.query.before ? BigInt(req.query.before) : undefined;
    const limit     = Math.min(Number(req.query.limit) || 50, 100);

    await svc.assertDmMember(channelId, req.user.id);

    const where = {
        channelId: BigInt(channelId),
        deletedAt: null,
        ...(before ? { id: { lt: before } } : {}),
    };

    const messages = await prisma.v2Message.findMany({
        where,
        orderBy: { id: 'desc' },
        take: limit,
        select: {
            id: true,
            channelId: true,
            authorId: true,
            content: true,
            createdAt: true,
            editedAt: true,
            authorUsername: true,
            authorAvatarHash: true,
            authorNickname: true,
            referencedMessageId: true,
            attachments: {
                select: { id: true, filename: true, contentType: true, size: true, url: true, width: true, height: true },
            },
        },
    });

    return reply.code(200).send(messages.reverse());
}

// POST /dm/:channelId/messages — envoyer un message dans un DM
async function sendMessage(req, reply) {
    const channelId = req.params.channelId;
    const { content } = req.body;

    if (!content || typeof content !== 'string' || !content.trim()) {
        return reply.code(400).send({ error: 'content required' });
    }
    if (content.length > 2000) {
        return reply.code(400).send({ error: 'content too long' });
    }

    await svc.assertDmMember(channelId, req.user.id);

    const messageId = nextV2();
    const now       = new Date();

    const message = await prisma.v2Message.create({
        data: {
            id: messageId,
            channelId: BigInt(channelId),
            authorId: req.user.id,
            content: content.trim(),
            authorUsername: req.user.username ?? String(req.user.id),
            authorAvatarHash: req.user.imageUrl ?? null,
            createdAt: now,
            updatedAt: now,
        },
        select: {
            id: true,
            channelId: true,
            authorId: true,
            content: true,
            createdAt: true,
            editedAt: true,
            authorUsername: true,
            authorAvatarHash: true,
        },
    });

    // Mettre à jour lastMessageId du channel
    await prisma.v2Channel.update({
        where: { id: BigInt(channelId) },
        data: { lastMessageId: messageId },
    });

    // Broadcast via socket (room channel:${channelId} — clients rejoignent à l'ouverture du DM)
    try {
        const payload = { ...message, id: String(message.id), channelId: String(message.channelId) };
        emitter.messageCreate(channelId, null, payload);
    } catch (_) { /* socket emit non bloquant */ }

    return reply.code(201).send({ ...message, id: String(message.id), channelId: String(message.channelId) });
}

// DELETE /dm/:channelId/messages/:messageId — supprimer un message DM
async function deleteMessage(req, reply) {
    const { channelId, messageId } = req.params;

    await svc.assertDmMember(channelId, req.user.id);

    const msg = await prisma.v2Message.findUnique({
        where: { id: BigInt(messageId) },
        select: { id: true, channelId: true, authorId: true, deletedAt: true },
    });
    if (!msg || msg.deletedAt || String(msg.channelId) !== String(channelId)) {
        return reply.code(404).send({ error: 'Unknown Message' });
    }
    // En DM, seul l'auteur peut supprimer son propre message
    if (msg.authorId !== req.user.id) {
        return reply.code(403).send({ error: 'Missing Permissions' });
    }

    await prisma.v2Message.update({
        where: { id: BigInt(messageId) },
        data:  { deletedAt: new Date() },
    });

    try {
        emitter.messageDelete(String(channelId), String(messageId));
    } catch (_) { /* socket emit non bloquant */ }

    return reply.code(204).send();
}

module.exports = { open, createGroup, list, close, getMessages, sendMessage, deleteMessage };
