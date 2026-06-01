'use strict';

const { prisma } = require('../../../shards/database');

const GUILD_TEXT = 0;

/**
 * Salons texte du guild associé à une company.
 * @returns {Promise<Array<{id:string,name:string}>>}
 */
async function getCompanyTextChannels(companyId) {
    const guild = await prisma.v2Guild.findFirst({
        where: { companyId: Number(companyId) },
        select: { id: true },
    });
    if (!guild) return [];

    const channels = await prisma.v2Channel.findMany({
        where: { guildId: guild.id, type: GUILD_TEXT },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, name: true },
    });
    return channels.map((c) => ({ id: String(c.id), name: c.name }));
}

module.exports = { getCompanyTextChannels };
