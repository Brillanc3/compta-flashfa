'use strict';

const { prisma }  = require('../../../shards/database');
const { nextV2 }  = require('../lib/snowflake');

/**
 * Écrit une entrée dans le journal d'audit. Fire & forget — ne bloque pas l'opération principale.
 *
 * @param {{ guildId: bigint|string, actorId?: number|null, targetId?: bigint|string|number|null, actionType: number, changes?: object|null, reason?: string|null }} opts
 */
function log({ guildId, actorId, targetId, actionType, changes, reason }) {
    const data = {
        id:         nextV2(),
        guildId:    BigInt(guildId),
        actorId:    actorId != null ? Number(actorId) : null,
        targetId:   targetId != null ? BigInt(targetId) : null,
        actionType: Number(actionType),
        changes:    changes ? JSON.stringify(changes) : null,
        reason:     reason ?? null,
    };

    return prisma.v2AuditLog.create({ data }).catch((err) => {
        console.error('[audit] write failed:', err?.message);
    });
}

/**
 * Liste les entrées d'audit d'un guild.
 *
 * @param {bigint|string} guildId
 * @param {{ limit?: number, before?: string, actionType?: number, userId?: number }} opts
 */
async function listAuditLogs(guildId, { limit = 50, before, actionType, userId } = {}) {
    const where = { guildId: BigInt(guildId) };
    if (before)     where.id         = { lt: BigInt(before) };
    if (actionType) where.actionType = Number(actionType);
    if (userId)     where.actorId    = Number(userId);

    return prisma.v2AuditLog.findMany({
        where,
        orderBy: { id: 'desc' },
        take:    Math.min(Number(limit), 100),
        select: {
            id: true, actionType: true,
            actorId: true, targetId: true,
            changes: true, reason: true, createdAt: true,
        },
    });
}

module.exports = { log, listAuditLogs };
