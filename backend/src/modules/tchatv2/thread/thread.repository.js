'use strict';

const { prisma } = require('../../../shards/database');
const { ChannelType } = require('../tchatv2.constants');

const THREAD_SELECT = {
    id: true, guildId: true, parentId: true, type: true,
    name: true, position: true, rateLimitPerUser: true,
    lastMessageId: true, createdAt: true, updatedAt: true,
    threadMetadata: {
        select: {
            archived: true, autoArchiveDuration: true,
            archiveTimestamp: true, locked: true, createMessageId: true,
            pinned: true,
        },
    },
    _count: {
        select: {
            messages:  true,
        },
    },
};

const THREAD_TYPES = [
    ChannelType.PUBLIC_THREAD,
    ChannelType.PRIVATE_THREAD,
    ChannelType.ANNOUNCEMENT_THREAD,
];

async function findById(threadId) {
    return prisma.v2Channel.findUnique({
        where: { id: BigInt(threadId) },
        select: THREAD_SELECT,
    });
}

async function findActiveByChannel(channelId) {
    return prisma.v2Channel.findMany({
        where: {
            parentId: BigInt(channelId),
            type: { in: THREAD_TYPES },
            threadMetadata: { archived: false },
        },
        orderBy: { createdAt: 'desc' },
        select: THREAD_SELECT,
    });
}

async function findArchivedByChannel(channelId, { before, limit = 25 } = {}) {
    return prisma.v2Channel.findMany({
        where: {
            parentId: BigInt(channelId),
            type: { in: THREAD_TYPES },
            threadMetadata: { archived: true },
            ...(before && { createdAt: { lt: new Date(before) } }),
        },
        orderBy: { createdAt: 'desc' },
        take: Math.min(Number(limit), 100),
        select: THREAD_SELECT,
    });
}

async function create(channelData, metaData) {
    return prisma.$transaction(async (tx) => {
        const t = await tx.v2Channel.create({ data: channelData });
        await tx.v2ThreadMetadata.create({ data: { channelId: t.id, ...metaData } });
        return tx.v2Channel.findUnique({ where: { id: t.id }, select: THREAD_SELECT });
    });
}

async function updateMetadata(threadId, data) {
    await prisma.v2ThreadMetadata.update({
        where: { channelId: BigInt(threadId) },
        data,
    });
    return prisma.v2Channel.findUnique({ where: { id: BigInt(threadId) }, select: THREAD_SELECT });
}

async function remove(threadId) {
    return prisma.v2Channel.delete({ where: { id: BigInt(threadId) } });
}

async function reorderPosts(items) {
    await prisma.$transaction(
        items.map(({ id, position }) =>
            prisma.v2Channel.update({ where: { id: BigInt(id) }, data: { position: Number(position) } })
        )
    );
}

module.exports = { findById, findActiveByChannel, findArchivedByChannel, create, updateMetadata, remove, reorderPosts, THREAD_SELECT, THREAD_TYPES };
