'use strict';

const { prisma } = require('../../../shards/database');
const cache      = require('../lib/cache');

const FLAG_TTL = 300; // 5 min

/**
 * @param {number} companyId
 * @returns {Promise<boolean>}
 */
async function isV2Company(companyId) {
    const k = cache.key('v2flag', String(companyId));
    return cache.getOrCompute(k, FLAG_TTL, async () => {
        const row = await prisma.company.findUnique({
            where: { id: companyId },
            select: { useTchatV2: true },
        });
        return row?.useTchatV2 ?? false;
    });
}

/**
 * Active TchatV2 pour une company.
 * @param {number} companyId
 */
async function enableV2(companyId) {
    await prisma.company.update({
        where: { id: companyId },
        data:  { useTchatV2: true },
    });
    await cache.del(cache.key('v2flag', String(companyId)));
}

/**
 * Désactive TchatV2 (rollback).
 * @param {number} companyId
 */
async function disableV2(companyId) {
    await prisma.company.update({
        where: { id: companyId },
        data:  { useTchatV2: false },
    });
    await cache.del(cache.key('v2flag', String(companyId)));
}

module.exports = { isV2Company, enableV2, disableV2 };
