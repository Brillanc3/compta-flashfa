'use strict';

// Singleton namespace /v2 — set via init() lors du démarrage Socket.io
let _v2 = null;

function init(namespace) {
    _v2 = namespace;
}

// ── Messages ──────────────────────────────────────────────────────────────────

function messageCreate(channelId, guildId, payload) {
    if (!_v2) return;
    _v2.to(`channel:${channelId}`).emit('MESSAGE_CREATE', {
        channelId: String(channelId),
        message:   payload,
    });

    let mentionedUserIds   = [];
    let mentionedRoleIds   = [];
    let hasMentionEveryone = false;
    try {
        const raw = payload.mentionsJson;
        if (raw) {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            mentionedUserIds   = (parsed.users    ?? []).map(String);
            mentionedRoleIds   = (parsed.roles    ?? []).map(String);
            hasMentionEveryone = !!(parsed.everyone || parsed.here);
        }
    } catch {}

    _v2.to(`guild:${guildId}`).emit('GUILD_MESSAGE_NOTIFY', {
        channelId:          String(channelId),
        guildId:            String(guildId),
        messageId:          String(payload.id),
        authorId:           payload.authorId != null ? String(payload.authorId) : undefined,
        mentionedUserIds,
        mentionedRoleIds,
        hasMentionEveryone,
    });
}

function messageUpdate(channelId, payload) {
    if (!_v2) return;
    _v2.to(`channel:${channelId}`).emit('MESSAGE_UPDATE', {
        channelId: String(channelId),
        message:   payload,
    });
}

function messageDelete(channelId, messageId) {
    if (!_v2) return;
    _v2.to(`channel:${channelId}`).emit('MESSAGE_DELETE', {
        messageId: String(messageId),
        channelId: String(channelId),
    });
}

function messageDeleteBulk(channelId, ids) {
    if (!_v2) return;
    _v2.to(`channel:${channelId}`).emit('MESSAGE_DELETE_BULK', {
        ids:       ids.map(String),
        channelId: String(channelId),
    });
}

// ── Pins ──────────────────────────────────────────────────────────────────────

function channelPinsUpdate(channelId, guildId, lastPinTimestamp) {
    if (!_v2) return;
    _v2.to(`guild:${guildId}`).emit('CHANNEL_PINS_UPDATE', {
        channelId:        String(channelId),
        guildId:          String(guildId),
        lastPinTimestamp: lastPinTimestamp ? lastPinTimestamp.toISOString() : null,
    });
}

// ── Members ───────────────────────────────────────────────────────────────────

function guildMemberAdd(guildId, member) {
    if (!_v2) return;
    _v2.to(`guild:${guildId}`).emit('GUILD_MEMBER_ADD', member);
}

function guildMemberRemove(guildId, userId) {
    if (!_v2) return;
    _v2.to(`guild:${guildId}`).emit('GUILD_MEMBER_REMOVE', {
        guildId: String(guildId),
        userId:  String(userId),
    });
}

// ── Guilds ──────────────────────────────────────────────────────────────────
//
// Émis à la room personnelle d'un utilisateur quand il rejoint une nouvelle
// guilde (invite, auto-création company). Les sockets ouverts de cet utilisateur
// sont aussi joints à la room `guild:${guildId}` pour recevoir les events suivants.
function guildCreate(userId, guild) {
    if (!_v2) return;
    const guildId = String(guild.id);
    _v2.in(`user:${String(userId)}`).socketsJoin(`guild:${guildId}`);
    _v2.to(`user:${String(userId)}`).emit('GUILD_CREATE', guild);
}

// ── Threads ───────────────────────────────────────────────────────────────────

function threadCreate(guildId, thread) {
    if (!_v2) return;
    _v2.to(`guild:${guildId}`).emit('THREAD_CREATE', thread);
}

function threadUpdate(guildId, thread) {
    if (!_v2) return;
    _v2.to(`guild:${guildId}`).emit('THREAD_UPDATE', thread);
}

function threadDelete(guildId, parentId, threadId) {
    if (!_v2) return;
    _v2.to(`guild:${guildId}`).emit('THREAD_DELETE', {
        id: String(threadId),
        guildId: String(guildId),
        parentId: parentId ? String(parentId) : null,
    });
}

// ── Channels ──────────────────────────────────────────────────────────────────

function channelUpdate(guildId, channel) {
    if (!_v2) return;
    _v2.to(`guild:${guildId}`).emit('CHANNEL_UPDATE', channel);
}

// ── Reactions ─────────────────────────────────────────────────────────────────

function messageReactionAdd(channelId, payload) {
    if (!_v2) return;
    _v2.to(`channel:${channelId}`).emit('MESSAGE_REACTION_ADD', payload);
}

function messageReactionRemove(channelId, payload) {
    if (!_v2) return;
    _v2.to(`channel:${channelId}`).emit('MESSAGE_REACTION_REMOVE', payload);
}

function messageReactionRemoveAll(channelId, messageId) {
    if (!_v2) return;
    _v2.to(`channel:${channelId}`).emit('MESSAGE_REACTION_REMOVE_ALL', {
        messageId: String(messageId),
        channelId: String(channelId),
    });
}

function messageReactionRemoveEmoji(channelId, messageId, emoji) {
    if (!_v2) return;
    _v2.to(`channel:${channelId}`).emit('MESSAGE_REACTION_REMOVE_EMOJI', {
        messageId: String(messageId),
        channelId: String(channelId),
        emoji,
    });
}

// ── Polls ─────────────────────────────────────────────────────────────────────

function pollVoteAdd(channelId, payload) {
    if (!_v2) return;
    _v2.to(`channel:${channelId}`).emit('POLL_VOTE_ADD', payload);
}

// ── Read States ───────────────────────────────────────────────────────────────

// Security: READ_STATE_UPDATE is broadcast to `channel:${channelId}` room.
// Room membership is enforced at socket join time (socket.handler.js) — only
// authenticated channel members can join the room. This function has no
// additional access check by design (emitter layer = fire-and-forget).
function readStateUpdate(channelId, payload) {
    if (!_v2) return;
    _v2.to(`channel:${channelId}`).emit('READ_STATE_UPDATE', payload);
}

// ── Forum Subscriptions ───────────────────────────────────────────────────────

function forumPostNotify(guildId, forumChannelId, subscriberUserIds, thread) {
    if (!_v2) return;
    _v2.to(`guild:${guildId}`).emit('FORUM_POST_NOTIFY', {
        forumChannelId,
        subscriberUserIds,
        thread,
    });
}

function threadMessageNotify(guildId, forumChannelId, threadId, subscriberUserIds, messageId) {
    if (!_v2) return;
    _v2.to(`guild:${guildId}`).emit('THREAD_MESSAGE_NOTIFY', {
        guildId:          String(guildId),
        forumChannelId:   String(forumChannelId),
        threadId:         String(threadId),
        subscriberUserIds,
        messageId:        messageId ? String(messageId) : undefined,
    });
}

module.exports = {
    init,
    messageCreate,
    messageUpdate,
    messageDelete,
    messageDeleteBulk,
    channelPinsUpdate,
    channelUpdate,
    guildMemberAdd,
    guildMemberRemove,
    guildCreate,
    threadCreate,
    threadUpdate,
    threadDelete,
    messageReactionAdd,
    messageReactionRemove,
    messageReactionRemoveAll,
    messageReactionRemoveEmoji,
    pollVoteAdd,
    readStateUpdate,
    forumPostNotify,
    threadMessageNotify,
};
