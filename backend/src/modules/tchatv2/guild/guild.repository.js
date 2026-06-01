'use strict';

const { prisma } = require('../../../shards/database');
const cache = require('../lib/cache');

const META_TTL   = 60 * 60;     // 1h
const GUILDS_TTL = 6 * 60 * 60; // 6h
const guildMetaKey  = (id)  => cache.key('guild', String(id), 'meta');
const userGuildsKey = (uid) => cache.key('user',  String(uid), 'guilds');

const GUILD_LIST_SELECT = {
    id: true, name: true, description: true,
    iconHash: true, bannerHash: true, ownerId: true,
    systemChannelId: true, createdAt: true,
    companyId: true,
};

async function create(data) {
    return prisma.v2Guild.create({ data });
}

async function findById(id) {
    const k = guildMetaKey(id);
    return cache.getOrCompute(k, META_TTL, () =>
        prisma.v2Guild.findUnique({ where: { id: BigInt(id) } })
    );
}

async function update(id, data) {
    const guild = await prisma.v2Guild.update({ where: { id: BigInt(id) }, data });
    await cache.del(guildMetaKey(id));
    return guild;
}

async function remove(id) {
    const guild = await prisma.v2Guild.delete({ where: { id: BigInt(id) } });
    await Promise.all([
        cache.del(guildMetaKey(id)),
        cache.delPattern(cache.key('guild', String(id), '*')),
    ]);
    return guild;
}

async function findUserGuilds(userId) {
    const k = userGuildsKey(userId);
    return cache.getOrCompute(k, GUILDS_TTL, async () => {
        const uid = Number(userId);

        // Guildes où l'utilisateur a un vrai V2Member, + guildes des companies
        // où il est employé ACTIVE (membres virtuels : pas de V2Member requis).
        const [members, employments] = await Promise.all([
            prisma.v2Member.findMany({
                where:  { userId: uid },
                select: { guild: { select: GUILD_LIST_SELECT } },
            }),
            prisma.companyEmployee.findMany({
                where:  { userId: uid, status: 'ACTIVE' },
                select: { companyId: true },
            }),
        ]);

        const guilds = members.map(m => m.guild);
        const seen   = new Set(guilds.map(g => String(g.id)));

        const companyIds = [...new Set(employments.map(e => e.companyId).filter(c => c != null))];
        if (companyIds.length) {
            const companyGuilds = await prisma.v2Guild.findMany({
                where:  { companyId: { in: companyIds } },
                select: GUILD_LIST_SELECT,
            });
            for (const g of companyGuilds) {
                if (!seen.has(String(g.id))) {
                    seen.add(String(g.id));
                    guilds.push(g);
                }
            }
        }

        return guilds;
    });
}

function invalidateUserGuilds(userId) {
    return cache.del(userGuildsKey(userId));
}

module.exports = { create, findById, update, remove, findUserGuilds, invalidateUserGuilds };
