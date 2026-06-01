// backend/src/modules/chat/chat.routes.js
'use strict';

/**
 * Chat Module (Discord-like)
 * Automatically prefixed with /chat by your backend.
 */

const controller = require('./chat.controller');
const dmController = require('./chat.dm.controller');
const { chatReadOnlyGuard } = require('./chat.readOnly');

async function chatRoutes(fastify, options) {
    const { authenticate } = options.authMiddleware;

    // Auth globale
    fastify.addHook('preHandler', authenticate);

    // Sunset V1 : bloque les mutations si CHAT_V1_READONLY=true
    fastify.addHook('preHandler', chatReadOnlyGuard);

    /**
     * Mappe automatiquement channelId
     */
    function mapChannelParam(req, reply, done) {
        try {
            const id =
                req.params?.channelId ??
                req.params?.id ??
                req.params?.conversation ??
                req.params?.conversationId;

            if (id !== undefined) {
                req.params.channelId = id;
            }
            done();
        } catch (e) {
            done(e);
        }
    }

    // =============================================================
    //  1) CATEGORIES  (/chat/categories)
    // =============================================================

    fastify.get('/categories', controller.listCategories);
    fastify.post('/categories', controller.createCategory);
    fastify.patch('/categories/:categoryId', controller.updateCategory);
    fastify.delete('/categories/:categoryId', controller.deleteCategory);

    // Category overrides (Discord parent cascade)
    fastify.get('/categories/:categoryId/overrides/rank', controller.getCategoryRankOverrides);
    fastify.post('/categories/:categoryId/overrides/rank/:rankId', controller.setCategoryRankOverride);
    fastify.delete('/categories/:categoryId/overrides/rank/:rankId', controller.removeCategoryRankOverride);

    fastify.get('/categories/:categoryId/overrides/user', controller.getCategoryUserOverrides);
    fastify.post('/categories/:categoryId/overrides/user/:userId', controller.setCategoryUserOverride);
    fastify.delete('/categories/:categoryId/overrides/user/:userId', controller.removeCategoryUserOverride);

    // =============================================================
    //  2) CHANNELS (SALONS)  (/chat/channels)
    // =============================================================

    fastify.get('/channels', controller.listChannels);
    fastify.get('/channels/hash', controller.getChannelHash);
    fastify.get('/unread-count', controller.getUnreadCount);
    fastify.get('/total-unread-counts', controller.getTotalUnreadCounts);
    fastify.post('/channels', controller.createChannel);

    fastify.get(
        '/channels/:channelId',
        { preHandler: [mapChannelParam] },
        controller.getChannel
    );
    fastify.patch(
        '/channels/:channelId',
        { preHandler: [mapChannelParam] },
        controller.updateChannel
    );
    fastify.delete(
        '/channels/:channelId',
        { preHandler: [mapChannelParam] },
        controller.deleteChannel
    );
    fastify.get(
        '/channels/:channelId/members',
        { preHandler: [mapChannelParam] },
        controller.getChannelMembers
    );

    // =============================================================
    //  3) MESSAGES  (/chat/channels/:id/messages)
    // =============================================================

    fastify.get(
        '/channels/:channelId/messages',
        { preHandler: [mapChannelParam] },
        controller.getMessages
    );
    fastify.post(
        '/channels/:channelId/messages',
        { preHandler: [mapChannelParam] },
        controller.postMessage
    );

    fastify.get(
        '/channels/:channelId/messages/:messageId/history',
        { preHandler: [mapChannelParam] },
        controller.getMessageHistory
    );

    fastify.patch(
        '/channels/:channelId/messages/:messageId',
        { preHandler: [mapChannelParam] },
        controller.editMessage
    );
    fastify.delete(
        '/channels/:channelId/messages/:messageId',
        { preHandler: [mapChannelParam] },
        controller.deleteMessage
    );

    // =============================================================
    //  4) PERMISSIONS (Discord-like Overrides)
    // =============================================================

    fastify.get('/permissions/catalog', controller.getPermissionCatalog);

    // Rank overrides
    fastify.get(
        '/channels/:channelId/overrides/rank',
        { preHandler: [mapChannelParam] },
        controller.getRankOverrides
    );
    fastify.post(
        '/channels/:channelId/overrides/rank/:rankId',
        { preHandler: [mapChannelParam] },
        controller.setRankOverride
    );
    fastify.delete(
        '/channels/:channelId/overrides/rank/:rankId',
        { preHandler: [mapChannelParam] },
        controller.removeRankOverride
    );

    // User overrides
    fastify.get(
        '/channels/:channelId/overrides/user',
        { preHandler: [mapChannelParam] },
        controller.getUserOverrides
    );
    fastify.post(
        '/channels/:channelId/overrides/user/:userId',
        { preHandler: [mapChannelParam] },
        controller.setUserOverride
    );
    fastify.delete(
        '/channels/:channelId/overrides/user/:userId',
        { preHandler: [mapChannelParam] },
        controller.removeUserOverride
    );

    // Permissions effectives
    fastify.get(
        '/channels/:channelId/permissions',
        { preHandler: [mapChannelParam] },
        controller.getMyPermissionsInChannel
    );

    // Sync channel back to its parent category (drop channel-level overrides)
    fastify.post(
        '/channels/:channelId/sync',
        { preHandler: [mapChannelParam] },
        controller.syncChannelToCategory
    );

    // =============================================================
    //  5) READ STATE (Discord-like)
    // =============================================================

    fastify.get(
        '/channels/:channelId/read-state',
        { preHandler: [mapChannelParam] },
        controller.getReadState
    );
    fastify.post(
        '/channels/:channelId/read-state',
        { preHandler: [mapChannelParam] },
        controller.updateReadState
    );

    fastify.post(
        '/companies/:companyId/mark-all-read',
        controller.markAllCompanyChannelsRead
    );

    fastify.post(
        '/channels/:channelId/ack',
        { preHandler: [mapChannelParam] },
        controller.ackChannel
    );

    // =============================================================
    //  6) PRESENCE
    // =============================================================

    fastify.get('/presence', controller.getPresence);
    fastify.put('/presence', {
        schema: {
            body: {
                type: 'object',
                required: ['status'],
                properties: {
                    status: { type: 'string', enum: ['ONLINE', 'IDLE', 'DND', 'INVISIBLE'] },
                    customEmoji: { type: 'string', nullable: true, maxLength: 64 },
                    customText: { type: 'string', nullable: true, maxLength: 128 },
                },
            },
        },
    }, controller.updatePresence);
    fastify.post('/presence/heartbeat', controller.heartbeatPresence);

    // =============================================================
    //  7) REACTIONS
    // =============================================================

    fastify.post(
        '/channels/:channelId/messages/:messageId/reactions',
        {
            preHandler: [mapChannelParam],
            schema: {
                body: {
                    type: 'object',
                    required: ['emoji'],
                    properties: { emoji: { type: 'string', maxLength: 64 } },
                },
            },
        },
        controller.addReaction
    );

    fastify.delete(
        '/channels/:channelId/messages/:messageId/reactions/:emoji',
        { preHandler: [mapChannelParam] },
        controller.removeReaction
    );

    // =============================================================
    //  8) PINS
    // =============================================================

    fastify.get(
        '/channels/:channelId/pins',
        { preHandler: [mapChannelParam] },
        controller.getPins
    );
    fastify.post(
        '/channels/:channelId/messages/:messageId/pin',
        { preHandler: [mapChannelParam] },
        controller.pinMessage
    );
    fastify.delete(
        '/channels/:channelId/messages/:messageId/pin',
        { preHandler: [mapChannelParam] },
        controller.unpinMessage
    );

    // =============================================================
    //  9) OPTIMIZED ENDPOINTS
    // =============================================================

    fastify.get('/bootstrap', controller.bootstrapChat);
    fastify.get(
        '/channels/:channelId/context',
        { preHandler: [mapChannelParam] },
        controller.getChannelContext
    );

    // =============================================================
    //  10) DIRECT MESSAGES
    // =============================================================

    fastify.get('/dm', dmController.listConversations);
    fastify.get('/dm/:targetUserId', dmController.getOrCreateConversation);
    fastify.get('/dm/conversations/:conversationId/messages', dmController.getMessages);
    fastify.post('/dm/conversations/:conversationId/messages', dmController.postMessage);
}

module.exports = {
    name: 'chat',
    routes: chatRoutes,
    chatCommands: [],
};
