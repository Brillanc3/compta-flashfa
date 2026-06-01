'use strict';

const { prisma } = require('../../../shards/database');
const { invalidateUser } = require('../permissions/permission.cache');
const audit = require('./audit.service');
const { AuditLogActionType } = require('../tchatv2.constants');

/**
 * Applique ou retire un timeout sur un member.
 * @param {string|bigint} guildId
 * @param {string|number} targetUserId
 * @param {string|null} until - ISO date string ou null pour lever le timeout
 */
async function setTimeout_(guildId, targetUserId, until, actorId) {
    const gid = BigInt(guildId);
    const uid = Number(targetUserId);

    const member = await prisma.v2Member.findUnique({
        where: { guildId_userId: { guildId: gid, userId: uid } },
        select: { id: true },
    });
    if (!member) throw Object.assign(new Error('Unknown Member'), { status: 404 });

    await prisma.v2Member.update({
        where: { guildId_userId: { guildId: gid, userId: uid } },
        data: { timeoutUntil: until ? new Date(until) : null },
    });

    await invalidateUser(guildId, targetUserId);

    audit.log({
        guildId,
        actorId:    actorId ?? null,
        targetId:   targetUserId,
        actionType: AuditLogActionType.TIMEOUT,
        changes:    { until: until ?? null },
    });
}

/**
 * Vérifie si un member est actuellement en timeout.
 * @param {bigint} guildId
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
async function isTimedOut(guildId, userId) {
    const member = await prisma.v2Member.findUnique({
        where: { guildId_userId: { guildId: BigInt(guildId), userId: Number(userId) } },
        select: { timeoutUntil: true },
    });
    if (!member || !member.timeoutUntil) return false;
    return member.timeoutUntil > new Date();
}

module.exports = { setTimeout: setTimeout_, isTimedOut };
