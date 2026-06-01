'use strict';

const { prisma } = require('../../../shards/database');

/**
 * @param {'guild'|'channel'|'role'|'message'|'member'} type
 * @param {string|number|bigint} v1Id
 * @returns {Promise<bigint|null>}
 */
async function getV2Id(type, v1Id) {
    const row = await prisma.v2MigrationMap.findUnique({
        where: { entityType_v1Id: { entityType: type, v1Id: String(v1Id) } },
        select: { v2Id: true },
    });
    return row ? row.v2Id : null;
}

/**
 * @param {'guild'|'channel'|'role'|'message'|'member'} type
 * @param {string|number|bigint} v1Id
 * @param {bigint} v2Id
 */
async function setV2Id(type, v1Id, v2Id) {
    await prisma.v2MigrationMap.upsert({
        where: { entityType_v1Id: { entityType: type, v1Id: String(v1Id) } },
        create: { entityType: type, v1Id: String(v1Id), v2Id },
        update: { v2Id },
    });
}

/**
 * @param {'guild'|'channel'|'role'|'message'|'member'} type
 * @param {bigint} v2Id
 * @returns {Promise<string|null>}
 */
async function getV1Id(type, v2Id) {
    const row = await prisma.v2MigrationMap.findFirst({
        where: { entityType: type, v2Id },
        select: { v1Id: true },
    });
    return row ? row.v1Id : null;
}

module.exports = { getV2Id, setV2Id, getV1Id };
