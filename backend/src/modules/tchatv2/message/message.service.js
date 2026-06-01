'use strict';

const { prisma }  = require('../../../shards/database');
const { redis }   = require('../../../shards/redisClient');
const repo        = require('./message.repository');
const { parseMentions } = require('./mention.service');
const { nextV2, V2_EPOCH_MS } = require('../lib/snowflake');
const { hasPermission, Permission, MentionType, MessageType } = require('../tchatv2.constants');
const { getChannelPermissions } = require('../permissions/permission.cache');
const emitter           = require('../sockets/socket.emitter');
const { enqueueEmbeds } = require('./embed.service');
const audit             = require('../moderation/audit.service');
const { scheduleNotificationJob } = require('../notification/notification.worker');
const { AuditLogActionType } = require('../tchatv2.constants');

const metrics = require('../monitoring/metrics');

const NONCE_TTL_SEC = 60;

// ── helpers ──────────────────────────────────────────────────────────────────

function err(msg, status, code) {
    const e = new Error(msg);
    e.statusCode = status;
    e.code       = code;
    return e;
}

async function isTimedOut(guildId, userId) {
    const m = await prisma.v2Member.findUnique({
        where: { guildId_userId: { guildId: BigInt(guildId), userId: Number(userId) } },
        select: { timeoutUntil: true },
    });
    return m?.timeoutUntil ? m.timeoutUntil > new Date() : false;
}

async function getMemberSnapshot(guildId, userId) {
    const member = await prisma.v2Member.findUnique({
        where: { guildId_userId: { guildId: BigInt(guildId), userId: Number(userId) } },
        select: { nickname: true, avatarHash: true, user: { select: { username: true } } },
    });
    return {
        username:   member?.user?.username  ?? String(userId),
        avatarHash: member?.avatarHash      ?? null,
        nickname:   member?.nickname        ?? null,
    };
}

function buildMentionRows(messageId, mentions) {
    const rows = [];
    for (const uid  of mentions.users)    rows.push({ id: nextV2(), messageId, targetId: uid,  type: MentionType.USER });
    for (const rid  of mentions.roles)    rows.push({ id: nextV2(), messageId, targetId: rid,  type: MentionType.ROLE });
    for (const cid  of mentions.channels) rows.push({ id: nextV2(), messageId, targetId: cid,  type: MentionType.CHANNEL });
    if (mentions.everyone) rows.push({ id: nextV2(), messageId, targetId: 0n, type: MentionType.EVERYONE });
    if (mentions.here)     rows.push({ id: nextV2(), messageId, targetId: 0n, type: MentionType.HERE });
    return rows;
}

// ── TASK 4.3 — création ───────────────────────────────────────────────────────

async function createMessage({ channelId, guildId, authorId, content, nonce, referencedMessageId, attachmentIds = [], perms }) {
    const cid = BigInt(channelId);
    const gid = BigInt(guildId);
    const uid = Number(authorId);

    if (await isTimedOut(gid, uid)) throw err('You are timed out', 403, 50013);

    // P0.4 — Nonce deduplication (Redis SET NX EX 60). Si nonce déjà vu pour cet auteur/channel,
    // retourner le message existant pour idempotency (retry réseau, double-clic).
    let nonceKey = null;
    if (nonce) {
        nonceKey = `v2:msg:nonce:${uid}:${cid}:${nonce}`;
        const placeholder = 'pending';
        const setRes = await redis.set(nonceKey, placeholder, 'NX', 'EX', NONCE_TTL_SEC);
        if (setRes === null) {
            // Collision — récupérer messageId stocké (peut être 'pending' si concurrent en cours)
            const existing = await redis.get(nonceKey);
            if (existing && existing !== placeholder) {
                const dup = await repo.findById(BigInt(existing));
                if (dup) return dup;
            }
            throw err('Duplicate nonce', 429, 40060);
        }
    }

    const mentions = parseMentions(content || '');

    // Strip @everyone/@here sans permission
    if (mentions.everyone || mentions.here) {
        const p = perms ?? await getChannelPermissions(channelId, guildId, authorId);
        if (!hasPermission(p, Permission.MENTION_EVERYONE)) {
            mentions.everyone = false;
            mentions.here     = false;
        }
    }

    if (attachmentIds.length > 0 && perms != null) {
        if (!hasPermission(perms, Permission.ATTACH_FILES)) throw err('Missing Permissions', 403, 50013);
    }

    const snapshot    = await getMemberSnapshot(gid, uid);
    const mentionsJson = JSON.stringify(mentions);
    const messageId   = nextV2();
    const msgType     = referencedMessageId ? MessageType.REPLY : MessageType.DEFAULT;

    let msg;
    try {
        msg = await prisma.$transaction(async (tx) => {
        // P0.1 — Check thread.locked/archived DANS la tx pour fermer la TOCTOU
        const channelRow = await tx.v2Channel.findUnique({
            where: { id: cid },
            select: { threadMetadata: { select: { locked: true, archived: true } } },
        });
        if (channelRow?.threadMetadata?.locked)   throw err('Thread is locked',   423, 50083);
        if (channelRow?.threadMetadata?.archived) throw err('Thread is archived', 423, 50084);

        // Vérifier attachments non encore liés
        if (attachmentIds.length > 0) {
            const found = await tx.v2Attachment.findMany({
                where: { id: { in: attachmentIds.map(BigInt) }, messageId: null },
                select: { id: true },
            });
            if (found.length !== attachmentIds.length) {
                throw err('One or more attachments are invalid or already used', 400, 40005);
            }
        }

        const m = await tx.v2Message.create({
            data: {
                id: messageId,
                channelId: cid,
                authorId:  uid,
                content:   content || '',
                nonce:     nonce   || null,
                referencedMessageId: referencedMessageId ? BigInt(referencedMessageId) : null,
                type:              msgType,
                authorUsername:    snapshot.username,
                authorAvatarHash:  snapshot.avatarHash,
                authorNickname:    snapshot.nickname,
                mentionsJson,
            },
            select: repo.MESSAGE_SELECT,
        });

        const mentionRows = buildMentionRows(m.id, mentions);
        if (mentionRows.length > 0) await tx.v2MessageMention.createMany({ data: mentionRows });

        if (attachmentIds.length > 0) {
            await tx.v2Attachment.updateMany({
                where: { id: { in: attachmentIds.map(BigInt) } },
                data:  { messageId: m.id },
            });
        }

        await tx.v2Channel.update({ where: { id: cid }, data: { lastMessageId: m.id } });

        // Re-fetch si attachments liés après le create — sinon m.attachments = []
        if (attachmentIds.length > 0) {
            return tx.v2Message.findUnique({ where: { id: m.id }, select: repo.MESSAGE_SELECT });
        }
        return m;
        });
    } catch (e) {
        if (nonceKey) await redis.del(nonceKey).catch(() => {});
        throw e;
    }

    // Persiste mapping nonce → messageId pour idempotency sur retry
    if (nonceKey) await redis.set(nonceKey, String(msg.id), 'EX', NONCE_TTL_SEC).catch(() => {});

    metrics.incMessage();

    repo.invalidateLastMsgCache(channelId);
    // Invalide aussi le cache des channels du guild (lastMessageId mis à jour)
    require('../channel/channel.repository').invalidateGuildChannelsCache(guildId).catch(() => {});

    // Broadcast MESSAGE_CREATE — nonce inclus pour matching côté client.
    // Hydrate referencedMessage (sans userReactions — broadcast neutre).
    const broadcast = await repo.hydrateOne(msg, null);
    emitter.messageCreate(String(channelId), String(guildId), broadcast);

    // Auto-subscribe sender si message dans un forum post, puis notifier les abonnés
    const forumSvc = require('../thread/forum.service');
    try {
        const channelMeta = await prisma.v2Channel.findUnique({
            where: { id: cid },
            select: { type: true, parentId: true },
        });
        if (channelMeta?.type === 11 && channelMeta?.parentId != null) {
            const parentMeta = await prisma.v2Channel.findUnique({
                where: { id: channelMeta.parentId },
                select: { type: true },
            });
            if (parentMeta?.type === 15) {
                await forumSvc.subscribeToPost(String(channelId), authorId);
                const subscriberIds = await forumSvc.getPostSubscriberUserIds(String(channelId));
                if (subscriberIds.length > 0) {
                    emitter.threadMessageNotify(
                        String(guildId),
                        String(channelMeta.parentId),
                        String(channelId),
                        subscriberIds,
                        String(msg.id),
                    );
                }
            }
        }
    } catch { /* non-bloquant — ne doit jamais bloquer la création du message */ }

    // Enqueue génération OpenGraph si permission EMBED_LINKS et contenu avec URL
    if (content && hasPermission(perms ?? 0n, Permission.EMBED_LINKS)) {
        enqueueEmbeds(content, messageId).catch(() => {});
    }

    // P2.2 — Push notifications pour les mentions
    const mentionedUserIds = (broadcast.mentionsJson
        ? (typeof broadcast.mentionsJson === 'string'
            ? JSON.parse(broadcast.mentionsJson)
            : broadcast.mentionsJson).users ?? []
        : []).map(Number).filter(id => id !== uid);

    if (mentionedUserIds.length > 0) {
        scheduleNotificationJob({
            type: 'mention',
            recipientIds: mentionedUserIds,
            messageId: String(messageId),
            channelId: String(channelId),
            guildId: String(guildId),
            authorUsername: snapshot.username,
            contentPreview: (content || '').slice(0, 100),
        }).catch(() => {});
    }

    return msg;
}

// ── TASK 4.7 — édition ────────────────────────────────────────────────────────

async function editMessage(messageId, userId, { content }) {
    const mid = BigInt(messageId);
    const uid = Number(userId);

    const msg = await repo.findById(mid);
    if (!msg)              throw err('Unknown Message', 404, 10008);
    if (msg.authorId !== uid) throw err('Missing Permissions', 403, 50013);

    const mentions    = parseMentions(content || '');
    const mentionsJson = JSON.stringify(mentions);

    const m = await prisma.$transaction(async (tx) => {
        // Archiver le contenu actuel avant écrasement (P2.4 — historique édition)
        await tx.v2MessageEdit.create({
            data: { id: nextV2(), messageId: mid, content: msg.content, editorId: uid },
        });

        const updated = await tx.v2Message.update({
            where: { id: mid },
            data:  { content, mentionsJson, editedAt: new Date() },
            select: repo.MESSAGE_SELECT,
        });

        await tx.v2MessageMention.deleteMany({ where: { messageId: mid } });
        const mentionRows = buildMentionRows(mid, mentions);
        if (mentionRows.length > 0) await tx.v2MessageMention.createMany({ data: mentionRows });

        return updated;
    });

    repo.invalidateLastMsgCache(String(m.channelId));
    const broadcast = await repo.hydrateOne(m, null);
    emitter.messageUpdate(String(m.channelId), broadcast);
    return m;
}

// ── TASK 4.7 — suppression ────────────────────────────────────────────────────

async function deleteMessage(messageId, userId, { perms, channelId, guildId } = {}) {
    const mid = BigInt(messageId);
    const uid = Number(userId);

    const msg = await repo.findById(mid);
    if (!msg) throw err('Unknown Message', 404, 10008);

    const isAuthor = msg.authorId === uid;
    let canDelete  = isAuthor;

    if (!canDelete) {
        const p = perms ?? await getChannelPermissions(channelId, guildId, userId);
        canDelete = hasPermission(p, Permission.MANAGE_MESSAGES);
    }
    if (!canDelete) throw err('Missing Permissions', 403, 50013);

    const cid = msg.channelId;
    await repo.remove(mid);
    repo.invalidateLastMsgCache(String(cid));
    emitter.messageDelete(String(cid), String(messageId));

    // Audit log : suppression par un modérateur (pas l'auteur)
    if (!isAuthor && guildId) {
        audit.log({
            guildId,
            actorId:    userId,
            targetId:   messageId,
            actionType: AuditLogActionType.MESSAGE_DELETE,
        });
    }

    return { id: String(messageId) };
}

// ── TASK 4.4 — bulk delete ────────────────────────────────────────────────────

async function bulkDeleteMessages(channelId, ids) {
    const twoWeeksAgoMs = Date.now() - 14 * 24 * 60 * 60 * 1000;

    for (const id of ids) {
        const bid  = BigInt(id);
        const tsMs = Number((bid >> 22n) + V2_EPOCH_MS);
        if (tsMs < twoWeeksAgoMs) {
            throw err('Cannot bulk delete messages older than 2 weeks', 400, 50034);
        }
    }

    await repo.bulkDelete(channelId, ids);
    repo.invalidateLastMsgCache(channelId);
    emitter.messageDeleteBulk(String(channelId), ids);
    return { count: ids.length };
}

module.exports = { createMessage, editMessage, deleteMessage, bulkDeleteMessages, isTimedOut };
