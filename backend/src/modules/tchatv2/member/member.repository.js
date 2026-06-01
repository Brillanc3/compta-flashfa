'use strict';

const { prisma } = require('../../../shards/database');

const MEMBER_SELECT = {
    id: true, guildId: true, userId: true, nickname: true,
    avatarHash: true, timeoutUntil: true, cachedGuildPermissions: true,
    joinedAt: true, updatedAt: true,
    user: { select: { id: true, username: true, name: true, imageUrl: true } },
    memberRoles: { select: { roleId: true, role: { select: { position: true } } } },
};

async function findMember(guildId, userId) {
    return prisma.v2Member.findUnique({
        where: { guildId_userId: { guildId: BigInt(guildId), userId: Number(userId) } },
        select: MEMBER_SELECT,
    });
}

async function findMembers(guildId, { limit = 100, after } = {}) {
    return prisma.v2Member.findMany({
        where: {
            guildId: BigInt(guildId),
            ...(after != null && { userId: { gt: Number(after) } }),
        },
        take: Math.min(limit, 1000),
        orderBy: { userId: 'asc' },
        select: MEMBER_SELECT,
    });
}

async function updateMember(guildId, userId, data) {
    return prisma.v2Member.update({
        where: { guildId_userId: { guildId: BigInt(guildId), userId: Number(userId) } },
        data,
        select: MEMBER_SELECT,
    });
}

async function removeMember(guildId, userId) {
    return prisma.v2Member.delete({
        where: { guildId_userId: { guildId: BigInt(guildId), userId: Number(userId) } },
    });
}

module.exports = { findMember, findMembers, updateMember, removeMember, MEMBER_SELECT };
