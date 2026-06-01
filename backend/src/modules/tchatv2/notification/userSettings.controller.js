'use strict';

const svc = require('./userSettings.service');
const { prisma } = require('../../../shards/database');

async function getSettings(req, reply) {
    const { channelId } = req.params;
    const out = await svc.get(req.user.id, channelId);
    return reply.send(out);
}

async function setSettings(req, reply) {
    const { channelId } = req.params;
    const { level, muteDurationMs, muteForever, unmute } = req.body || {};

    if (level !== undefined && (typeof level !== 'number' || level < 0 || level > 3)) {
        return reply.code(400).send({ code: 50035, message: 'Invalid level' });
    }

    let mutedUntil;
    if (unmute) {
        mutedUntil = null;
    } else if (muteForever) {
        mutedUntil = svc.MUTE_FOREVER;
    } else if (typeof muteDurationMs === 'number' && muteDurationMs > 0) {
        const ALLOWED = [15 * 60_000, 60 * 60_000, 3 * 60 * 60_000, 8 * 60 * 60_000, 24 * 60 * 60_000];
        if (!ALLOWED.includes(muteDurationMs)) {
            return reply.code(400).send({ code: 50035, message: 'Invalid mute duration' });
        }
        mutedUntil = new Date(Date.now() + muteDurationMs);
    }

    await svc.upsert(req.user.id, channelId, { level, mutedUntil });
    const out = await svc.get(req.user.id, channelId);
    return reply.send(out);
}

async function listForGuild(req, reply) {
    const { guildId } = req.params;
    const rows = await svc.listForUserInGuild(req.user.id, guildId);
    return reply.send(rows);
}

async function getGuildSettings(req, reply) {
    const { guildId } = req.params;
    const userId = req.user.id;
    try {
        const setting = await prisma.v2GuildNotifSetting.findUnique({
            where: { userId_guildId: { userId: Number(userId), guildId: BigInt(guildId) } },
        });
        return reply.send(setting
            ? { level: setting.level, mutedUntil: setting.mutedUntil }
            : { level: 0, mutedUntil: null }
        );
    } catch (err) {
        return reply.code(err.status || 500).send({ message: err.message });
    }
}

async function setGuildSettings(req, reply) {
    const { guildId } = req.params;
    const userId = Number(req.user.id);
    const { level, mutedUntil, unmute } = req.body || {};

    const data = {};
    if (level       !== undefined) data.level      = level;
    if (unmute)                    data.mutedUntil  = null;
    else if (mutedUntil !== undefined) data.mutedUntil = mutedUntil ? new Date(mutedUntil) : null;

    try {
        const setting = await prisma.v2GuildNotifSetting.upsert({
            where:  { userId_guildId: { userId, guildId: BigInt(guildId) } },
            create: { userId, guildId: BigInt(guildId), ...data },
            update: data,
        });
        return reply.send({ level: setting.level, mutedUntil: setting.mutedUntil });
    } catch (err) {
        return reply.code(err.status || 500).send({ message: err.message });
    }
}

module.exports = { getSettings, setSettings, listForGuild, getGuildSettings, setGuildSettings };
