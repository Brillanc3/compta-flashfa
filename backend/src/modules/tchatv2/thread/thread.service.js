'use strict';

const repo = require('./thread.repository');
const { nextV2 } = require('../lib/snowflake');
const { ChannelType, Permission, hasPermission } = require('../tchatv2.constants');
const { getChannelPermissions } = require('../permissions/permission.cache');
const { redis } = require('../../../shards/redisClient');
const emitter = require('../sockets/socket.emitter');

function err(msg, status, code) {
    const e = new Error(msg);
    e.statusCode = status;
    e.code = code;
    return e;
}

function membersKey(threadId) {
    return `v2:thread:${threadId}:members`;
}

async function createFromMessage({ channelId, guildId, messageId, authorId, name, autoArchiveDuration = 1440, perms }) {
    const p = perms ?? await getChannelPermissions(channelId, guildId, authorId);
    if (!hasPermission(p, Permission.CREATE_PUBLIC_THREADS)) throw err('Missing Permissions', 403, 50013);

    const threadId = nextV2();
    const thread = await repo.create(
        {
            id: threadId,
            guildId: BigInt(guildId),
            parentId: BigInt(channelId),
            type: ChannelType.PUBLIC_THREAD,
            name,
            position: 0,
        },
        { createMessageId: BigInt(messageId), autoArchiveDuration }
    );

    await redis.sadd(membersKey(String(threadId)), String(authorId));
    emitter.threadCreate(String(guildId), thread);
    return thread;
}

async function createPrivate({ channelId, guildId, authorId, name, autoArchiveDuration = 1440, perms }) {
    const p = perms ?? await getChannelPermissions(channelId, guildId, authorId);
    if (!hasPermission(p, Permission.CREATE_PRIVATE_THREADS)) throw err('Missing Permissions', 403, 50013);

    const threadId = nextV2();
    const thread = await repo.create(
        {
            id: threadId,
            guildId: BigInt(guildId),
            parentId: BigInt(channelId),
            type: ChannelType.PRIVATE_THREAD,
            name,
            position: 0,
        },
        { autoArchiveDuration }
    );

    await redis.sadd(membersKey(String(threadId)), String(authorId));
    emitter.threadCreate(String(guildId), thread);
    return thread;
}

async function joinThread(threadId, userId) {
    const thread = await repo.findById(threadId);
    if (!thread) throw err('Unknown Channel', 404, 10003);
    if (thread.threadMetadata?.archived) throw err('Thread is archived', 423, 50083);

    await redis.sadd(membersKey(String(threadId)), String(userId));
    return { threadId: String(threadId), userId: String(userId) };
}

async function leaveThread(threadId, userId) {
    await redis.srem(membersKey(String(threadId)), String(userId));
    return {};
}

async function archiveThread(threadId, guildId) {
    const thread = await repo.updateMetadata(threadId, {
        archived: true,
        archiveTimestamp: new Date(),
    });
    emitter.threadUpdate(String(guildId), thread);
    return thread;
}

async function unarchiveThread(threadId, guildId) {
    const thread = await repo.updateMetadata(threadId, {
        archived: false,
        archiveTimestamp: null,
    });
    emitter.threadUpdate(String(guildId), thread);
    return thread;
}

async function deleteThread(threadId, guildId, perms) {
    const thread = await repo.findById(threadId);
    if (!thread) throw err('Unknown Channel', 404, 10003);

    if (perms != null && !hasPermission(perms, Permission.MANAGE_THREADS)) {
        throw err('Missing Permissions', 403, 50013);
    }

    await repo.remove(threadId);
    emitter.threadDelete(String(guildId), thread.parentId ? String(thread.parentId) : null, String(threadId));
}

async function updateThread(threadId, guildId, { locked, pinned, name } = {}, perms) {
    const thread = await repo.findById(threadId);
    if (!thread) throw err('Unknown Channel', 404, 10003);

    if (!hasPermission(perms, Permission.MANAGE_THREADS)) throw err('Missing Permissions', 403, 50013);

    const metaUpdate = {};
    if (locked !== undefined) metaUpdate.locked = Boolean(locked);
    if (pinned !== undefined) metaUpdate.pinned = Boolean(pinned);

    if (Object.keys(metaUpdate).length > 0) {
        await repo.updateMetadata(threadId, metaUpdate);
    }

    if (name !== undefined) {
        await require('../../../shards/database').prisma.v2Channel.update({
            where: { id: BigInt(threadId) },
            data: { name: String(name).slice(0, 100) },
        });
    }

    const updated = await repo.findById(threadId);
    emitter.threadUpdate(String(guildId), updated);
    return updated;
}

async function reorderForumPosts(forumId, guildId, items, perms) {
    if (!hasPermission(perms, Permission.MANAGE_THREADS)) throw err('Missing Permissions', 403, 50013);

    const valid = items.filter(it => it?.id && it.position != null);
    if (!valid.length) return;

    await repo.reorderPosts(valid);
}

module.exports = { createFromMessage, createPrivate, joinThread, leaveThread, archiveThread, unarchiveThread, deleteThread, updateThread, reorderForumPosts };
