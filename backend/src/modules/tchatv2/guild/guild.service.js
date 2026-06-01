'use strict';

const { prisma } = require('../../../shards/database');
const { nextV2 } = require('../lib/snowflake');
const { Permission, combinePermissions, ChannelType } = require('../tchatv2.constants');
const { recomputeMemberPermissions } = require('../member/member.service');
const cache = require('../lib/cache');
const emitter = require('../sockets/socket.emitter');
const memberRepo = require('../member/member.repository');

/**
 * Construit un payload membre sérialisable (BigInt → string) pour socket.io,
 * au même format que la liste REST des membres (roleIds triés, sans @everyone).
 */
function buildMemberPayload(member, everyoneId) {
    if (!member) return null;
    return {
        id:                     String(member.id),
        guildId:                String(member.guildId),
        userId:                 String(member.userId),
        nickname:               member.nickname ?? null,
        avatarHash:             member.avatarHash ?? null,
        timeoutUntil:           member.timeoutUntil ?? null,
        cachedGuildPermissions: String(member.cachedGuildPermissions ?? 0),
        joinedAt:               member.joinedAt ?? null,
        updatedAt:              member.updatedAt ?? null,
        user:                   member.user ?? null,
        roleIds: (member.memberRoles ?? [])
            .filter(mr => String(mr.roleId) !== everyoneId)
            .sort((a, b) => (b.role?.position ?? 0) - (a.role?.position ?? 0))
            .map(mr => String(mr.roleId)),
    };
}

/**
 * Notifie en temps réel l'arrivée d'un membre dans une guilde :
 *  - GUILD_MEMBER_ADD vers les membres déjà présents (panneau membres) ;
 *  - GUILD_CREATE vers la room perso du nouvel arrivant (liste des guildes).
 */
async function notifyMemberJoined(guildId, userId) {
    try {
        const gid = BigInt(guildId);
        const member = await memberRepo.findMember(gid, userId);
        const payload = buildMemberPayload(member, String(gid));
        if (payload) emitter.guildMemberAdd(String(gid), payload);

        const guild = await prisma.v2Guild.findUnique({
            where:  { id: gid },
            select: { id: true, name: true, description: true, iconHash: true },
        });
        if (guild) {
            emitter.guildCreate(userId, {
                id:          String(guild.id),
                name:        guild.name,
                description: guild.description ?? null,
                iconHash:    guild.iconHash ?? null,
            });
        }
    } catch { /* fire-and-forget */ }
}

// Permissions par défaut pour @everyone
const DEFAULT_EVERYONE_PERMS = combinePermissions(
    Permission.VIEW_CHANNEL,
    Permission.SEND_MESSAGES,
    Permission.READ_MESSAGE_HISTORY,
    Permission.ADD_REACTIONS,
    Permission.USE_EXTERNAL_EMOJIS,
    Permission.EMBED_LINKS,
    Permission.ATTACH_FILES,
);

async function createGuild(ownerId, { name, description, iconHash, companyId }) {
    if (companyId != null) {
        const existing = await prisma.v2Guild.findFirst({ where: { companyId } });
        if (existing) {
            throw Object.assign(new Error('Cette company possède déjà une guild'), { status: 409 });
        }
    }

    const guildId    = nextV2();
    const everyoneId = guildId; // convention : @everyone id === guildId
    const channelId  = nextV2();

    await prisma.$transaction([
        prisma.v2Guild.create({
            data: {
                id: guildId,
                name,
                description: description ?? null,
                iconHash:    iconHash ?? null,
                ownerId:     Number(ownerId),
                systemChannelId: channelId,
                ...(companyId != null && { companyId }),
            },
        }),
        prisma.v2Role.create({
            data: {
                id:          everyoneId,
                guildId,
                name:        '@everyone',
                permissions: DEFAULT_EVERYONE_PERMS,
                position:    0,
            },
        }),
        prisma.v2Member.create({
            data: {
                id:                     nextV2(),
                guildId,
                userId:                 Number(ownerId),
                cachedGuildPermissions: Permission.ADMINISTRATOR,
            },
        }),
        prisma.v2Channel.create({
            data: {
                id:       channelId,
                guildId,
                type:     ChannelType.GUILD_TEXT,
                name:     'general',
                position: 0,
            },
        }),
    ]);

    if (companyId != null) {
        await syncCompanyRanks(guildId, companyId);
        await syncCompanyMembers(guildId, companyId);
    }

    await cache.del(cache.key('user', String(ownerId), 'guilds'));

    return prisma.v2Guild.findUnique({ where: { id: guildId } });
}

async function assignCompanyRankRole(guildId, userId, companyId) {
    const employee = await prisma.companyEmployee.findFirst({
        where: { companyId, userId, status: 'ACTIVE' },
        select: { rankId: true },
    });
    if (!employee?.rankId) return;
    const managedRole = await prisma.v2Role.findFirst({
        where: { guildId, companyRankId: employee.rankId },
        select: { id: true },
    });
    if (!managedRole) return;
    const member = await prisma.v2Member.findUnique({
        where: { guildId_userId: { guildId, userId } },
        select: { id: true },
    });
    if (!member) return;
    await prisma.v2MemberRole.upsert({
        where: { memberId_roleId: { memberId: member.id, roleId: managedRole.id } },
        create: { memberId: member.id, roleId: managedRole.id },
        update: {},
    });
}

async function syncCompanyRanks(guildId, companyId) {
    const ranks = await prisma.rank.findMany({
        where:   { companyId },
        orderBy: { position: 'asc' },
        select:  { id: true, name: true, position: true },
    });
    for (const rank of ranks) {
        await prisma.v2Role.create({
            data: {
                id:            nextV2(),
                guildId,
                name:          rank.name,
                position:      rank.position,
                permissions:   0n,
                managed:       true,
                companyRankId: rank.id,
            },
        });
    }
}

async function syncCompanyMembers(guildId, companyId) {
    const employees = await prisma.companyEmployee.findMany({
        where:  { companyId, status: 'ACTIVE' },
        select: { userId: true },
    });
    for (const { userId } of employees) {
        const uid = Number(userId);
        const existing = await prisma.v2Member.findUnique({
            where: { guildId_userId: { guildId, userId: uid } },
            select: { id: true },
        });
        if (!existing) {
            await prisma.v2Member.create({
                data: { id: nextV2(), guildId, userId: uid },
            });
        }
        await assignCompanyRankRole(guildId, uid, companyId).catch(() => {});
        if (!existing) await notifyMemberJoined(guildId, uid);
    }
}

async function deleteGuild(guildId, requesterId) {
    const gid   = BigInt(guildId);
    const guild = await prisma.v2Guild.findUnique({ where: { id: gid }, select: { ownerId: true } });
    if (!guild) throw Object.assign(new Error('Unknown guild'), { status: 404 });
    if (guild.ownerId !== Number(requesterId)) {
        throw Object.assign(new Error('Only the owner can delete the guild'), { status: 403 });
    }
    await prisma.v2Guild.delete({ where: { id: gid } });
}

async function ensureCompanyMember(userId, companyId) {
    const guild = await prisma.v2Guild.findFirst({
        where: { companyId },
        select: { id: true },
    });
    if (!guild) return;

    const uid = Number(userId);
    const existing = await prisma.v2Member.findUnique({
        where: { guildId_userId: { guildId: guild.id, userId: uid } },
        select: { id: true },
    });
    if (existing) return;

    await prisma.v2Member.create({
        data: { id: nextV2(), guildId: guild.id, userId: uid },
    });
    await assignCompanyRankRole(guild.id, uid, companyId).catch(() => {});
    await cache.del(cache.key('user', String(uid), 'guilds'));
    await notifyMemberJoined(guild.id, uid);
}

async function removeCompanyGuildMember(userId, companyId) {
    const guild = await prisma.v2Guild.findFirst({
        where: { companyId },
        select: { id: true },
    });
    if (!guild) return;

    const uid = Number(userId);
    await prisma.v2Member.deleteMany({
        where: { guildId: guild.id, userId: uid },
    });
    await cache.del(cache.key('user', String(uid), 'guilds'));
    emitter.guildMemberRemove(String(guild.id), String(uid));
}

async function syncManagedRoles(guildId, userId, companyId) {
    const uid = Number(userId);
    const gid = BigInt(guildId);

    const member = await prisma.v2Member.findUnique({
        where: { guildId_userId: { guildId: gid, userId: uid } },
        select: { id: true },
    });
    if (!member) return;

    const managedRoles = await prisma.v2Role.findMany({
        where: { guildId: gid, managed: true, companyRankId: { not: null } },
        select: { id: true, companyRankId: true },
    });
    if (!managedRoles.length) return;

    const managedRoleIds = managedRoles.map(r => r.id);
    await prisma.v2MemberRole.deleteMany({
        where: { memberId: member.id, roleId: { in: managedRoleIds } },
    });

    const employee = await prisma.companyEmployee.findFirst({
        where: { companyId: Number(companyId), userId: uid, status: 'ACTIVE' },
        select: { rankId: true },
    });

    if (employee?.rankId) {
        const targetRole = managedRoles.find(r => r.companyRankId === employee.rankId);
        if (targetRole) {
            await prisma.v2MemberRole.create({
                data: { memberId: member.id, roleId: targetRole.id },
            });
        }
    }

    await recomputeMemberPermissions(gid, uid);
}

async function invalidateGuildCache(guildId) {
    await cache.delPattern(cache.key('guild', String(guildId), '*'));
}

module.exports = { createGuild, deleteGuild, syncCompanyRanks, syncCompanyMembers, assignCompanyRankRole, ensureCompanyMember, removeCompanyGuildMember, syncManagedRoles, notifyMemberJoined, DEFAULT_EVERYONE_PERMS, invalidateGuildCache };
