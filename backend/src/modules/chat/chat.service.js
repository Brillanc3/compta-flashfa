'use strict';

const prisma = require('../../db');
const { generateSnowflake } = require('../../utils/snowflake');
const { resolvePermissionsForChannel } = require('./chat.permissionResolver');
const { emitGatewayEvent } = require('../../core/gateway/gateway.emitter');
const { scanText } = require('../../lib/profanityFilter');
const { createNotification } = require('../../services/notificationService');

function toAttachmentDto(channelId, a) {
    return {
        id: a.id?.toString?.() ?? String(a.id),
        publicId: a.publicId,
        url: `/api/attachments/${String(channelId)}/${String(a.publicId)}`,
        mimeType: a.mimeType,
        byteSize: a.byteSize,
        width: a.width ?? null,
        height: a.height ?? null,
        createdAt: a.createdAt,
    };
}

function toMessageDto(msg) {
    const channelId = msg.channelId?.toString?.() ?? String(msg.channelId);

    return {
        id: msg.id?.toString?.() ?? String(msg.id),
        channelId,
        authorId: msg.authorId,
        content: msg.content ?? '',
        createdAt: msg.createdAt,
        editedAt: msg.editedAt,
        deletedAt: msg.deletedAt,

        authorName: msg.author?.name ?? 'Utilisateur',
        authorAvatar: msg.author?.imageUrl ?? null,

        attachments: Array.isArray(msg.attachments)
            ? msg.attachments.map((a) => toAttachmentDto(channelId, a))
            : [],

        replyTo: msg.replyTo
            ? {
                id: msg.replyTo.id?.toString?.() ?? String(msg.replyTo.id),
                content: msg.replyTo.content ?? '',
                author: msg.replyTo.author
                    ? { id: msg.replyTo.author.id, username: msg.replyTo.author.username }
                    : null,
            }
            : null,

        reactions: Array.isArray(msg.reactions)
            ? Object.values(
                msg.reactions.reduce((acc, r) => {
                    const emoji = r.emoji;
                    const uid = r.user?.id ?? r.userId;
                    if (!acc[emoji]) acc[emoji] = { emoji, count: 0, userIds: [] };
                    acc[emoji].count++;
                    if (uid != null) acc[emoji].userIds.push(uid);
                    return acc;
                }, {})
            )
            : [],
    };
}

async function resolvePermissions(userId, channelId) {
    if (!channelId || channelId === 'null' || channelId === 'undefined') {
        return {
            can: {
                viewChannel: false,
                sendMessages: false,
                manageChannel: false,
                manageMessages: false,
            }
        };
    }

    try {
        return resolvePermissionsForChannel({
            userId,
            channelId: BigInt(channelId),
            prisma,
        });
    } catch (e) {
        return {
            can: {
                viewChannel: false,
                sendMessages: false,
                manageChannel: false,
                manageMessages: false,
            }
        };
    }
}

// ============================================================================
//  CATEGORIES
// ============================================================================
async function listCategories(companyId) {
    return prisma.chatCategory.findMany({
        where: { companyId: Number(companyId) },
        orderBy: { position: 'asc' },
        include: { channels: true },
    });
}

async function createCategory(companyId, data) {
    return prisma.chatCategory.create({
        data: {
            id: BigInt(generateSnowflake()),
            companyId: Number(companyId),
            name: data.name,
            position: data.position ?? 0,
        },
    });
}

async function updateCategory(companyId, categoryId, data) {
    const safe = {};
    if (data.name != null) safe.name = data.name;
    if (data.position != null) safe.position = data.position;
    return prisma.chatCategory.update({
        where: { id: BigInt(categoryId) },
        data: safe,
    });
}

async function deleteCategory(companyId, categoryId) {
    return prisma.chatCategory.delete({
        where: { id: BigInt(categoryId) },
    });
}

// ============================================================================
//  CATEGORY OVERRIDES
// ============================================================================
async function getCategoryRankOverrides(categoryId) {
    return prisma.chatCategoryRankOverride.findMany({
        where: { categoryId: BigInt(categoryId) },
        include: { rank: true },
        orderBy: { rankId: 'asc' },
    });
}

async function setCategoryRankOverride(categoryId, rankId, allowBits, denyBits) {
    const allow = allowBits != null ? BigInt(allowBits) : 0n;
    const deny = denyBits != null ? BigInt(denyBits) : 0n;

    return prisma.chatCategoryRankOverride.upsert({
        where: {
            categoryId_rankId: {
                categoryId: BigInt(categoryId),
                rankId: Number(rankId),
            },
        },
        create: {
            categoryId: BigInt(categoryId),
            rankId: Number(rankId),
            allowBits: allow,
            denyBits: deny,
        },
        update: { allowBits: allow, denyBits: deny },
    });
}

async function removeCategoryRankOverride(categoryId, rankId) {
    await prisma.chatCategoryRankOverride.delete({
        where: {
            categoryId_rankId: {
                categoryId: BigInt(categoryId),
                rankId: Number(rankId),
            },
        },
    });
}

async function getCategoryUserOverrides(categoryId) {
    return prisma.chatCategoryUserOverride.findMany({
        where: { categoryId: BigInt(categoryId) },
        include: { user: true },
        orderBy: { userId: 'asc' },
    });
}

async function setCategoryUserOverride(categoryId, userId, allowBits, denyBits) {
    const allow = allowBits != null ? BigInt(allowBits) : 0n;
    const deny = denyBits != null ? BigInt(denyBits) : 0n;

    return prisma.chatCategoryUserOverride.upsert({
        where: {
            categoryId_userId: {
                categoryId: BigInt(categoryId),
                userId: Number(userId),
            },
        },
        create: {
            categoryId: BigInt(categoryId),
            userId: Number(userId),
            allowBits: allow,
            denyBits: deny,
        },
        update: { allowBits: allow, denyBits: deny },
    });
}

async function removeCategoryUserOverride(categoryId, userId) {
    await prisma.chatCategoryUserOverride.delete({
        where: {
            categoryId_userId: {
                categoryId: BigInt(categoryId),
                userId: Number(userId),
            },
        },
    });
}

async function listChannelsInCategory(categoryId) {
    return prisma.chatChannel.findMany({
        where: { categoryId: BigInt(categoryId) },
        select: { id: true, syncedWithCategory: true },
    });
}

// ============================================================================
//  CHANNELS
// ============================================================================
async function listChannels(companyId, userId) {
    companyId = Number(companyId);

    const channels = await prisma.chatChannel.findMany({
        where: { companyId, isArchived: false },
        include: {
            category: true,
            readStates: { where: { userId } },
        },
        orderBy: [{ category: { position: 'asc' } }, { position: 'asc' }],
    });

    const visibleChannels = [];

    for (const ch of channels) {
        try {
            const perms = await resolvePermissionsForChannel({
                userId,
                channelId: ch.id,
                prisma,
            });

            if (!perms.can.viewChannel) continue;

            visibleChannels.push({
                id: ch.id.toString(),
                name: ch.name,
                topic: ch.topic,
                position: ch.position,
                type: ch.type,
                syncedWithCategory: ch.syncedWithCategory,
                categoryId: ch.categoryId?.toString() ?? null,
                lastMessageId: ch.lastMessageId ? ch.lastMessageId.toString() : null,
                lastRead: ch.readStates?.[0]?.lastReadMessageId
                    ? ch.readStates[0].lastReadMessageId.toString()
                    : null,
                permissions: perms.can,
            });
        } catch (err) {
            // ignore salon si résolution permissions crash
            continue;
        }
    }

    return visibleChannels;
}

async function getChannel(channelId) {
    return prisma.chatChannel.findUnique({
        where: { id: BigInt(channelId) },
        include: { category: true },
    });
}

async function createChannel(companyId, userId, data) {
    const channelId = BigInt(generateSnowflake());
    const companyIdNum = Number(companyId);
    const VIEW_CHANNEL = 1n; // ChatPermissionFlags.VIEW_CHANNEL

    const categoryId = data.categoryId ? BigInt(data.categoryId) : null;
    const isPrivate = Boolean(data.isPrivate);

    // Discord rule: a channel made private MUST desync from category so its own
    // overrides take effect. A normal channel inherits parent category perms = synced.
    const syncedWithCategory = categoryId != null && !isPrivate;

    return prisma.$transaction(async (tx) => {
        const channel = await tx.chatChannel.create({
            data: {
                id: channelId,
                companyId: companyIdNum,
                categoryId,
                name: data.name,
                topic: data.topic ?? null,
                position: data.position ?? 0,
                type: 'TEXT',
                syncedWithCategory,
            },
        });

        if (isPrivate) {
            const allowedRanks = Array.isArray(data.allowedRanks) ? data.allowedRanks.map(Number) : [];
            const allowedUsers = Array.isArray(data.allowedUsers) ? data.allowedUsers.map(Number) : [];

            if (!allowedUsers.includes(Number(userId))) {
                allowedUsers.push(Number(userId));
            }

            const allRanks = await tx.rank.findMany({
                where: { companyId: companyIdNum },
                select: { id: true },
            });

            for (const r of allRanks) {
                const isAllowed = allowedRanks.includes(r.id);
                await tx.chatChannelRankOverride.create({
                    data: {
                        channelId,
                        rankId: r.id,
                        allowBits: isAllowed ? VIEW_CHANNEL : 0n,
                        denyBits: isAllowed ? 0n : VIEW_CHANNEL,
                    },
                });
            }

            for (const uid of allowedUsers) {
                await tx.chatChannelUserOverride.upsert({
                    where: { channelId_userId: { channelId, userId: uid } },
                    create: {
                        channelId,
                        userId: uid,
                        allowBits: VIEW_CHANNEL,
                        denyBits: 0n,
                    },
                    update: {
                        allowBits: VIEW_CHANNEL,
                        denyBits: 0n,
                    },
                });
            }
        }

        return channel;
    });
}

/**
 * Discord-like resync: drop all channel-level overrides, flip syncedWithCategory=true.
 * After this, channel inherits its category's overrides + default rank perms.
 */
async function syncChannelToCategory(channelId) {
    const id = BigInt(channelId);
    return prisma.$transaction(async (tx) => {
        await tx.chatChannelRankOverride.deleteMany({ where: { channelId: id } });
        await tx.chatChannelUserOverride.deleteMany({ where: { channelId: id } });
        return tx.chatChannel.update({
            where: { id },
            data: { syncedWithCategory: true },
        });
    });
}

/**
 * When a user explicitly edits a channel-level override OR moves channel to a different category,
 * we must mark channel as desynced (otherwise the override would not be evaluated by the resolver).
 */
async function markChannelDesynced(channelId) {
    return prisma.chatChannel.update({
        where: { id: BigInt(channelId) },
        data: { syncedWithCategory: false },
    });
}

async function updateChannel(channelId, data) {
    const safe = {};
    if (data.name != null) safe.name = data.name;
    if (data.topic !== undefined) safe.topic = data.topic;
    if (data.position != null) safe.position = data.position;
    if (data.isArchived != null) safe.isArchived = Boolean(data.isArchived);

    if (data.categoryId !== undefined) {
        safe.categoryId = data.categoryId == null ? null : BigInt(data.categoryId);
    }
    if (data.syncedWithCategory != null) {
        safe.syncedWithCategory = Boolean(data.syncedWithCategory);
    }

    return prisma.chatChannel.update({
        where: { id: BigInt(channelId) },
        data: safe,
    });
}

async function deleteChannel(channelId) {
    await prisma.chatChannel.delete({
        where: { id: BigInt(channelId) },
    });
}

async function getChannelHash(companyId, userId) {
    const channels = await listChannels(companyId, userId);
    return channels.map(c => String(c.id)).sort().join(',');
}

/**
 * Compte le nombre total de messages non lus pour l'utilisateur, sur les salons visibles.
 * - Exclut les messages supprimés (deletedAt != null)
 * - Exclut les messages de l'utilisateur lui-même (authorId == userId)
 * - Utilise chatChannelReadState.lastReadMessageId comme borne "lu"
 */
async function getUnreadCount(companyId, userId) {
    const channels = await listChannels(companyId, userId);

    if (!Array.isArray(channels) || channels.length === 0) {
        return 0;
    }

    const counts = await Promise.all(
        channels.map(async (ch) => {
            let channelId;
            try {
                channelId = BigInt(ch.id);
            } catch {
                return 0;
            }

            const where = {
                channelId,
                deletedAt: null,
                authorId: { not: userId },
            };

            if (ch.lastRead) {
                try {
                    where.id = { gt: BigInt(ch.lastRead) };
                } catch {
                    // ignore lastRead invalide, on compte tout le salon
                }
            }
            // si pas de lastRead → salon jamais lu → on compte tout

            return prisma.chatMessage.count({ where });
        })
    );

    return counts.reduce((sum, n) => sum + (Number(n) || 0), 0);
}


// ============================================================================
//  MESSAGES
// ============================================================================

async function getMessages(channelId, { before, after, limit } = {}) {
    const requested = Number(limit ?? 100);
    const take = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 100) : 100;

    const beforeDate = before ? new Date(before) : null;
    const afterDate = after ? new Date(after) : null;

    const where = {
        channelId: BigInt(channelId),
        deletedAt: null,
    };

    if (beforeDate && !Number.isNaN(beforeDate.getTime())) {
        where.createdAt = { ...(where.createdAt ?? {}), lt: beforeDate };
    }
    if (afterDate && !Number.isNaN(afterDate.getTime())) {
        where.createdAt = { ...(where.createdAt ?? {}), gt: afterDate };
    }

    const rows = await prisma.chatMessage.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take,
        include: {
            author: { select: { id: true, name: true, imageUrl: true } },
            attachments: {
                select: {
                    id: true,
                    publicId: true,
                    mimeType: true,
                    byteSize: true,
                    width: true,
                    height: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'asc' },
            },
            replyTo: {
                select: {
                    id: true,
                    content: true,
                    author: { select: { id: true, username: true } },
                },
            },
            reactions: {
                include: { user: { select: { id: true } } },
            },
        },
    });

    return rows.reverse().map(toMessageDto);
}

/**
 * @param {string|number|bigint} channelId
 * @param {number} userId
 * @param {string} content
 * @param {Array<{publicId:string,mimeType:string,byteSize:number,width?:number|null,height?:number|null,diskPath:string}>} attachmentInputs
 * @param {string|number|bigint|null} [replyToId]
 */
async function postMessageWithAttachments(channelId, userId, content, attachmentInputs = [], replyToId = null) {
    const messageId = BigInt(generateSnowflake());
    const channelBigint = BigInt(channelId);

    const full = await prisma.$transaction(async (tx) => {
        await tx.chatMessage.create({
            data: {
                id: messageId,
                channelId: channelBigint,
                authorId: userId,
                content: String(content ?? ''),
                replyToId: replyToId ? BigInt(replyToId) : null,
            },
        });

        if (Array.isArray(attachmentInputs) && attachmentInputs.length > 0) {
            for (const input of attachmentInputs) {
                await tx.chatAttachment.create({
                    data: {
                        id: BigInt(generateSnowflake()),
                        channelId: channelBigint,
                        messageId,
                        publicId: String(input.publicId),
                        mimeType: String(input.mimeType),
                        byteSize: Number(input.byteSize) || 0,
                        width: input.width ?? null,
                        height: input.height ?? null,
                        diskPath: String(input.diskPath),
                    },
                });
            }
        }

        await tx.chatChannel.update({
            where: { id: channelBigint },
            data: { lastMessageId: messageId },
        });

        return tx.chatMessage.findUnique({
            where: { id: messageId },
            include: {
                author: { select: { id: true, name: true, imageUrl: true } },
                attachments: {
                    select: {
                        id: true,
                        publicId: true,
                        mimeType: true,
                        byteSize: true,
                        width: true,
                        height: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: 'asc' },
                },
                replyTo: {
                    select: {
                        id: true,
                        content: true,
                        author: { select: { id: true, username: true } },
                    },
                },
                reactions: {
                    include: { user: { select: { id: true } } },
                },
            },
        });
    });

    // Extract and store mentions  — format: <@userId>  <@&rankId>  @everyone
    const MENTION_RE = /<@&(\d+)>|<@(\d+)>|@everyone/g;
    const mentionData = [];
    let m;
    while ((m = MENTION_RE.exec(content ?? '')) !== null) {
        if (m[0] === '@everyone') {
            mentionData.push({ type: 'EVERYONE', targetId: null });
        } else if (m[2] != null) {
            mentionData.push({ type: 'USER', targetId: parseInt(m[2]) });
        } else if (m[1] != null) {
            mentionData.push({ type: 'RANK', targetId: parseInt(m[1]) });
        }
    }

    if (mentionData.length > 0) {
        await prisma.chatMention.createMany({
            data: mentionData.map((md) => ({
                messageId: full.id,
                type: md.type,
                targetId: md.targetId,
            })),
            skipDuplicates: true,
        });
    }

    const dto = toMessageDto(full);

    // WS (ROOM)
    emitGatewayEvent({
        scope: 'ROOM',
        targets: [`channel:${String(channelId)}`],
        event: 'CHAT_MESSAGE_CREATED',
        payload: {
            message: dto,
            authorId: userId,
        },
    });

    const profanity = scanText(content);
    if (profanity.flagged) {
        fetch(`http://127.0.0.1:${process.env.MASTER_PORT || 9090}/status/discord/report-chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-report-secret': process.env.DISCORD_REPORT_SECRET || '' },
            body: JSON.stringify({
                userId: userId,
                channelId: String(channelId),
                messageId: String(messageId),
                description: `L'utilisateur **${dto.authorName}** a utilisé un langage inapproprié.\n\n**Mots détectés :** ${profanity.words.join(', ')}\n**Message original :**\n${profanity.highlighted}`,
                fields: []
            })
        }).catch(err => console.error("Error sending discord chat report:", err));
    }

    // Extraire et notifier les mentions (@[user:ID:Nom], @[rank:ID:Nom], @[everyone])
    notifyMentions(channelBigint, userId, dto.authorName, String(messageId), content).catch(
        (err) => console.error('[chat] notifyMentions error:', err)
    );

    return dto;
}

/**
 * Extrait les mentions du contenu et envoie des notifications aux destinataires.
 * @param {bigint} channelId
 * @param {number} authorId
 * @param {string} authorName
 * @param {string} messageId
 * @param {string} content
 */
async function notifyMentions(channelId, authorId, authorName, messageId, content) {
    // Résoudre la company et les membres autorisés à voir ce salon
    const channel = await prisma.chatChannel.findUnique({
        where: { id: channelId },
        select: { companyId: true },
    });
    if (!channel?.companyId) return;

    const channelMemberList = await getChannelMembers(channelId, channel.companyId);
    const viewableUserIds = new Set(channelMemberList.map(m => m.userId));

    const mentionRegex = /<@&(\d+)>|<@(\d+)>|@everyone/g;
    const recipientSet = new Set();
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
        if (match[0] === '@everyone') {
            viewableUserIds.forEach(uid => {
                if (uid !== authorId) recipientSet.add(uid);
            });
        } else if (match[2] != null) {
            const uid = Number(match[2]);
            if (uid && uid !== authorId && viewableUserIds.has(uid)) recipientSet.add(uid);
        } else if (match[1] != null) {
            const rankId = Number(match[1]);
            const employees = await prisma.companyEmployee.findMany({
                where: { rankId, status: 'ACTIVE' },
                select: { userId: true },
            });
            for (const e of employees) {
                if (e.userId !== authorId && viewableUserIds.has(e.userId)) recipientSet.add(e.userId);
            }
        }
    }

    const recipientUserIds = Array.from(recipientSet);
    if (!recipientUserIds.length) return;

    await createNotification({
        recipientUserIds,
        content: {
            title: `Vous avez été mentionné par ${authorName}`,
            body: content.replace(/<@&(\d+)>|<@(\d+)>|@everyone/g, (tok, rId, uId) => tok === '@everyone' ? '@everyone' : rId ? `@&${rId}` : `@${uId}`),
            channelId: String(channelId),
            messageId,
        },
        type: 'USER_SPECIFIC',
        behavior: 'PERMANENT',
        senderId: authorId,
    });
}

async function postMessage(channelId, userId, content, replyToId = null) {
    return postMessageWithAttachments(channelId, userId, content, [], replyToId);
}



// ---------------------------------------------------------------------------
// Message meta helpers (ownership / deletedAt)
// ---------------------------------------------------------------------------
async function getMessageMeta(channelId, messageId) {
    const row = await prisma.chatMessage.findFirst({
        where: {
            id: BigInt(messageId),
            channelId: BigInt(channelId),
        },
        select: {
            id: true,
            authorId: true,
            deletedAt: true,
        },
    });

    if (!row) return null;

    return {
        id: row.id?.toString?.() ?? String(row.id),
        authorId: row.authorId,
        deletedAt: row.deletedAt,
    };
}

async function assertMessageExistsInChannel(channelId, messageId) {
    const meta = await getMessageMeta(channelId, messageId);
    if (!meta || meta.deletedAt) {
        const err = new Error('Message not found');
        err.statusCode = 404;
        throw err;
    }
    return meta;
}

async function editMessage(channelId, messageId, content) {
    // Safety: ensure message belongs to channel & is not deleted
    const meta = await assertMessageExistsInChannel(channelId, messageId);

    const current = await prisma.chatMessage.findUnique({
        where: { id: BigInt(messageId) },
        select: { content: true },
    });

    // P2.4 — Archiver le contenu avant écrasement
    if (current) {
        await prisma.chatMessageEdit.create({
            data: {
                id: BigInt(generateSnowflake()),
                messageId: BigInt(messageId),
                content: current.content,
                editorId: Number(meta.authorId),
            },
        });
    }

    const msg = await prisma.chatMessage.update({
        where: { id: BigInt(messageId) },
        data: {
            content,
            editedAt: new Date(),
        },
        include: {
            author: { select: { id: true, name: true, imageUrl: true } },
            attachments: {
                select: {
                    id: true,
                    publicId: true,
                    mimeType: true,
                    byteSize: true,
                    width: true,
                    height: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'asc' },
            },
        },
    });

    const dto = toMessageDto(msg);

    emitGatewayEvent({
        scope: 'ROOM',
        targets: [`channel:${String(channelId)}`],
        event: 'CHAT_MESSAGE_UPDATED',
        payload: { message: dto },
    });

    return dto;
}

async function deleteMessage(channelId, messageId) {
    const channelBigint = BigInt(channelId);
    const messageBigint = BigInt(messageId);

    // Safety: ensure message belongs to channel & is not deleted
    await assertMessageExistsInChannel(channelId, messageId);

    await prisma.chatMessage.update({
        where: { id: messageBigint },
        data: { deletedAt: new Date() },
    });

    // Optionnel: On synchronise le lastMessageId du salon si on vient de supprimer le dernier
    const channel = await prisma.chatChannel.findUnique({
        where: { id: channelBigint },
        select: { lastMessageId: true },
    });

    if (channel?.lastMessageId === messageBigint) {
        const nextLast = await prisma.chatMessage.findFirst({
            where: { channelId: channelBigint, deletedAt: null },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
        });

        await prisma.chatChannel.update({
            where: { id: channelBigint },
            data: { lastMessageId: nextLast?.id ?? null },
        });
    }

    emitGatewayEvent({
        scope: 'ROOM',
        targets: [`channel:${String(channelId)}`],
        event: 'CHAT_MESSAGE_DELETED',
        payload: {
            channelId: String(channelId),
            messageId: String(messageId),
        },
    });
}

// ============================================================================
//  OVERRIDES (SQL ici, pas dans controller)
// ============================================================================
async function getRankOverrides(channelId) {
    return prisma.chatChannelRankOverride.findMany({
        where: { channelId: BigInt(channelId) },
        include: { rank: true },
        orderBy: { rankId: 'asc' },
    });
}

async function setRankOverride(channelId, rankId, allowBits, denyBits) {
    const allow = allowBits != null ? BigInt(allowBits) : 0n;
    const deny = denyBits != null ? BigInt(denyBits) : 0n;
    const id = BigInt(channelId);

    return prisma.$transaction(async (tx) => {
        // Setting a channel-level override implies the channel must be desynced
        // from its category — otherwise the resolver would ignore the override.
        await tx.chatChannel.update({
            where: { id },
            data: { syncedWithCategory: false },
        });

        return tx.chatChannelRankOverride.upsert({
            where: {
                channelId_rankId: { channelId: id, rankId: Number(rankId) },
            },
            create: {
                channelId: id,
                rankId: Number(rankId),
                allowBits: allow,
                denyBits: deny,
            },
            update: { allowBits: allow, denyBits: deny },
        });
    });
}

async function removeRankOverride(channelId, rankId) {
    await prisma.chatChannelRankOverride.delete({
        where: {
            channelId_rankId: {
                channelId: BigInt(channelId),
                rankId: Number(rankId),
            },
        },
    });
}

async function getUserOverrides(channelId) {
    return prisma.chatChannelUserOverride.findMany({
        where: { channelId: BigInt(channelId) },
        include: { user: true },
        orderBy: { userId: 'asc' },
    });
}

async function setUserOverride(channelId, userId, allowBits, denyBits) {
    const allow = allowBits != null ? BigInt(allowBits) : 0n;
    const deny = denyBits != null ? BigInt(denyBits) : 0n;
    const id = BigInt(channelId);

    return prisma.$transaction(async (tx) => {
        await tx.chatChannel.update({
            where: { id },
            data: { syncedWithCategory: false },
        });

        return tx.chatChannelUserOverride.upsert({
            where: {
                channelId_userId: { channelId: id, userId: Number(userId) },
            },
            create: {
                channelId: id,
                userId: Number(userId),
                allowBits: allow,
                denyBits: deny,
            },
            update: { allowBits: allow, denyBits: deny },
        });
    });
}

async function removeUserOverride(channelId, userId) {
    await prisma.chatChannelUserOverride.delete({
        where: {
            channelId_userId: {
                channelId: BigInt(channelId),
                userId: Number(userId),
            },
        },
    });
}

// ============================================================================
//  READ STATES
// ============================================================================
async function getReadState(channelId, userId) {
    const state = await prisma.chatChannelReadState.findUnique({
        where: {
            channelId_userId: {
                channelId: BigInt(channelId),
                userId,
            },
        },
    });

    if (!state) return null;

    return {
        channelId: String(state.channelId),
        userId: state.userId,
        lastReadMessageId: state.lastReadMessageId ? String(state.lastReadMessageId) : null,
        lastReadAt: state.lastReadAt,
    };
}

async function updateReadState(channelId, userId) {
    const channelExists = await prisma.chatChannel.findUnique({
        where: { id: BigInt(channelId) },
        select: { id: true },
    });
    if (!channelExists) return null;

    const lastMsg = await prisma.chatMessage.findFirst({
        where: { channelId: BigInt(channelId) },
        orderBy: { createdAt: 'desc' },
        select: { id: true, createdAt: true },
    });

    const state = await prisma.chatChannelReadState.upsert({
        where: {
            channelId_userId: {
                channelId: BigInt(channelId),
                userId,
            },
        },
        create: {
            channelId: BigInt(channelId),
            userId,
            lastReadMessageId: lastMsg?.id ?? null,
            lastReadAt: new Date(),
        },
        update: {
            lastReadMessageId: lastMsg?.id ?? null,
            lastReadAt: new Date(),
        },
    });

    return {
        channelId: String(state.channelId),
        userId: state.userId,
        lastReadMessageId: state.lastReadMessageId ? String(state.lastReadMessageId) : null,
        lastReadAt: state.lastReadAt,
    };
}

async function markAllCompanyChannelsRead(companyId, userId) {
    const channels = await prisma.chatChannel.findMany({
        where: { companyId: Number(companyId), isArchived: false },
        select: { id: true },
    });

    const lastMessages = await prisma.chatMessage.findMany({
        where: { channelId: { in: channels.map(c => c.id) } },
        orderBy: { createdAt: 'desc' },
        distinct: ['channelId'],
        select: { id: true, channelId: true },
    });

    const lastMsgByChannel = Object.fromEntries(lastMessages.map(m => [m.channelId.toString(), m.id]));
    const now = new Date();

    await Promise.all(channels.map(ch =>
        prisma.chatChannelReadState.upsert({
            where: { channelId_userId: { channelId: ch.id, userId } },
            create: {
                channelId: ch.id,
                userId,
                lastReadMessageId: lastMsgByChannel[ch.id.toString()] ?? null,
                lastReadAt: now,
            },
            update: {
                lastReadMessageId: lastMsgByChannel[ch.id.toString()] ?? null,
                lastReadAt: now,
            },
        })
    ));

    return { markedCount: channels.length };
}

// ============================================================================
//  DIRECT MESSAGES (DM)
// ============================================================================
async function listDmConversations(userId) {
    return prisma.chatDmConversation.findMany({
        where: {
            OR: [{ userAId: userId }, { userBId: userId }],
        },
        include: {
            messages: {
                orderBy: { createdAt: 'desc' },
                take: 1,
            },
        },
        orderBy: {
            messages: { _max: { createdAt: 'desc' } },
        },
    });
}

async function getDmConversation(userId, otherUserId) {
    const convo = await prisma.chatDmConversation.findFirst({
        where: {
            OR: [
                { userAId: userId, userBId: Number(otherUserId) },
                { userAId: Number(otherUserId), userBId: userId },
            ],
        },
        include: { messages: true },
    });

    if (convo) return convo;

    const id = BigInt(generateSnowflake());

    return prisma.chatDmConversation.create({
        data: {
            id,
            userAId: userId,
            userBId: Number(otherUserId),
        },
        include: { messages: true },
    });
}

async function postDmMessage(userId, otherUserId, content) {
    const convo = await getDmConversation(userId, otherUserId);

    return prisma.chatDmMessage.create({
        data: {
            id: BigInt(generateSnowflake()),
            conversationId: convo.id,
            authorId: userId,
            content,
        },
    });
}

async function getMentionCount(companyId, userId) {
    const channels = await listChannels(companyId, userId);
    if (!Array.isArray(channels) || channels.length === 0) return 0;

    const employee = await prisma.companyEmployee.findFirst({
        where: { companyId, userId },
        select: { rankId: true },
    });

    const counts = await Promise.all(
        channels.map(async (ch) => {
            let channelId;
            try { channelId = BigInt(ch.id); } catch { return 0; }
            let lastReadId = null;
            if (ch.lastRead) {
                try { lastReadId = BigInt(ch.lastRead); } catch { /* ignore */ }
            }

            const orConditions = [
                { content: { contains: `<@${userId}>` } },
                { content: { contains: '@everyone' } },
            ];
            if (employee?.rankId) {
                orConditions.push({ content: { contains: `<@&${employee.rankId}>` } });
            }

            const mentionWhere = {
                channelId,
                deletedAt: null,
                authorId: { not: userId },
                OR: orConditions,
            };
            if (lastReadId !== null) {
                mentionWhere.id = { gt: lastReadId };
            }

            return prisma.chatMessage.count({ where: mentionWhere });
        })
    );

    return counts.reduce((sum, n) => sum + (Number(n) || 0), 0);
}

async function getTotalUnreadCounts(userId) {
    const employees = await prisma.companyEmployee.findMany({
        where: { userId },
        select: { companyId: true, rankId: true },
    });

    if (!employees.length) return {};

    const result = {};

    for (const { companyId, rankId } of employees) {
        const channels = await listChannels(companyId, userId).catch(() => []);
        if (!Array.isArray(channels) || !channels.length) {
            result[companyId] = { unread: 0, mentions: 0, channels: {} };
            continue;
        }

        const channelData = {};

        await Promise.all(channels.map(async (ch) => {
            let chId;
            try { chId = BigInt(ch.id); } catch { return; }

            const baseWhere = { channelId: chId, deletedAt: null, authorId: { not: userId } };
            if (ch.lastRead) {
                try { baseWhere.id = { gt: BigInt(ch.lastRead) }; } catch {}
            }

            const unread = await prisma.chatMessage.count({ where: baseWhere });
            if (!unread) return;

            // Mention type (user > group)
            let mentionType = null;
            const userMentions = await prisma.chatMessage.count({
                where: { ...baseWhere, content: { contains: `<@${userId}>` } },
            });

            if (userMentions > 0) {
                mentionType = 'user';
            } else {
                const groupOr = [{ content: { contains: '@everyone' } }];
                if (rankId) groupOr.push({ content: { contains: `<@&${rankId}>` } });
                const groupMentions = await prisma.chatMessage.count({
                    where: { ...baseWhere, OR: groupOr },
                });
                if (groupMentions > 0) mentionType = 'group';
            }

            channelData[String(ch.id)] = { unread, mentionType };
        }));

        const totalUnread = Object.values(channelData).reduce((s, c) => s + c.unread, 0);
        const mentions = Object.values(channelData).filter(c => c.mentionType).length;
        result[companyId] = { unread: totalUnread, mentions, channels: channelData };
    }

    return result;
}

// ============================================================================
//  REACTIONS
// ============================================================================
async function addReaction(userId, channelId, messageId, emoji) {
    const msg = await prisma.chatMessage.findFirst({
        where: { id: BigInt(messageId), channelId: BigInt(channelId), deletedAt: null },
    });
    if (!msg) throw Object.assign(new Error('Message not found'), { statusCode: 404 });

    await prisma.chatReaction.upsert({
        where: { messageId_userId_emoji: { messageId: BigInt(messageId), userId, emoji } },
        update: {},
        create: { messageId: BigInt(messageId), userId, emoji },
    });

    const count = await prisma.chatReaction.count({
        where: { messageId: BigInt(messageId), emoji },
    });

    emitGatewayEvent({
        scope: 'ROOM',
        targets: [`channel:${String(channelId)}`],
        event: 'CHAT_REACTION_ADDED',
        payload: { channelId: String(channelId), messageId: String(messageId), emoji, userId, count },
    });

    return { messageId: String(messageId), emoji, count };
}

async function removeReaction(userId, channelId, messageId, emoji) {
    await prisma.chatReaction.deleteMany({
        where: { messageId: BigInt(messageId), userId, emoji },
    });
    const count = await prisma.chatReaction.count({
        where: { messageId: BigInt(messageId), emoji },
    });

    emitGatewayEvent({
        scope: 'ROOM',
        targets: [`channel:${String(channelId)}`],
        event: 'CHAT_REACTION_REMOVED',
        payload: { channelId: String(channelId), messageId: String(messageId), emoji, userId },
    });

    return { messageId: String(messageId), emoji, count };
}

async function getMessageReactions(messageId) {
    const rows = await prisma.chatReaction.groupBy({
        by: ['emoji'],
        where: { messageId: BigInt(messageId) },
        _count: true,
    });
    return rows.map(r => ({ emoji: r.emoji, count: r._count }));
}

// ============================================================================
//  PINS
// ============================================================================
async function pinMessage(userId, channelId, messageId) {
    const msg = await prisma.chatMessage.findFirst({
        where: { id: BigInt(messageId), channelId: BigInt(channelId), deletedAt: null },
    });
    if (!msg) throw Object.assign(new Error('Message not found'), { statusCode: 404 });

    const pin = await prisma.chatPinnedMessage.upsert({
        where: { channelId_messageId: { channelId: BigInt(channelId), messageId: BigInt(messageId) } },
        update: {},
        create: {
            channelId: BigInt(channelId),
            messageId: BigInt(messageId),
            pinnedByUserId: userId,
        },
        include: {
            message: { select: { content: true, authorId: true } },
            pinnedBy: { select: { username: true } },
        },
    });
    return pin;
}

async function unpinMessage(channelId, messageId) {
    await prisma.chatPinnedMessage.deleteMany({
        where: { channelId: BigInt(channelId), messageId: BigInt(messageId) },
    });
}

async function getChannelPins(channelId) {
    return prisma.chatPinnedMessage.findMany({
        where: { channelId: BigInt(channelId) },
        include: {
            message: {
                include: {
                    author: { select: { id: true, username: true } },
                    attachments: true,
                },
            },
            pinnedBy: { select: { id: true, username: true } },
        },
        orderBy: { pinnedAt: 'desc' },
    });
}

// ============================================================================
//  PRESENCE
// ============================================================================
async function getCompanyPresence(companyId) {
    const [employees, presenceRecords] = await Promise.all([
        prisma.companyEmployee.findMany({
            where: { companyId: Number(companyId), status: 'ACTIVE' },
            include: {
                user: { select: { id: true, name: true, username: true } },
                rank: { select: { id: true, name: true, position: true } },
            },
        }),
        prisma.userPresence.findMany({
            where: { companyId: Number(companyId) },
        }),
    ]);

    const presenceMap = new Map(presenceRecords.map(p => [p.userId, p]));

    return employees.map(e => {
        const p = presenceMap.get(e.userId);
        return {
            userId: e.userId,
            status: p?.status ?? 'OFFLINE',
            customEmoji: p?.customEmoji ?? null,
            customText: p?.customText ?? null,
            user: e.user,
            rank: e.rank,
        };
    });
}

async function getChannelMembers(channelId, companyId) {
    const employees = await prisma.companyEmployee.findMany({
        where: { companyId: Number(companyId), status: 'ACTIVE' },
        include: {
            user: { select: { id: true, name: true, username: true } },
            rank: { select: { id: true, name: true, position: true } },
        },
    });

    const results = await Promise.all(
        employees.map(async (e) => {
            try {
                const perms = await resolvePermissionsForChannel({
                    userId: e.userId,
                    channelId: BigInt(channelId),
                    prisma,
                });
                return perms.can.viewChannel ? e : null;
            } catch {
                return null;
            }
        })
    );

    return results.filter(Boolean).map(e => ({
        userId: e.userId,
        name: e.user.name,
        username: e.user.username,
        rank: e.rank,
    }));
}

async function updatePresence(userId, companyId, { status, customEmoji, customText }) {
    return prisma.userPresence.upsert({
        where: { userId_companyId: { userId: Number(userId), companyId: Number(companyId) } },
        update: {
            status,
            customEmoji: customEmoji ?? null,
            customText: customText ?? null,
            lastHeartbeatAt: new Date(),
        },
        create: {
            userId: Number(userId),
            companyId: Number(companyId),
            status,
            customEmoji: customEmoji ?? null,
            customText: customText ?? null,
        },
    });
}

async function heartbeatPresence(userId, companyId) {
    await prisma.userPresence.upsert({
        where: { userId_companyId: { userId: Number(userId), companyId: Number(companyId) } },
        update: { lastHeartbeatAt: new Date() },
        create: { userId: Number(userId), companyId: Number(companyId), status: 'ONLINE' },
    });
}

async function getMessageEditHistory(channelId, messageId) {
    await assertMessageExistsInChannel(channelId, messageId);
    const edits = await prisma.chatMessageEdit.findMany({
        where: { messageId: BigInt(messageId) },
        orderBy: { editedAt: 'desc' },
        select: { id: true, content: true, editorId: true, editedAt: true },
    });
    return edits.map(e => ({ ...e, id: String(e.id) }));
}

module.exports = {
    // Permissions resolver
    resolvePermissions,

    // Categories
    listCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    listChannelsInCategory,

    // Category overrides
    getCategoryRankOverrides,
    setCategoryRankOverride,
    removeCategoryRankOverride,
    getCategoryUserOverrides,
    setCategoryUserOverride,
    removeCategoryUserOverride,

    // Channels
    listChannels,
    getChannel,
    createChannel,
    updateChannel,
    deleteChannel,
    getChannelHash,
    syncChannelToCategory,
    markChannelDesynced,
    getUnreadCount,
    getTotalUnreadCounts,

    // Messages
    getMessages,
    postMessage,
    postMessageWithAttachments,
    editMessage,
    deleteMessage,
    getMessageMeta,
    getMessageEditHistory,

    // Channel overrides
    getRankOverrides,
    setRankOverride,
    removeRankOverride,
    getUserOverrides,
    setUserOverride,
    removeUserOverride,

    // Read state
    getReadState,
    updateReadState,
    markAllCompanyChannelsRead,

    // DM
    listDmConversations,
    getDmConversation,
    postDmMessage,

    // Presence
    getCompanyPresence,
    getChannelMembers,
    updatePresence,
    heartbeatPresence,

    // Reactions
    addReaction,
    removeReaction,
    getMessageReactions,

    // Pins
    pinMessage,
    unpinMessage,
    getChannelPins,

    // Optimized endpoints
    getChannelContext,
    bootstrapChat,
};

// ============================================================================
// OPTIMIZED: getChannelContext — channel + messages + pins + reactions (1 round)
// ============================================================================
async function getChannelContext(userId, companyId, channelId, { limit = 50, cursor } = {}) {
    const chanId = BigInt(channelId);
    const cId = Number(companyId);

    const [channel, messages, pins] = await Promise.all([
        prisma.chatChannel.findFirst({
            where: { id: chanId, companyId: cId },
            include: {
                category: { select: { id: true, name: true } },
            },
        }),
        prisma.chatMessage.findMany({
            where: {
                channelId: chanId,
                deletedAt: null,
                ...(cursor ? { id: { lt: BigInt(cursor) } } : {}),
            },
            orderBy: { id: 'desc' },
            take: Number(limit),
            include: {
                author: { select: { id: true, username: true } },
                attachments: true,
                reactions: {
                    include: { user: { select: { id: true } } },
                },
                replyTo: {
                    select: {
                        id: true,
                        content: true,
                        author: { select: { id: true, username: true } },
                    },
                },
            },
        }),
        prisma.chatPinnedMessage.findMany({
            where: { channelId: chanId },
            include: {
                message: {
                    include: {
                        author: { select: { id: true, username: true } },
                        attachments: true,
                    },
                },
                pinnedBy: { select: { id: true, username: true } },
            },
            orderBy: { pinnedAt: 'desc' },
        }),
    ]);

    if (!channel) throw Object.assign(new Error('Channel not found'), { statusCode: 404 });

    function groupReactions(reactions) {
        const map = {};
        for (const r of reactions) {
            if (!map[r.emoji]) map[r.emoji] = { emoji: r.emoji, count: 0, userIds: [] };
            map[r.emoji].count++;
            map[r.emoji].userIds.push(r.user.id);
        }
        return Object.values(map);
    }

    const messagesDto = messages.reverse().map(m => ({
        id: String(m.id),
        channelId: String(m.channelId),
        authorId: m.author.id,
        authorName: m.author.username,
        content: m.content,
        createdAt: m.createdAt,
        editedAt: m.editedAt ?? null,
        deletedAt: m.deletedAt ?? null,
        replyToId: m.replyToId ? String(m.replyToId) : null,
        attachments: m.attachments.map(a => ({
            publicId: a.publicId,
            url: a.url ?? `/api/chat/attachments/${a.publicId}`,
            mimeType: a.mimeType,
            width: a.width,
            height: a.height,
        })),
        reactions: groupReactions(m.reactions),
        replyTo: m.replyTo ? {
            id: String(m.replyTo.id),
            content: m.replyTo.content,
            author: m.replyTo.author,
        } : null,
    }));

    const hasMore = messages.length === Number(limit);
    const nextCursor = hasMore ? String(messages[0].id) : null;

    return {
        channel: {
            id: String(channel.id),
            name: channel.name,
            topic: channel.topic,
            type: channel.type,
            categoryId: channel.categoryId ? String(channel.categoryId) : null,
            categoryName: channel.category?.name ?? null,
        },
        messages: messagesDto,
        pins: pins.map(p => ({
            id: String(p.id),
            messageId: String(p.messageId),
            pinnedAt: p.pinnedAt,
            pinnedBy: p.pinnedBy,
            message: {
                id: String(p.message.id),
                content: p.message.content,
                author: p.message.author,
                attachments: p.message.attachments.map(a => ({
                    url: a.url ?? `/api/chat/attachments/${a.publicId}`,
                })),
            },
        })),
        pagination: { hasMore, nextCursor },
    };
}

// ============================================================================
// OPTIMIZED: bootstrapChat — categories + channels + presence (1 round)
// ============================================================================
async function bootstrapChat(userId, companyId) {
    const cId = Number(companyId);

    const [categories, unreadStates, activeEmployees, presenceRecords] = await Promise.all([
        prisma.chatCategory.findMany({
            where: { companyId: cId },
            orderBy: { position: 'asc' },
            include: {
                channels: {
                    where: { isArchived: false },
                    orderBy: { position: 'asc' },
                },
            },
        }),
        prisma.chatChannelReadState.findMany({
            where: { userId },
            select: { channelId: true, lastReadMessageId: true },
        }),
        prisma.companyEmployee.findMany({
            where: { companyId: cId, status: 'ACTIVE' },
            select: { userId: true },
        }),
        prisma.userPresence.findMany({
            where: { companyId: cId },
            include: { user: { select: { id: true, username: true } } },
        }),
    ]);

    const activeUserIds = new Set(activeEmployees.map(e => e.userId));
    const presence = presenceRecords.filter(p => activeUserIds.has(p.userId));

    const unreadMap = {};
    for (const rs of unreadStates) {
        unreadMap[String(rs.channelId)] = rs.lastReadMessageId;
    }

    return {
        categories: categories.map(c => ({
            id: String(c.id),
            name: c.name,
            position: c.position,
            channels: c.channels.map(ch => ({
                id: String(ch.id),
                name: ch.name,
                topic: ch.topic,
                position: ch.position,
                type: ch.type,
                lastMessageId: ch.lastMessageId ? String(ch.lastMessageId) : null,
                lastReadMessageId: unreadMap[String(ch.id)] ? String(unreadMap[String(ch.id)]) : null,
            })),
        })),
        presence: presence.map(p => ({
            userId: p.userId,
            username: p.user.username,
            status: p.status,
            customEmoji: p.customEmoji,
            customText: p.customText,
        })),
    };
}