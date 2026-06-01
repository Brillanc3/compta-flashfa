'use strict';

const { prisma } = require('../../../shards/database');
const { redis }  = require('../../../shards/redisClient');

const CACHE_TTL = 300; // 5 min

function cacheKey(userId, channelId) {
    return `v2:readstate:${userId}:${channelId}`;
}

async function upsertReadState(userId, channelId, messageId) {
    let state;
    try {
        state = await prisma.v2ChannelReadState.upsert({
            where: { userId_channelId: { userId: Number(userId), channelId: BigInt(channelId) } },
            create: {
                userId: Number(userId),
                channelId: BigInt(channelId),
                lastReadMessageId: BigInt(messageId),
                lastReadAt: new Date(),
            },
            update: {
                lastReadMessageId: BigInt(messageId),
                lastReadAt: new Date(),
            },
        });
    } catch (e) {
        if (e.code === 'P2003') {
            const err = new Error('Channel not found');
            err.statusCode = 404;
            throw err;
        }
        throw e;
    }
    if (redis) {
        await redis.set(cacheKey(userId, channelId), String(messageId), 'EX', CACHE_TTL);
    }
    return state;
}

async function getReadState(userId, channelId) {
    if (redis) {
        const cached = await redis.get(cacheKey(userId, channelId));
        if (cached !== null) return { lastReadMessageId: cached };
    }
    const state = await prisma.v2ChannelReadState.findUnique({
        where: { userId_channelId: { userId: Number(userId), channelId: BigInt(channelId) } },
        select: { lastReadMessageId: true },
    });
    const id = state?.lastReadMessageId ? String(state.lastReadMessageId) : null;
    if (redis && id) {
        await redis.set(cacheKey(userId, channelId), id, 'EX', CACHE_TTL);
    }
    return { lastReadMessageId: id };
}

async function getChannelReadStates(channelId) {
    const states = await prisma.v2ChannelReadState.findMany({
        where: { channelId: BigInt(channelId) },
        select: { userId: true, lastReadMessageId: true, lastReadAt: true },
    });
    return states.map(s => ({
        userId: s.userId,
        lastReadMessageId: String(s.lastReadMessageId),
        lastReadAt: s.lastReadAt,
    }));
}

module.exports = { upsertReadState, getReadState, getChannelReadStates };
