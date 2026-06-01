'use strict';

const { prisma } = require('../../../shards/database');
const repo = require('./member.repository');
const { addRole, removeRole } = require('./member.service');
const { invalidateUser } = require('../permissions/permission.cache');
const audit = require('../moderation/audit.service');
const { AuditLogActionType } = require('../tchatv2.constants');
const companyScope = require('./company-scope.service');
const { findMutualUsers } = require('./mutual.service');
const permRepo = require('../permissions/permission.repository');
const { resolveChannelPermissions } = require('../permissions/permission.service');
const { Permission } = require('../tchatv2.constants');

function normalizeMember(m, everyoneId) {
    return {
        ...m,
        roleIds: (m.memberRoles ?? [])
            .filter(mr => String(mr.roleId) !== everyoneId)
            .sort((a, b) => (b.role?.position ?? 0) - (a.role?.position ?? 0))
            .map(mr => String(mr.roleId)),
    };
}

/**
 * Filtre une liste de membres (vrais + virtuels) sur la permission VIEW_CHANNEL
 * d'un salon donné, en résolvant les overwrites (catégorie + salon) en mémoire.
 * Réutilise le moteur de permissions partagé pour rester cohérent avec l'accès réel.
 */
async function filterByChannelView(guildId, channelId, members) {
    const channel = await prisma.v2Channel.findUnique({
        where:  { id: BigInt(channelId) },
        select: { parentId: true, guildId: true },
    });
    if (!channel || String(channel.guildId) !== String(guildId)) return members;

    const [roles, overwrites, categoryOverwrites, guild] = await Promise.all([
        permRepo.getRoles(guildId),
        permRepo.getChannelOverwrites(channelId),
        channel.parentId ? permRepo.getChannelOverwrites(channel.parentId) : Promise.resolve([]),
        prisma.v2Guild.findUnique({ where: { id: BigInt(guildId) }, select: { ownerId: true } }),
    ]);

    const rolePermissions = new Map(roles.map(r => [r.id, r.permissions]));
    const everyoneRoleId  = BigInt(guildId);
    const ownerId         = guild?.ownerId;

    return members.filter(m => {
        const uid = Number(m.userId);
        if (ownerId != null && uid === Number(ownerId)) return true;
        const memberRoleIds = (m.roleIds || []).map(id => BigInt(id));
        const perms = resolveChannelPermissions({
            isOwner: false,
            memberRoleIds,
            rolePermissions,
            everyoneRoleId,
            categoryOverwrites,
            overwrites,
            userId: uid,
        });
        return (perms & Permission.VIEW_CHANNEL) !== 0n;
    });
}

async function list(req, reply) {
    const { limit, after, channelId } = req.query;
    const { guildId } = req.params;

    const [realMembers, virtualMembers, inactiveIds] = await Promise.all([
        repo.findMembers(guildId, {
            limit: limit ? Number(limit) : 100,
            after: after ?? undefined,
        }),
        companyScope.getCompanyScopeMembers(guildId),
        companyScope.getInactiveEmployeeUserIds(guildId),
    ]);

    const everyoneId = String(guildId);
    // Bug 2 : masque les V2Member orphelins d'employés non-ACTIVE (FIRE/RESIGNED).
    const realActive = realMembers.filter(m => !inactiveIds.has(Number(m.userId)));
    const normalized = realActive.map(m => normalizeMember(m, everyoneId));

    // Injecter le roleId de rang company dans les vrais membres qui y ont droit
    const virtualByUserId = new Map(virtualMembers.map(v => [String(v.userId), v]));
    const augmented = normalized.map(m => {
        const virtual = virtualByUserId.get(String(m.userId));
        if (!virtual || virtual.roleIds.length === 0) return m;
        const existing = new Set(m.roleIds);
        const missing = virtual.roleIds.filter(rid => !existing.has(rid));
        if (missing.length === 0) return m;
        return { ...m, roleIds: [...m.roleIds, ...missing] };
    });

    // Les vrais membres ont priorité ; les virtuels remplissent les absences
    const realUserIds = new Set(augmented.map(m => String(m.userId)));
    const merged = [
        ...augmented,
        ...virtualMembers.filter(v => !realUserIds.has(String(v.userId))),
    ];

    // Bug 3 : si un salon est ciblé, ne renvoie que les membres pouvant le voir
    // (overwrites des rôles de rang company pris en compte).
    const result = channelId ? await filterByChannelView(guildId, channelId, merged) : merged;

    return reply.send(result);
}

async function getOne(req, reply) {
    const { guildId, userId } = req.params;
    const member = await repo.findMember(guildId, userId);
    if (!member) return reply.code(404).send({ code: 10007, message: 'Unknown Member' });
    return reply.send(normalizeMember(member, String(guildId)));
}

async function update(req, reply) {
    try {
        const { guildId, userId } = req.params;
        const { nickname, roles } = req.body;
        const uid = Number(userId);

        const member = await repo.findMember(guildId, uid);
        if (!member) return reply.code(404).send({ code: 10007, message: 'Unknown Member' });

        if (nickname !== undefined) {
            await repo.updateMember(guildId, uid, { nickname: nickname ?? null });
        }

        if (Array.isArray(roles)) {
            const current = new Set(member.memberRoles.map(mr => String(mr.roleId)));
            const desired = new Set(roles.map(String));
            for (const rid of desired) {
                if (!current.has(rid)) await addRole(guildId, uid, rid);
            }
            for (const rid of current) {
                if (!desired.has(rid)) await removeRole(guildId, uid, rid);
            }
        }

        await invalidateUser(guildId, uid);
        const updated = await repo.findMember(guildId, uid);
        return reply.send(normalizeMember(updated, String(guildId)));
    } catch (err) {
        return reply.code(err.status || 500).send({ message: err.message });
    }
}

async function kick(req, reply) {
    try {
        const { guildId, userId } = req.params;
        const member = await repo.findMember(guildId, userId);
        if (!member) return reply.code(404).send({ code: 10007, message: 'Unknown Member' });

        const guild = await prisma.v2Guild.findUnique({
            where: { id: BigInt(guildId) },
            select: { companyId: true },
        });
        if (guild?.companyId) {
            const emp = await prisma.companyEmployee.findFirst({
                where: { companyId: guild.companyId, userId: Number(userId), status: 'ACTIVE' },
                select: { id: true },
            });
            if (emp) return reply.code(403).send({ code: 50013, message: 'Impossible d\'exclure un employé actif de la guild de sa company' });
        }

        await repo.removeMember(guildId, userId);
        await invalidateUser(guildId, userId);
        audit.log({
            guildId,
            actorId:    req.user.id,
            targetId:   userId,
            actionType: AuditLogActionType.MEMBER_KICK,
        });
        return reply.code(204).send();
    } catch (err) {
        return reply.code(err.status || 500).send({ message: err.message });
    }
}

async function putRole(req, reply) {
    try {
        await addRole(req.params.guildId, req.params.userId, req.params.roleId);
        return reply.code(204).send();
    } catch (err) {
        return reply.code(err.status || 500).send({ message: err.message });
    }
}

async function deleteRole(req, reply) {
    try {
        await removeRole(req.params.guildId, req.params.userId, req.params.roleId);
        return reply.code(204).send();
    } catch (err) {
        return reply.code(err.status || 500).send({ message: err.message });
    }
}

async function mutual(req, reply) {
    const { q, excludeGuildId, limit } = req.query;
    const users = await findMutualUsers({
        callerId:       req.user.id,
        q:              q ?? null,
        excludeGuildId: excludeGuildId ?? null,
        limit:          limit ?? 20,
    });
    return reply.send(users);
}

module.exports = { list, getOne, update, kick, putRole, deleteRole, mutual };
