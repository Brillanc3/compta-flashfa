'use strict';

/**
 * P0.6 — Contexte company unifié pour tchatv2.
 *
 * Pre-handler optionnel : si le header `x-company-id` est présent (ou query `?companyId=`),
 * vérifie l'appartenance du user à la company (via `CompanyEmployee`), met en cache Redis
 * (TTL 5 min), et attache `req.companyId` + `req.companyMember`.
 *
 * - Si header absent → no-op (migration progressive route par route).
 * - Si header invalide ou non-membre → 403.
 *
 * Réutilisable comme `addHook('preHandler', resolveCompanyContext)` au scope plugin
 * ou par-route dans le tableau `preHandler`.
 */

const { prisma } = require('../../../shards/database');
const { redis }  = require('../../../shards/redisClient');

const MEMBER_CACHE_TTL = 300; // 5 min

function memberKey(userId, companyId) {
    return `v2:member:${userId}:${companyId}`;
}

async function isCompanyMember(userId, companyId) {
    const key    = memberKey(userId, companyId);
    const cached = await redis.get(key).catch(() => null);
    if (cached === '1') return true;
    if (cached === '0') return false;

    const row = await prisma.companyEmployee.findFirst({
        where:  { userId: Number(userId), companyId: Number(companyId) },
        select: { id: true },
    });
    const ok = Boolean(row);
    // Cache positif et négatif (TTL court protège contre une révocation)
    await redis.set(key, ok ? '1' : '0', 'EX', MEMBER_CACHE_TTL).catch(() => {});
    return ok;
}

/**
 * Invalide le cache d'appartenance (à appeler depuis les flux de hire/fire).
 */
async function invalidateMemberCache(userId, companyId) {
    await redis.del(memberKey(userId, companyId)).catch(() => {});
}

async function resolveCompanyContext(req, reply) {
    if (!req.user?.id) return; // l'auth est gérée en amont

    const raw = req.headers['x-company-id'] ?? req.query?.companyId;
    if (raw == null || raw === '') return; // opt-in : pas de header, on ne touche pas

    const companyId = Number(raw);
    if (!Number.isInteger(companyId) || companyId < 1) {
        return reply.code(400).send({ code: 50035, message: 'Invalid x-company-id header' });
    }

    const member = await isCompanyMember(req.user.id, companyId);
    if (!member) {
        return reply.code(403).send({ code: 50001, message: 'Not a member of this company' });
    }

    req.companyId     = companyId;
    req.companyMember = true;
}

module.exports = { resolveCompanyContext, isCompanyMember, invalidateMemberCache };
