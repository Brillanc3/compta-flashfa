// backend/src/modules/chat/chat.events.js

const eventBus = require('../../lib/eventBusRedis');
const prisma = require('../../db');
const { emitGatewayEvent } = require('../../core/gateway/gateway.emitter');

// ===============================
// LISTE des événements disponibles
// ===============================
const EVENTS = {
    MESSAGE_CREATED: 'chat:messageCreated',
    MESSAGE_UPDATED: 'chat:messageUpdated',
    MESSAGE_DELETED: 'chat:messageDeleted',

    PERMISSIONS_UPDATED: 'chat:permissionsUpdated',
    CATEGORY_PERMISSIONS_UPDATED: 'chat:categoryPermissionsUpdated',

    CHANNEL_CREATED: 'chat:channelCreated',
    CHANNEL_UPDATED: 'chat:channelUpdated',
    CHANNEL_DELETED: 'chat:channelDeleted',

    CHANNEL_SHOWN: 'chat:channelShown',
    CHANNEL_HIDDEN: 'chat:channelHidden',

    CATEGORY_CREATED: 'chat:categoryCreated',
    CATEGORY_UPDATED: 'chat:categoryUpdated',
    CATEGORY_DELETED: 'chat:categoryDeleted',

    DM_MESSAGE_CREATED: 'chat:dmMessageCreated',

    PRESENCE_UPDATED:   'chat:presenceUpdated',
    TYPING_START:       'chat:typingStart',
    TYPING_STOP:        'chat:typingStop',
    REACTION_ADDED:     'chat:reactionAdded',
    REACTION_REMOVED:   'chat:reactionRemoved',
    MESSAGE_PINNED:     'chat:messagePinned',
    MESSAGE_UNPINNED:   'chat:messageUnpinned',
};

// ===============================
// Normalisation BigInt → string
// ===============================
function normalize(obj) {
    if (obj == null) return obj;

    if (typeof obj === 'bigint') return obj.toString();

    if (Array.isArray(obj)) return obj.map(normalize);

    if (typeof obj === 'object') {
        const out = {};
        for (const key of Object.keys(obj)) {
            out[key] = normalize(obj[key]);
        }
        return out;
    }

    return obj;
}

/**
 * Récupère les informations d'auteur pour enrichir l'événement SSE
 */
async function enrichMessage(message) {
    // Si déjà enrichi (service renvoie authorName/authorAvatar), on ne requête pas.
    if (message && (message.authorName || message.authorAvatar)) {
        return message;
    }

    const author = await prisma.user.findUnique({
        where: { id: message.authorId },
        select: { name: true, imageUrl: true },
    });

    return {
        ...message,
        authorName: author?.name ?? 'Utilisateur',
        authorAvatar: author?.imageUrl ?? null,
    };
}

// --------- Messages ---------
async function emitMessageCreated(channelId, message) {
    const fullMessage = await enrichMessage(message);

    eventBus.emit(
        EVENTS.MESSAGE_CREATED,
        normalize({
            channelId: String(channelId),
            message: fullMessage,
        })
    );
}

async function emitMessageUpdated(channelId, message) {
    const fullMessage = await enrichMessage(message);

    eventBus.emit(
        EVENTS.MESSAGE_UPDATED,
        normalize({
            channelId: String(channelId),
            message: fullMessage,
        })
    );
}

async function emitMessageDeleted(channelId, messageId) {
    eventBus.emit(
        EVENTS.MESSAGE_DELETED,
        normalize({
            channelId: String(channelId),
            messageId: String(messageId),
        })
    );
}

// -------- Permissions --------
function emitPermissionsUpdated(channelId, updated) {
    eventBus.emit(
        EVENTS.PERMISSIONS_UPDATED,
        normalize({
            channelId: String(channelId),
            updated,
        })
    );
}

function emitCategoryPermissionsUpdated(categoryId, updated) {
    eventBus.emit(
        EVENTS.CATEGORY_PERMISSIONS_UPDATED,
        normalize({
            categoryId: String(categoryId),
            updated,
        })
    );
}

// -------- Channels --------
function emitChannelCreated(channel) {
    eventBus.emit(EVENTS.CHANNEL_CREATED, normalize({ channel }));
}

function emitChannelUpdated(channelId, updates) {
    eventBus.emit(
        EVENTS.CHANNEL_UPDATED,
        normalize({
            channelId: String(channelId),
            updates,
        })
    );
}

function emitChannelDeleted(channelId) {
    eventBus.emit(
        EVENTS.CHANNEL_DELETED,
        normalize({
            channelId: String(channelId),
        })
    );
}

// Visibility events
function emitChannelShown(userId, channel) {
    eventBus.emit(
        EVENTS.CHANNEL_SHOWN,
        normalize({
            userId,
            channel,
        })
    );
}

function emitChannelHidden(userId, channelId) {
    eventBus.emit(
        EVENTS.CHANNEL_HIDDEN,
        normalize({
            userId,
            channelId: String(channelId),
        })
    );
}

// -------- Categories --------
function emitCategoryCreated(category) {
    eventBus.emit(EVENTS.CATEGORY_CREATED, normalize({ category }));
}

function emitCategoryUpdated(categoryId, updates) {
    eventBus.emit(
        EVENTS.CATEGORY_UPDATED,
        normalize({ categoryId: String(categoryId), updates })
    );
}

function emitCategoryDeleted(categoryId) {
    eventBus.emit(
        EVENTS.CATEGORY_DELETED,
        normalize({ categoryId: String(categoryId) })
    );
}

// -------- DM Messages --------
function emitDmMessage(conversationId, message, userAId, userBId) {
    eventBus.emit(
        EVENTS.DM_MESSAGE_CREATED,
        normalize({
            conversationId: String(conversationId),
            message,
            userAId,
            userBId,
        })
    );
}

// -------- Presence --------
function emitPresenceUpdated(companyId, presenceData) {
    emitGatewayEvent({
        scope: 'ROOM',
        targets: [`company:${companyId}`],
        event: 'CHAT_PRESENCE_UPDATED',
        payload: normalize({ companyId: String(companyId), ...presenceData }),
    });
}

// -------- Typing --------
function emitTypingStart(channelId, { userId, userName }) {
    emitGatewayEvent({
        scope: 'ROOM',
        targets: [`channel:${channelId}`],
        event: 'CHAT_TYPING_START',
        payload: normalize({ channelId: String(channelId), userId, userName }),
    });
}

function emitTypingStop(channelId, userId) {
    emitGatewayEvent({
        scope: 'ROOM',
        targets: [`channel:${channelId}`],
        event: 'CHAT_TYPING_STOP',
        payload: normalize({ channelId: String(channelId), userId }),
    });
}

// -------- Reactions --------
function emitReactionAdded(channelId, messageId, reaction) {
    emitGatewayEvent({
        scope: 'ROOM',
        targets: [`channel:${channelId}`],
        event: 'CHAT_REACTION_ADDED',
        payload: normalize({ channelId: String(channelId), messageId: String(messageId), ...reaction }),
    });
}

function emitReactionRemoved(channelId, messageId, { userId, emoji }) {
    emitGatewayEvent({
        scope: 'ROOM',
        targets: [`channel:${channelId}`],
        event: 'CHAT_REACTION_REMOVED',
        payload: normalize({ channelId: String(channelId), messageId: String(messageId), userId, emoji }),
    });
}

// -------- Pins --------
function emitMessagePinned(channelId, pin) {
    emitGatewayEvent({
        scope: 'ROOM',
        targets: [`channel:${channelId}`],
        event: 'CHAT_MESSAGE_PINNED',
        payload: normalize({ channelId: String(channelId), ...pin }),
    });
}

function emitMessageUnpinned(channelId, messageId) {
    emitGatewayEvent({
        scope: 'ROOM',
        targets: [`channel:${channelId}`],
        event: 'CHAT_MESSAGE_UNPINNED',
        payload: normalize({ channelId: String(channelId), messageId: String(messageId) }),
    });
}

module.exports = {
    EVENTS,
    normalize,

    emitMessageCreated,
    emitMessageUpdated,
    emitMessageDeleted,

    emitPermissionsUpdated,
    emitCategoryPermissionsUpdated,

    emitChannelCreated,
    emitChannelUpdated,
    emitChannelDeleted,

    emitChannelShown,
    emitChannelHidden,

    emitCategoryCreated,
    emitCategoryUpdated,
    emitCategoryDeleted,

    emitDmMessage,

    emitPresenceUpdated,
    emitTypingStart,
    emitTypingStop,
    emitReactionAdded,
    emitReactionRemoved,
    emitMessagePinned,
    emitMessageUnpinned,
};