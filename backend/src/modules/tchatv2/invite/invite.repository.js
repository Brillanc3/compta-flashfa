'use strict';

const { prisma } = require('../../../shards/database');

async function findByCode(code, { includeRelations = false } = {}) {
    if (!includeRelations) {
        return prisma.v2Invite.findUnique({ where: { code } });
    }
    return prisma.v2Invite.findUnique({
        where: { code },
        include: {
            guild:   { select: { id: true, name: true, description: true, iconHash: true } },
            channel: { select: { id: true, name: true } },
            inviter: { select: { id: true, username: true } },
        },
    });
}

async function create(data) {
    return prisma.v2Invite.create({ data });
}

async function incrementUses(code) {
    return prisma.v2Invite.update({
        where: { code },
        data: { uses: { increment: 1 } },
    });
}

async function remove(code) {
    return prisma.v2Invite.delete({ where: { code } });
}

async function findByChannel(channelId) {
    return prisma.v2Invite.findMany({
        where: { channelId: BigInt(channelId) },
    });
}

async function findByGuild(guildId) {
    return prisma.v2Invite.findMany({
        where: { guildId: BigInt(guildId), channelId: null },
    });
}

async function deleteExpired() {
    return prisma.v2Invite.deleteMany({
        where: { expiresAt: { lt: new Date() } },
    });
}

module.exports = { findByCode, create, incrementUses, remove, findByChannel, findByGuild, deleteExpired };
