'use strict';

const { prisma } = require('../../../shards/database');

const MAX_PINS = 50;

async function getPins(channelId) {
    const pins = await prisma.v2PinnedMessage.findMany({
        where: { channelId: BigInt(channelId) },
        orderBy: { pinnedAt: 'desc' },
        include: {
            message: {
                select: {
                    id: true, channelId: true, authorId: true, authorUsername: true,
                    authorAvatarHash: true, authorNickname: true, type: true, content: true,
                    editedAt: true, pinned: true, nonce: true, flags: true,
                    referencedMessageId: true, mentionsJson: true, reactionsSummary: true, createdAt: true,
                    attachments: { select: { id: true, filename: true, contentType: true, size: true, url: true } },
                },
            },
        },
    });
    return pins.map(p => p.message);
}

async function pinMessage(channelId, messageId, pinnedBy) {
    const cid = BigInt(channelId);
    const mid = BigInt(messageId);

    const count = await prisma.v2PinnedMessage.count({ where: { channelId: cid } });
    if (count >= MAX_PINS) {
        const e = new Error('Maximum number of pins reached (50)');
        e.statusCode = 400;
        e.code = 30003;
        throw e;
    }

    const msg = await prisma.v2Message.findUnique({ where: { id: mid }, select: { id: true, channelId: true } });
    if (!msg || msg.channelId !== cid) {
        const e = new Error('Unknown Message');
        e.statusCode = 404;
        e.code = 10008;
        throw e;
    }

    await prisma.$transaction([
        prisma.v2PinnedMessage.upsert({
            where:  { channelId_messageId: { channelId: cid, messageId: mid } },
            create: { channelId: cid, messageId: mid, pinnedBy: Number(pinnedBy) },
            update: {},
        }),
        prisma.v2Message.update({ where: { id: mid }, data: { pinned: true } }),
        prisma.v2Channel.update({ where: { id: cid }, data: { lastPinTimestamp: new Date() } }),
    ]);
}

async function unpinMessage(channelId, messageId) {
    const cid = BigInt(channelId);
    const mid = BigInt(messageId);

    await prisma.$transaction([
        prisma.v2PinnedMessage.delete({ where: { channelId_messageId: { channelId: cid, messageId: mid } } }),
        prisma.v2Message.update({ where: { id: mid }, data: { pinned: false } }),
        prisma.v2Channel.update({ where: { id: cid }, data: { lastPinTimestamp: new Date() } }),
    ]);
}

module.exports = { getPins, pinMessage, unpinMessage };
