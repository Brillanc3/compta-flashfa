'use strict';

const { prisma } = require('../../../shards/database');
const repo = require('./ban.repository');
const memberRepo = require('../member/member.repository');
const { invalidateUser } = require('../permissions/permission.cache');
const audit = require('./audit.service');
const { AuditLogActionType } = require('../tchatv2.constants');

async function banMember(guildId, targetUserId, requesterId, { reason, deleteMessageDays = 0 }) {
    const gid = BigInt(guildId);
    const tid = Number(targetUserId);

    // Owner cannot be banned
    const guild = await prisma.v2Guild.findUnique({ where: { id: gid }, select: { ownerId: true } });
    if (!guild) throw Object.assign(new Error('Unknown Guild'), { status: 404 });
    if (guild.ownerId === tid) throw Object.assign(new Error('Cannot ban the guild owner'), { status: 403 });

    // Hierarchy check: requester's highest role must be > target's
    const [reqMember, targetMember] = await Promise.all([
        memberRepo.findMember(guildId, requesterId),
        memberRepo.findMember(guildId, targetUserId),
    ]);
    if (reqMember && targetMember) {
        const reqMax    = Math.max(0, ...reqMember.memberRoles.map(mr => mr.position ?? 0));
        const targetMax = Math.max(0, ...targetMember.memberRoles.map(mr => mr.position ?? 0));
        if (targetMax >= reqMax && Number(requesterId) !== guild.ownerId) {
            throw Object.assign(new Error('Cannot ban member with equal or higher role'), { status: 403 });
        }
    }

    await prisma.$transaction(async (tx) => {
        await tx.v2Ban.upsert({
            where: { guildId_userId: { guildId: gid, userId: tid } },
            create: { guildId: gid, userId: tid, reason: reason ?? null },
            update: { reason: reason ?? null },
        });
        await tx.v2Member.deleteMany({ where: { guildId: gid, userId: tid } });
    });

    await invalidateUser(guildId, targetUserId);

    audit.log({
        guildId,
        actorId:    requesterId,
        targetId:   targetUserId,
        actionType: AuditLogActionType.MEMBER_BAN_ADD,
        reason:     reason ?? null,
    });
}

async function unbanMember(guildId, targetUserId, actorId) {
    const ban = await repo.findBan(guildId, targetUserId);
    if (!ban) throw Object.assign(new Error('Unknown Ban'), { status: 404 });
    await repo.deleteBan(guildId, targetUserId);

    audit.log({
        guildId,
        actorId:    actorId ?? null,
        targetId:   targetUserId,
        actionType: AuditLogActionType.MEMBER_BAN_REMOVE,
    });
}

module.exports = { banMember, unbanMember };
