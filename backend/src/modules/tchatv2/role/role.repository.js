'use strict';

const { prisma } = require('../../../shards/database');
const cache = require('../lib/cache');

const ROLES_TTL     = 60 * 60; // 1h
const guildRolesKey = (gid) => cache.key('guild', String(gid), 'roles');

async function findById(roleId) {
    return prisma.v2Role.findUnique({ where: { id: BigInt(roleId) } });
}

async function findByGuild(guildId) {
    const k = guildRolesKey(guildId);
    return cache.getOrCompute(k, ROLES_TTL, async () => {
        const roles = await prisma.v2Role.findMany({
            where: { guildId: BigInt(guildId) },
        });

        const gid      = String(guildId);
        const everyone = roles.filter(r => String(r.id) === gid);
        const others   = roles
            .filter(r => String(r.id) !== gid)
            .sort((a, b) => b.position - a.position);

        return [...others, ...everyone];
    });
}

async function create(data) {
    const role = await prisma.v2Role.create({ data });
    await cache.del(guildRolesKey(String(role.guildId)));
    return role;
}

async function update(roleId, data) {
    const role = await prisma.v2Role.update({ where: { id: BigInt(roleId) }, data });
    await cache.del(guildRolesKey(String(role.guildId)));
    return role;
}

async function remove(roleId) {
    const existing = await prisma.v2Role.findUnique({
        where: { id: BigInt(roleId) }, select: { guildId: true },
    });
    const result = await prisma.v2Role.delete({ where: { id: BigInt(roleId) } });
    if (existing) await cache.del(guildRolesKey(String(existing.guildId)));
    return result;
}

async function batchUpdatePositions(updates) {
    const rows = await prisma.$transaction(
        updates.map(u => prisma.v2Role.update({
            where: { id: BigInt(u.id) },
            data:  { position: u.position },
            select: { guildId: true },
        }))
    );
    const guildIds = [...new Set(rows.map(r => String(r.guildId)))];
    await Promise.all(guildIds.map(gid => cache.del(guildRolesKey(gid))));
}

async function getMaxPositionForUser(guildId, userId) {
    const guild = await prisma.v2Guild.findUnique({
        where: { id: BigInt(guildId) },
        select: { ownerId: true },
    });
    if (guild && guild.ownerId === Number(userId)) return Number.MAX_SAFE_INTEGER;

    const member = await prisma.v2Member.findUnique({
        where: { guildId_userId: { guildId: BigInt(guildId), userId: Number(userId) } },
        select: { memberRoles: { select: { role: { select: { position: true } } } } },
    });
    if (!member) return -1;
    const positions = member.memberRoles.map(mr => mr.role.position);
    return positions.length > 0 ? Math.max(...positions) : 0;
}

module.exports = { findById, findByGuild, create, update, remove, batchUpdatePositions, getMaxPositionForUser };
