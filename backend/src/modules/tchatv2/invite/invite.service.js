'use strict';

const crypto = require('crypto');
const { prisma } = require('../../../shards/database');
const { nextV2 } = require('../lib/snowflake');
const { assignCompanyRankRole, notifyMemberJoined } = require('../guild/guild.service');
const cache = require('../lib/cache');
const repo = require('./invite.repository');

function generateCode() {
    return crypto.randomBytes(6).toString('base64url').slice(0, 8);
}

async function createInvite(channelId, inviterId, { maxUses = 0, maxAge = 86400, temporary = false }) {
    const channel = await prisma.v2Channel.findUnique({
        where: { id: BigInt(channelId) },
        select: { guildId: true },
    });
    if (!channel) throw Object.assign(new Error('Unknown Channel'), { status: 404 });

    const code      = generateCode();
    const expiresAt = maxAge > 0 ? new Date(Date.now() + maxAge * 1000) : null;

    return repo.create({
        code,
        guildId:   channel.guildId,
        channelId: BigInt(channelId),
        inviterId: Number(inviterId),
        maxUses,
        maxAge,
        temporary,
        expiresAt,
    });
}

async function createGuildInvite(guildId, inviterId, { maxUses = 0, maxAge = 86400, temporary = false }) {
    const guild = await prisma.v2Guild.findUnique({
        where: { id: BigInt(guildId) },
        select: { id: true },
    });
    if (!guild) throw Object.assign(new Error('Unknown Guild'), { status: 404 });

    const code      = generateCode();
    const expiresAt = maxAge > 0 ? new Date(Date.now() + maxAge * 1000) : null;

    return repo.create({
        code,
        guildId:   BigInt(guildId),
        inviterId: Number(inviterId),
        maxUses,
        maxAge,
        temporary,
        expiresAt,
    });
}

async function useInvite(code, userId) {
    const invite = await repo.findByCode(code);
    if (!invite) throw Object.assign(new Error('Unknown Invite'), { status: 404 });

    if (invite.expiresAt && invite.expiresAt < new Date()) {
        throw Object.assign(new Error('Invite expired'), { status: 404 });
    }
    if (invite.maxUses > 0 && invite.uses >= invite.maxUses) {
        throw Object.assign(new Error('Invite max uses reached'), { status: 404 });
    }

    // Check ban
    const ban = await prisma.v2Ban.findUnique({
        where: { guildId_userId: { guildId: invite.guildId, userId: Number(userId) } },
    });
    if (ban) throw Object.assign(new Error('You are banned from this guild'), { status: 403 });

    // Upsert member
    const guildId = invite.guildId;
    const uid     = Number(userId);

    let member = await prisma.v2Member.findUnique({
        where: { guildId_userId: { guildId, userId: uid } },
        select: { id: true },
    });
    if (!member) {
        member = await prisma.v2Member.create({
            data: { id: nextV2(), guildId, userId: uid },
            select: { id: true },
        });

        // Assign the managed role matching the user's company rank (if any)
        const guild = await prisma.v2Guild.findUnique({
            where: { id: guildId },
            select: { companyId: true },
        });
        if (guild?.companyId) {
            await assignCompanyRankRole(guildId, uid, guild.companyId).catch(() => {});
        }

        await cache.del(cache.key('user', String(uid), 'guilds')).catch(() => {});
        await notifyMemberJoined(guildId, uid);
    }

    await repo.incrementUses(code);

    return prisma.v2Guild.findUnique({
        where: { id: invite.guildId },
        select: { id: true, name: true, description: true, iconHash: true },
    });
}

module.exports = { createInvite, createGuildInvite, useInvite };
