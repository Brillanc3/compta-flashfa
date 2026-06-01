'use strict';

const { prisma } = require('../../../shards/database');
const { resolveGuildPermissions } = require('../permissions/permission.service');
const { trackRoleMember } = require('../permissions/permission.cache');

/**
 * Recalcule et persiste cachedGuildPermissions pour un member.
 * À appeler après add/remove role, modification d'un rôle, changement d'owner.
 *
 * @param {bigint|string} guildId
 * @param {number} userId
 * @returns {Promise<bigint>} nouvelles permissions calculées
 */
async function recomputeMemberPermissions(guildId, userId) {
    const gid = BigInt(guildId);
    const uid = Number(userId);

    const [guild, memberWithRoles, roles] = await Promise.all([
        prisma.v2Guild.findUnique({ where: { id: gid }, select: { ownerId: true } }),
        prisma.v2Member.findUnique({
            where: { guildId_userId: { guildId: gid, userId: uid } },
            select: { memberRoles: { select: { roleId: true } } },
        }),
        prisma.v2Role.findMany({ where: { guildId: gid }, select: { id: true, permissions: true } }),
    ]);

    if (!guild || !memberWithRoles) return 0n;

    const isOwner = guild.ownerId === uid;
    const memberRoleIds = memberWithRoles.memberRoles.map(mr => mr.roleId);
    const rolePermissions = new Map(roles.map(r => [r.id, r.permissions]));
    const everyoneRoleId = gid; // convention : @everyone id === guildId

    const perms = resolveGuildPermissions({ isOwner, memberRoleIds, rolePermissions, everyoneRoleId });

    await prisma.v2Member.update({
        where: { guildId_userId: { guildId: gid, userId: uid } },
        data: { cachedGuildPermissions: perms },
    });

    return perms;
}

/**
 * Assigne un rôle à un membre, met à jour le cache Redis et recompute les permissions.
 *
 * @param {bigint} guildId
 * @param {number} userId
 * @param {bigint} roleId
 */
async function addRole(guildId, userId, roleId) {
    const gid = BigInt(guildId);
    const uid = Number(userId);
    const rid = BigInt(roleId);

    const member = await prisma.v2Member.findUnique({
        where: { guildId_userId: { guildId: gid, userId: uid } },
        select: { id: true },
    });
    if (!member) throw new Error('Member not found');

    await prisma.v2MemberRole.upsert({
        where: { memberId_roleId: { memberId: member.id, roleId: rid } },
        create: { memberId: member.id, roleId: rid },
        update: {},
    });

    await trackRoleMember(rid, uid, 'add');
    await recomputeMemberPermissions(gid, uid);
}

/**
 * Retire un rôle d'un membre, met à jour le cache Redis et recompute les permissions.
 *
 * @param {bigint} guildId
 * @param {number} userId
 * @param {bigint} roleId
 */
async function removeRole(guildId, userId, roleId) {
    const gid = BigInt(guildId);
    const uid = Number(userId);
    const rid = BigInt(roleId);

    const member = await prisma.v2Member.findUnique({
        where: { guildId_userId: { guildId: gid, userId: uid } },
        select: { id: true },
    });
    if (!member) throw new Error('Member not found');

    await prisma.v2MemberRole.deleteMany({
        where: { memberId: member.id, roleId: rid },
    });

    await trackRoleMember(rid, uid, 'remove');
    await recomputeMemberPermissions(gid, uid);
}

module.exports = { recomputeMemberPermissions, addRole, removeRole };
