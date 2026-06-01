'use strict';

const { prisma } = require('../../../shards/database');
const threadRepo = require('./thread.repository');
const { nextV2 } = require('../lib/snowflake');
const { ChannelType, MessageType, Permission, hasPermission } = require('../tchatv2.constants');
const { getChannelPermissions } = require('../permissions/permission.cache');
const emitter = require('../sockets/socket.emitter');

function err(msg, status, code) {
    const e = new Error(msg);
    e.statusCode = status;
    e.code = code;
    return e;
}

async function createForumPost({ forumId, guildId, authorId, name, message, autoArchiveDuration = 1440, tagIds = [], perms }) {
    const p = perms ?? await getChannelPermissions(forumId, guildId, authorId);
    if (!hasPermission(p, Permission.SEND_MESSAGES)) throw err('Missing Permissions', 403, 50013);

    const forum = await prisma.v2Channel.findUnique({
        where: { id: BigInt(forumId) },
        select: { type: true },
    });
    if (!forum || forum.type !== ChannelType.GUILD_FORUM) throw err('Channel is not a forum', 400, 50024);

    const threadId = nextV2();
    const messageId = nextV2();
    const uid = Number(authorId);

    const memberSnap = await prisma.v2Member.findUnique({
        where: { guildId_userId: { guildId: BigInt(guildId), userId: uid } },
        select: { nickname: true, avatarHash: true, user: { select: { username: true } } },
    });

    const thread = await prisma.$transaction(async (tx) => {
        const t = await tx.v2Channel.create({
            data: {
                id: threadId,
                guildId: BigInt(guildId),
                parentId: BigInt(forumId),
                type: ChannelType.PUBLIC_THREAD,
                name,
                position: 0,
            },
        });

        await tx.v2ThreadMetadata.create({
            data: { channelId: t.id, createMessageId: messageId, autoArchiveDuration },
        });

        await tx.v2Message.create({
            data: {
                id: messageId,
                channelId: t.id,
                authorId: uid,
                content: message.content || '',
                type: MessageType.THREAD_STARTER_MESSAGE,
                authorUsername:   memberSnap?.user?.username  ?? String(uid),
                authorAvatarHash: memberSnap?.avatarHash       ?? null,
                authorNickname:   memberSnap?.nickname         ?? null,
            },
        });

        await tx.v2Channel.update({
            where: { id: t.id },
            data: { lastMessageId: messageId },
        });

        if (tagIds && tagIds.length > 0) {
            await tx.v2ThreadTag.createMany({
                data: tagIds.map(tagId => ({ threadId: t.id, tagId: BigInt(tagId) })),
                skipDuplicates: true,
            });
        }

        return tx.v2Channel.findUnique({
            where: { id: t.id },
            select: threadRepo.THREAD_SELECT,
        });
    });

    emitter.threadCreate(String(guildId), thread);

    // Auto-subscribe créateur au post
    try {
        await subscribeToPost(String(threadId), authorId);
    } catch { /* non-bloquant */ }

    try {
        const subscriberIds = await getForumSubscriberUserIds(forumId);
        if (subscriberIds.length > 0) {
            emitter.forumPostNotify(String(guildId), String(forumId), subscriberIds, thread);
        }
    } catch { /* intentional — notification must not block post creation */ }

    return { thread, messageId: String(messageId) };
}

async function listActiveForumPosts(forumId, { sort } = {}) {
    const posts = await threadRepo.findActiveByChannel(forumId);

    if (sort === 'unanswered') {
        const unanswered = posts.filter(p => {
            const msgCount = p._count?.messages ?? 0;
            return msgCount <= 1;
        });
        return unanswered.sort((a, b) => {
            const aPin = a.threadMetadata?.pinned ? 1 : 0;
            const bPin = b.threadMetadata?.pinned ? 1 : 0;
            if (bPin !== aPin) return bPin - aPin;
            const aTs = BigInt(a.lastMessageId ?? 0);
            const bTs = BigInt(b.lastMessageId ?? 0);
            return aTs < bTs ? 1 : aTs > bTs ? -1 : 0;
        });
    }

    if (sort === 'popular') {
        return posts.sort((a, b) => {
            const aPin = a.threadMetadata?.pinned ? 1 : 0;
            const bPin = b.threadMetadata?.pinned ? 1 : 0;
            if (bPin !== aPin) return bPin - aPin;
            const aScore = (a._count?.messages ?? 0) + (a._count?.reactions ?? 0);
            const bScore = (b._count?.messages ?? 0) + (b._count?.reactions ?? 0);
            return bScore - aScore;
        });
    }

    // default: 'latest' — sort by lastMessageId DESC (pinned first)
    return posts.sort((a, b) => {
        const aPin = a.threadMetadata?.pinned ? 1 : 0;
        const bPin = b.threadMetadata?.pinned ? 1 : 0;
        if (bPin !== aPin) return bPin - aPin;
        if (aPin) return (a.position ?? 0) - (b.position ?? 0);
        const aTs = BigInt(a.lastMessageId ?? 0);
        const bTs = BigInt(b.lastMessageId ?? 0);
        return aTs < bTs ? 1 : aTs > bTs ? -1 : 0;
    });
}

async function listArchivedForumPosts(forumId, { before, limit } = {}) {
    return threadRepo.findArchivedByChannel(forumId, { before, limit });
}

// ── Tags ─────────────────────────────────────────────────────────────────────

async function createTag(channelId, { name, emoji, moderated }) {
    return prisma.v2ForumTag.create({
        data: {
            id: nextV2(),
            channelId: BigInt(channelId),
            name,
            emoji: emoji ?? null,
            moderated: moderated ?? false,
        },
    });
}

async function listTags(channelId) {
    return prisma.v2ForumTag.findMany({
        where: { channelId: BigInt(channelId) },
        orderBy: { createdAt: 'asc' },
    });
}

async function deleteTag(tagId, channelId) {
    const tag = await prisma.v2ForumTag.findFirst({
        where: { id: BigInt(tagId), channelId: BigInt(channelId) },
    });
    if (!tag) throw err('Tag not found', 404, 10012);
    await prisma.v2ForumTag.delete({ where: { id: BigInt(tagId) } });
}

async function setThreadTags(threadId, tagIds) {
    const tid = BigInt(threadId);
    await prisma.$transaction(async (tx) => {
        await tx.v2ThreadTag.deleteMany({ where: { threadId: tid } });
        if (tagIds && tagIds.length > 0) {
            await tx.v2ThreadTag.createMany({
                data: tagIds.map(tagId => ({ threadId: tid, tagId: BigInt(tagId) })),
                skipDuplicates: true,
            });
        }
    });
    return prisma.v2ThreadTag.findMany({
        where: { threadId: tid },
        include: { tag: true },
    });
}

// ── Subscriptions ─────────────────────────────────────────────────────────────

async function subscribeToForum(channelId, userId) {
    await prisma.v2ForumSubscription.upsert({
        where: { userId_channelId: { userId: Number(userId), channelId: BigInt(channelId) } },
        create: { userId: Number(userId), channelId: BigInt(channelId) },
        update: {},
    });
}

async function unsubscribeFromForum(channelId, userId) {
    await prisma.v2ForumSubscription.deleteMany({
        where: { userId: Number(userId), channelId: BigInt(channelId) },
    });
}

async function getSubscription(channelId, userId) {
    return prisma.v2ForumSubscription.findUnique({
        where: { userId_channelId: { userId: Number(userId), channelId: BigInt(channelId) } },
    });
}

async function getForumSubscriberUserIds(channelId) {
    const subs = await prisma.v2ForumSubscription.findMany({
        where: { channelId: BigInt(channelId) },
        select: { userId: true },
    });
    return subs.map(s => String(s.userId));
}

// ── Post Subscriptions (thread-level) ─────────────────────────────────────────

async function subscribeToPost(threadId, userId) {
    await prisma.v2ForumPostSubscription.upsert({
        where: { userId_threadId: { userId: Number(userId), threadId: BigInt(threadId) } },
        create: { userId: Number(userId), threadId: BigInt(threadId) },
        update: {},
    });
}

async function unsubscribeFromPost(threadId, userId) {
    await prisma.v2ForumPostSubscription.deleteMany({
        where: { userId: Number(userId), threadId: BigInt(threadId) },
    });
}

async function getPostSubscription(threadId, userId) {
    return prisma.v2ForumPostSubscription.findUnique({
        where: { userId_threadId: { userId: Number(userId), threadId: BigInt(threadId) } },
    });
}

async function getPostSubscriberUserIds(threadId) {
    const subs = await prisma.v2ForumPostSubscription.findMany({
        where: { threadId: BigInt(threadId) },
        select: { userId: true },
    });
    return subs.map(s => String(s.userId));
}

async function getPostSubscribers(threadId) {
    const subs = await prisma.v2ForumPostSubscription.findMany({
        where: { threadId: BigInt(threadId) },
        include: {
            user: { select: { id: true, username: true, name: true, imageUrl: true } },
        },
        orderBy: { createdAt: 'asc' },
    });
    return subs.map(s => ({
        userId:   String(s.userId),
        username: s.user?.username ?? String(s.userId),
        name:     s.user?.name ?? null,
        imageUrl: s.user?.imageUrl ?? null,
    }));
}

async function getSubscribedPosts(guildId, userId) {
    const subs = await prisma.v2ForumPostSubscription.findMany({
        where: {
            userId: Number(userId),
            thread: { guildId: BigInt(guildId) },
        },
        include: {
            thread: {
                select: {
                    id: true, name: true, parentId: true,
                    lastMessageId: true, type: true,
                    threadMetadata: { select: { archived: true, locked: true } },
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    });
    return subs.map(s => ({
        ...s.thread,
        id:            String(s.thread.id),
        parentId:      s.thread.parentId ? String(s.thread.parentId) : null,
        lastMessageId: s.thread.lastMessageId ? String(s.thread.lastMessageId) : null,
    }));
}

module.exports = {
    createForumPost,
    listActiveForumPosts,
    listArchivedForumPosts,
    createTag,
    listTags,
    deleteTag,
    setThreadTags,
    subscribeToForum,
    unsubscribeFromForum,
    getSubscription,
    getForumSubscriberUserIds,
    subscribeToPost,
    unsubscribeFromPost,
    getPostSubscription,
    getPostSubscriberUserIds,
    getPostSubscribers,
    getSubscribedPosts,
};
