'use strict';

const { prisma } = require('../../../shards/database');

const LEVEL = Object.freeze({
    DEFAULT:       0,
    ALL_MESSAGES:  1,
    MENTIONS_ONLY: 2,
    NONE:          3,
});

const MUTE_FOREVER = new Date('9999-12-31T00:00:00.000Z');

function isMuteForever(d) {
    return d && d.getTime() === MUTE_FOREVER.getTime();
}

async function get(userId, channelId) {
    const row = await prisma.v2UserChannelNotification.findUnique({
        where: { userId_channelId: { userId: Number(userId), channelId: BigInt(channelId) } },
        select: { level: true, mutedUntil: true },
    });
    const now = new Date();
    const mutedUntil = row?.mutedUntil ?? null;
    const isMuted = !!mutedUntil && mutedUntil.getTime() > now.getTime();
    return {
        level:      row?.level ?? LEVEL.DEFAULT,
        mutedUntil: mutedUntil ? mutedUntil.toISOString() : null,
        isMuted,
    };
}

async function upsert(userId, channelId, { level, mutedUntil }) {
    const data = {};
    if (typeof level === 'number') data.level = level;
    if (mutedUntil === null || mutedUntil instanceof Date) data.mutedUntil = mutedUntil;

    return prisma.v2UserChannelNotification.upsert({
        where:  { userId_channelId: { userId: Number(userId), channelId: BigInt(channelId) } },
        create: { userId: Number(userId), channelId: BigInt(channelId), level: data.level ?? LEVEL.DEFAULT, mutedUntil: data.mutedUntil ?? null },
        update: data,
    });
}

async function clearMute(userId, channelId) {
    await prisma.v2UserChannelNotification.updateMany({
        where: { userId: Number(userId), channelId: BigInt(channelId) },
        data:  { mutedUntil: null },
    });
}

async function shouldDeliver(userId, channelId, { isMention }) {
    const { level, isMuted } = await get(userId, channelId);
    if (isMuted) return false;
    if (level === LEVEL.NONE) return false;
    if (level === LEVEL.MENTIONS_ONLY && !isMention) return false;
    return true;
}

async function listForChannel(channelId) {
    const rows = await prisma.v2UserChannelNotification.findMany({
        where: { channelId: BigInt(channelId) },
        select: { userId: true, level: true, mutedUntil: true },
    });
    const now = new Date();
    return rows.map(r => ({
        userId: r.userId,
        level: r.level,
        isMuted: !!r.mutedUntil && r.mutedUntil.getTime() > now.getTime(),
    }));
}

async function listForUserInGuild(userId, guildId) {
    const rows = await prisma.v2UserChannelNotification.findMany({
        where: {
            userId: Number(userId),
            channel: { guildId: BigInt(guildId) },
        },
        select: { channelId: true, level: true, mutedUntil: true },
    });
    return rows.map(r => ({
        channelId:  String(r.channelId),
        level:      r.level,
        mutedUntil: r.mutedUntil ? r.mutedUntil.toISOString() : null,
    }));
}

module.exports = { get, upsert, clearMute, shouldDeliver, listForChannel, listForUserInGuild, LEVEL, MUTE_FOREVER, isMuteForever };
