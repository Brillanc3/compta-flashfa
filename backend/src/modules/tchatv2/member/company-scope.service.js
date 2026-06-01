'use strict';

const { prisma } = require('../../../shards/database');

async function getGuildCompanyId(guildId) {
    const guild = await prisma.v2Guild.findUnique({
        where:  { id: BigInt(guildId) },
        select: { companyId: true },
    });
    return guild?.companyId ?? null;
}

/**
 * Retourne tous les CompanyEmployee ACTIVE de la company liée à cette guild,
 * sous forme de membres virtuels compatibles avec le shape normalizeMember.
 * Les employés ayant déjà un vrai V2Member seront dédupliqués par l'appelant.
 *
 * @param {string|bigint} guildId
 * @returns {Promise<object[]>}
 */
async function getCompanyScopeMembers(guildId) {
    const companyId = await getGuildCompanyId(guildId);
    if (!companyId) return [];

    const [employees, managedRoles] = await Promise.all([
        prisma.companyEmployee.findMany({
            where:  { companyId, status: 'ACTIVE' },
            select: {
                userId:    true,
                createdAt: true,
                rank: { select: { id: true, name: true, position: true } },
                user: { select: { id: true, username: true, name: true, imageUrl: true } },
            },
        }),
        prisma.v2Role.findMany({
            where:  { guildId: BigInt(guildId), managed: true, companyRankId: { not: null } },
            select: { id: true, companyRankId: true },
        }),
    ]);

    const rankToRoleId = new Map(managedRoles.map(r => [r.companyRankId, String(r.id)]));

    return employees.map(emp => ({
        id:                     null,
        guildId:                String(guildId),
        userId:                 Number(emp.userId),  // Int Prisma → number JS explicite
        nickname:               null,
        avatarHash:             null,
        timeoutUntil:           null,
        cachedGuildPermissions: 0,
        joinedAt:               emp.createdAt,
        updatedAt:              emp.createdAt,
        user:                   emp.user,
        memberRoles:            [],
        roleIds:                emp.rank ? [rankToRoleId.get(emp.rank.id)].filter(Boolean) : [],
        isVirtual:              true,
    }));
}

/**
 * Retourne le Set des userId employés NON-ACTIVE (FIRE, RESIGNED, BLOCKED…) de la
 * company liée à cette guild. Sert à masquer les V2Member orphelins laissés par
 * un changement de statut dont le hook de suppression n'aurait pas abouti.
 *
 * @param {string|bigint} guildId
 * @returns {Promise<Set<number>>}
 */
async function getInactiveEmployeeUserIds(guildId) {
    const companyId = await getGuildCompanyId(guildId);
    if (!companyId) return new Set();
    const employees = await prisma.companyEmployee.findMany({
        where:  { companyId, status: { not: 'ACTIVE' } },
        select: { userId: true },
    });
    return new Set(employees.map(e => Number(e.userId)));
}

/**
 * Vérifie si un userId est un employé ACTIVE de la company liée à cette guild.
 *
 * @param {string|bigint} guildId
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
async function isInCompanyScope(guildId, userId) {
    const companyId = await getGuildCompanyId(guildId);
    if (!companyId) return false;
    const emp = await prisma.companyEmployee.findFirst({
        where:  { companyId, userId: Number(userId), status: 'ACTIVE' },
        select: { id: true },
    });
    return emp != null;
}

// NOTE: getOne (GET /members/:userId) ne couvre pas les membres virtuels.
// Un userId présent dans le scope virtuel retournera 404 sur cet endpoint.
// Acceptable pour la feature sidebar ; à compléter si /members/:userId est utilisé côté client.
module.exports = { getCompanyScopeMembers, getInactiveEmployeeUserIds, isInCompanyScope, getGuildCompanyId };
