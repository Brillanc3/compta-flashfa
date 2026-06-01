'use strict';

const { prisma } = require('../../../shards/database');

async function list(guildId) {
    return prisma.v2GuildEmoji.findMany({
        where: { guildId: BigInt(guildId) },
        orderBy: { createdAt: 'asc' },
    });
}

async function count(guildId) {
    return prisma.v2GuildEmoji.count({ where: { guildId: BigInt(guildId) } });
}

async function create(data) {
    return prisma.v2GuildEmoji.create({ data });
}

async function createWithLimit(data, maxEmojis) {
    return prisma.$transaction(async (tx) => {
        const current = await tx.v2GuildEmoji.count({ where: { guildId: data.guildId } });
        if (current >= maxEmojis) {
            const e = new Error(`Guild emoji limit reached (max ${maxEmojis})`);
            e.status = 400;
            throw e;
        }
        return tx.v2GuildEmoji.create({ data });
    });
}

async function remove(id, guildId) {
    return prisma.v2GuildEmoji.deleteMany({
        where: { id: BigInt(id), guildId: BigInt(guildId) },
    });
}

module.exports = { list, count, create, createWithLimit, remove };
