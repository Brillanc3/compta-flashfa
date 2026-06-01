'use strict';

const { prisma }      = require('../../../shards/database');
const { redis }       = require('../../../shards/redisClient');
const { nextV2 }      = require('../lib/snowflake');
const { ChannelType } = require('../tchatv2.constants');

// ── helpers ──────────────────────────────────────────────────────────────────

function err(msg, status, code) {
    const e = new Error(msg);
    e.statusCode = status;
    if (code) e.code = code;
    return e;
}

// ── openDm — créer ou rouvrir un DM 1-1 (avec mutex Redis anti-race) ─────────

async function openDm(userId, targetUserId) {
    if (Number(userId) === Number(targetUserId)) {
        throw err('Cannot DM yourself', 400, 'SELF_DM');
    }

    // Clé de lock déterministe — ordonner les IDs pour éviter deadlock A-B vs B-A
    const [uid1, uid2] = [Number(userId), Number(targetUserId)].sort((a, b) => a - b);
    const lockKey = `v2:dm:lock:${uid1}:${uid2}`;

    const acquired = redis ? await redis.set(lockKey, '1', 'NX', 'EX', 10) : 'OK';
    if (!acquired) {
        // Appel concurrent en cours — attendre et réessayer une fois
        await new Promise(r => setTimeout(r, 100));
        return openDm(userId, targetUserId);
    }

    try {
        const existing = await prisma.$queryRaw`
            SELECT c.id FROM v2_channel c
            JOIN v2_dm_recipient r1 ON r1.channelId = c.id AND r1.userId = ${Number(userId)}
            JOIN v2_dm_recipient r2 ON r2.channelId = c.id AND r2.userId = ${Number(targetUserId)}
            WHERE c.type = ${ChannelType.DM}
            LIMIT 1
        `;

        if (existing.length > 0) {
            await prisma.v2DmRecipient.updateMany({
                where: {
                    channelId: existing[0].id,
                    userId: { in: [Number(userId), Number(targetUserId)] },
                },
                data: { hiddenAt: null },
            });
            return { id: String(existing[0].id) };
        }

        const channelId = nextV2();
        await prisma.$transaction([
            prisma.v2Channel.create({
                data: {
                    id: channelId,
                    type: ChannelType.DM,
                    name: '',
                    guildId: null,
                },
            }),
            prisma.v2DmRecipient.createMany({
                data: [
                    { id: nextV2(), channelId, userId: Number(userId) },
                    { id: nextV2(), channelId, userId: Number(targetUserId) },
                ],
            }),
        ]);

        return { id: String(channelId) };
    } finally {
        if (redis) await redis.del(lockKey);
    }
}

// ── createGroupDm ─────────────────────────────────────────────────────────────

async function createGroupDm(creatorId, memberIds, name = '') {
    if (memberIds.length < 2 || memberIds.length > 9) {
        throw err('Group DM requires 2-9 additional members', 400, 'INVALID_MEMBER_COUNT');
    }

    const allMemberIds = [Number(creatorId), ...memberIds.map(Number)];
    const channelId    = nextV2();

    await prisma.$transaction([
        prisma.v2Channel.create({
            data: { id: channelId, type: ChannelType.GROUP_DM, name, guildId: null },
        }),
        prisma.v2DmRecipient.createMany({
            data: allMemberIds.map(uid => ({ id: nextV2(), channelId, userId: uid })),
        }),
    ]);

    return { id: String(channelId) };
}

// ── listDms — DMs non cachés du user (2 queries, pas de N+1) ─────────────────

async function listDms(userId) {
    const uid = Number(userId);

    // 1. Channels DM de l'user (IDs + ordre)
    const myRecipients = await prisma.v2DmRecipient.findMany({
        where: { userId: uid, hiddenAt: null },
        select: { channelId: true },
        orderBy: { joinedAt: 'desc' },
    });

    if (!myRecipients.length) return [];

    const channelIds = myRecipients.map(r => r.channelId);

    // 2. Tous les recipients de ces channels en une seule query
    const allRecipients = await prisma.v2DmRecipient.findMany({
        where: { channelId: { in: channelIds } },
        include: {
            user:    { select: { id: true, username: true } },
            channel: { select: { id: true, type: true, name: true } },
        },
    });

    // 3. Grouper par channelId en mémoire
    const byChannel = new Map();
    for (const r of allRecipients) {
        const cid = String(r.channelId);
        if (!byChannel.has(cid)) {
            byChannel.set(cid, { channel: r.channel, recipients: [] });
        }
        byChannel.get(cid).recipients.push({ id: r.user.id, username: r.user.username });
    }

    // 4. Restituer dans l'ordre joinedAt desc, sans l'user courant dans recipients
    return channelIds.map(cid => {
        const entry = byChannel.get(String(cid));
        if (!entry) return null;
        return {
            id:         String(cid),
            type:       entry.channel.type,
            name:       entry.channel.name,
            recipients: entry.recipients.filter(r => r.id !== uid),
        };
    }).filter(Boolean);
}

// ── assertDmMember — vérification membership ──────────────────────────────────

async function assertDmMember(channelId, userId) {
    const r = await prisma.v2DmRecipient.findUnique({
        where: {
            channelId_userId: {
                channelId: BigInt(channelId),
                userId: Number(userId),
            },
        },
    });
    if (!r || r.hiddenAt) {
        throw err('Not a DM recipient', 403, 'FORBIDDEN');
    }
}

// ── closeDm — cacher un DM (soft delete côté user) ───────────────────────────

async function closeDm(channelId, userId) {
    await prisma.v2DmRecipient.updateMany({
        where: { channelId: BigInt(channelId), userId: Number(userId) },
        data: { hiddenAt: new Date() },
    });
}

module.exports = { openDm, createGroupDm, listDms, assertDmMember, closeDm };
