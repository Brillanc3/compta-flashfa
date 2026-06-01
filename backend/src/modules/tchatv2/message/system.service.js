'use strict';

const { prisma } = require('../../../shards/database');
const { nextV2 } = require('../lib/snowflake');
const emitter    = require('../sockets/socket.emitter');
const msgRepo    = require('./message.repository');

const WEBHOOK_FLAG = 64; // 1 << 6 — message non-utilisateur (cohérent avec webhook.service)

function err(msg, status, code) {
    const e = new Error(msg);
    e.statusCode = status;
    e.code = code;
    return e;
}

/**
 * Publie un message "système" (auteur affiché = `username`) dans un salon,
 * sans contrôle de permission ni rate-limit utilisateur. Diffuse via WebSocket.
 */
async function sendSystemMessage({ channelId, content, username = 'Automation' }) {
    const cid = BigInt(channelId);

    const channel = await prisma.v2Channel.findUnique({
        where: { id: cid },
        select: { id: true, guildId: true },
    });
    if (!channel) throw err('Channel not found', 404, 10003);

    const guild = await prisma.v2Guild.findUnique({
        where: { id: channel.guildId },
        select: { ownerId: true },
    });
    if (!guild) throw err('Guild not found', 404, 10004);

    const messageId = nextV2();
    const msg = await prisma.v2Message.create({
        data: {
            id: messageId,
            channelId: cid,
            authorId: guild.ownerId,          // FK valide ; l'affichage utilise authorUsername
            content: content || '',
            flags: WEBHOOK_FLAG,
            authorUsername: username,
            authorAvatarHash: null,
            authorNickname: null,
            mentionsJson: '{}',
        },
        select: msgRepo.MESSAGE_SELECT,
    });

    await prisma.v2Channel.update({ where: { id: cid }, data: { lastMessageId: messageId } });
    msgRepo.invalidateLastMsgCache(String(cid));

    const broadcast = await msgRepo.hydrateOne(msg, null);
    emitter.messageCreate(String(channel.id), String(channel.guildId), broadcast);
    return msg;
}

module.exports = { sendSystemMessage, WEBHOOK_FLAG };
