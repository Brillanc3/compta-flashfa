'use strict';

const { prisma } = require('../../../shards/database');

/**
 * Charge tous les rôles d'une guild avec leurs permissions.
 * @param {bigint} guildId
 * @returns {Promise<{id: bigint, permissions: bigint}[]>}
 */
async function getRoles(guildId) {
    return prisma.v2Role.findMany({
        where: { guildId: BigInt(guildId) },
        select: { id: true, permissions: true },
    });
}

/**
 * Charge les IDs de rôles d'un member (userId dans une guild).
 * @param {bigint} guildId
 * @param {number|bigint} userId
 * @returns {Promise<bigint[]>}
 */
async function getMemberRoleIds(guildId, userId) {
    const gid = BigInt(guildId);
    const uid = Number(userId);

    const [member, guild] = await Promise.all([
        prisma.v2Member.findUnique({
            where:  { guildId_userId: { guildId: gid, userId: uid } },
            select: { memberRoles: { select: { roleId: true } } },
        }),
        prisma.v2Guild.findUnique({ where: { id: gid }, select: { companyId: true } }),
    ]);

    const roleIds = member ? member.memberRoles.map(mr => mr.roleId) : [];

    // Rôle de rang géré par la company : effectif pour tout employé ACTIVE,
    // même sans v2MemberRole matérialisé (modèle membre virtuel). Aligne
    // l'enforcement réel (canView/requirePermission) sur l'affichage par rang.
    if (guild?.companyId != null) {
        const employee = await prisma.companyEmployee.findFirst({
            where:  { companyId: guild.companyId, userId: uid, status: 'ACTIVE' },
            select: { rankId: true },
        });
        if (employee?.rankId != null) {
            const managedRole = await prisma.v2Role.findFirst({
                where:  { guildId: gid, companyRankId: employee.rankId },
                select: { id: true },
            });
            if (managedRole && !roleIds.some(r => BigInt(r) === BigInt(managedRole.id))) {
                roleIds.push(managedRole.id);
            }
        }
    }

    return roleIds;
}

/**
 * Charge les overwrites d'un channel.
 * @param {bigint} channelId
 * @returns {Promise<{targetId: bigint, type: number, allow: bigint, deny: bigint}[]>}
 */
async function getChannelOverwrites(channelId) {
    return prisma.v2PermissionOverwrite.findMany({
        where: { channelId: BigInt(channelId) },
        select: { targetId: true, type: true, allow: true, deny: true },
    });
}

/**
 * Récupère le rôle @everyone d'une guild (id === guildId par convention).
 * @param {bigint} guildId
 * @returns {Promise<{id: bigint, permissions: bigint}|null>}
 */
async function getEveryoneRole(guildId) {
    return prisma.v2Role.findFirst({
        where: { guildId: BigInt(guildId), position: 0 },
        select: { id: true, permissions: true },
    });
}

/**
 * Vérifie si un userId est owner d'une guild.
 * @param {bigint} guildId
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
async function isOwner(guildId, userId) {
    const guild = await prisma.v2Guild.findUnique({
        where: { id: BigInt(guildId) },
        select: { ownerId: true },
    });
    return guild ? guild.ownerId === Number(userId) : false;
}

/**
 * Charge les données pour résolution complète des permissions channel.
 * Charge aussi les overwrites de la catégorie parente si le salon en a une.
 * @param {bigint} guildId
 * @param {number} userId
 * @param {bigint} channelId
 */
async function loadChannelPermData(guildId, userId, channelId) {
    // Récupère le parentId du salon pour charger les overwrites catégorie en parallèle
    const channel = await prisma.v2Channel.findUnique({
        where: { id: BigInt(channelId) },
        select: { parentId: true },
    });

    const [roles, memberRoleIds, overwrites, ownerCheck, categoryOverwrites] = await Promise.all([
        getRoles(guildId),
        getMemberRoleIds(guildId, userId),
        getChannelOverwrites(channelId),
        isOwner(guildId, userId),
        channel?.parentId ? getChannelOverwrites(channel.parentId) : Promise.resolve([]),
    ]);

    // Convention : @everyone id === guildId
    const everyoneRoleId = BigInt(guildId);
    const rolePermissions = new Map(roles.map(r => [r.id, r.permissions]));

    return { isOwner: ownerCheck, memberRoleIds, rolePermissions, everyoneRoleId, categoryOverwrites, overwrites, userId };
}

/**
 * Charge les données pour résolution des permissions guild.
 * @param {bigint} guildId
 * @param {number} userId
 */
async function loadGuildPermData(guildId, userId) {
    const [roles, memberRoleIds, ownerCheck] = await Promise.all([
        getRoles(guildId),
        getMemberRoleIds(guildId, userId),
        isOwner(guildId, userId),
    ]);

    const everyoneRoleId = BigInt(guildId);
    const rolePermissions = new Map(roles.map(r => [r.id, r.permissions]));

    return { isOwner: ownerCheck, memberRoleIds, rolePermissions, everyoneRoleId };
}

module.exports = { loadChannelPermData, loadGuildPermData, getMemberRoleIds, getRoles, getChannelOverwrites };
