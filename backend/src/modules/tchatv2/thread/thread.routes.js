'use strict';

const ctrl = require('./thread.controller');
const { requirePermission } = require('../permissions/permission.preHandler');

const threadBodySchema = {
    type: 'object',
    required: ['name'],
    properties: {
        name: { type: 'string', minLength: 1, maxLength: 100 },
        autoArchiveDuration: { type: 'integer', enum: [60, 1440, 4320, 10080] },
    },
};

const archivedQuerySchema = {
    type: 'object',
    properties: {
        before: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
    },
};

const forumActiveQuerySchema = {
    type: 'object',
    properties: {
        sort: { type: 'string', enum: ['latest', 'popular', 'unanswered'], default: 'latest' },
    },
};

async function routes(fastify, opts) {
    const { authenticate } = opts.authMiddleware;
    fastify.addHook('preHandler', authenticate);

    // TASK 6.1 — Thread depuis un message
    fastify.post('/guilds/:guildId/channels/:channelId/messages/:messageId/threads', {
        schema: { body: threadBodySchema },
        preHandler: [requirePermission('CREATE_PUBLIC_THREADS')],
    }, ctrl.createFromMessage);

    // Thread privé sans message parent
    fastify.post('/guilds/:guildId/channels/:channelId/threads', {
        schema: { body: threadBodySchema },
        preHandler: [requirePermission('CREATE_PRIVATE_THREADS')],
    }, ctrl.createPrivate);

    // Listing threads actifs/archivés
    fastify.get('/guilds/:guildId/channels/:channelId/threads/active', {
        preHandler: [requirePermission('VIEW_CHANNEL')],
    }, ctrl.listActive);

    fastify.get('/guilds/:guildId/channels/:channelId/threads/archived', {
        schema: { querystring: archivedQuerySchema },
        preHandler: [requirePermission('VIEW_CHANNEL')],
    }, ctrl.listArchived);

    // Join / leave thread (@me = user connecté)
    fastify.put('/guilds/:guildId/channels/:channelId/thread-members/@me', {
        preHandler: [requirePermission('VIEW_CHANNEL')],
    }, ctrl.joinThread);

    fastify.delete('/guilds/:guildId/channels/:channelId/thread-members/@me', {
        preHandler: [requirePermission('VIEW_CHANNEL')],
    }, ctrl.leaveThread);

    // Suppression thread
    fastify.delete('/guilds/:guildId/channels/:channelId/thread', {
        preHandler: [requirePermission('MANAGE_THREADS')],
    }, ctrl.destroyThread);

    // Mise à jour thread (lock / pin / rename)
    fastify.patch('/guilds/:guildId/channels/:channelId/thread', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    locked: { type: 'boolean' },
                    pinned: { type: 'boolean' },
                    name:   { type: 'string', minLength: 1, maxLength: 100 },
                },
                additionalProperties: false,
            },
        },
        preHandler: [requirePermission('MANAGE_THREADS')],
    }, ctrl.updateThread);

    // TASK 6.2 — Forum
    fastify.post('/guilds/:guildId/channels/:channelId/forum-threads', {
        schema: {
            body: {
                type: 'object',
                required: ['name', 'message'],
                properties: {
                    name: { type: 'string', minLength: 1, maxLength: 100 },
                    message: {
                        type: 'object',
                        required: ['content'],
                        properties: {
                            content: { type: 'string', maxLength: 2000 },
                            attachmentIds: { type: 'array', items: { type: 'string' }, maxItems: 10 },
                        },
                    },
                    autoArchiveDuration: { type: 'integer', enum: [60, 1440, 4320, 10080] },
                    appliedTags: { type: 'array', items: { type: 'string' }, maxItems: 5 },
                },
            },
        },
        preHandler: [requirePermission('SEND_MESSAGES')],
    }, ctrl.createForumPost);

    fastify.get('/guilds/:guildId/channels/:channelId/forum-threads/active', {
        schema: { querystring: forumActiveQuerySchema },
        preHandler: [requirePermission('VIEW_CHANNEL')],
    }, ctrl.listForumActive);

    // Reorder forum posts (positions)
    fastify.patch('/guilds/:guildId/channels/:channelId/forum-threads/reorder', {
        schema: {
            body: {
                type: 'array',
                items: {
                    type: 'object',
                    required: ['id', 'position'],
                    properties: {
                        id:       { type: 'string' },
                        position: { type: 'integer', minimum: 0 },
                    },
                },
            },
        },
        preHandler: [requirePermission('MANAGE_THREADS')],
    }, ctrl.reorderForumPosts);

    fastify.get('/guilds/:guildId/channels/:channelId/forum-threads/archived', {
        schema: { querystring: archivedQuerySchema },
        preHandler: [requirePermission('VIEW_CHANNEL')],
    }, ctrl.listForumArchived);

    // P2.7 — Forum Tags
    fastify.get('/guilds/:guildId/channels/:channelId/forum-tags', {
        preHandler: [requirePermission('VIEW_CHANNEL')],
    }, ctrl.listTags);

    fastify.post('/guilds/:guildId/channels/:channelId/forum-tags', {
        schema: {
            body: {
                type: 'object',
                required: ['name'],
                properties: {
                    name:      { type: 'string', minLength: 1, maxLength: 64 },
                    emoji:     { type: 'string', maxLength: 64 },
                    moderated: { type: 'boolean' },
                },
                additionalProperties: false,
            },
        },
        preHandler: [requirePermission('MANAGE_THREADS')],
    }, ctrl.createTag);

    fastify.delete('/guilds/:guildId/channels/:channelId/forum-tags/:tagId', {
        preHandler: [requirePermission('MANAGE_THREADS')],
    }, ctrl.deleteTag);

    // Forum Subscriptions
    fastify.put('/guilds/:guildId/channels/:channelId/forum-subscribe', {
        preHandler: [requirePermission('VIEW_CHANNEL')],
    }, ctrl.subscribeToForum);

    fastify.delete('/guilds/:guildId/channels/:channelId/forum-subscribe', {
        preHandler: [requirePermission('VIEW_CHANNEL')],
    }, ctrl.unsubscribeFromForum);

    fastify.get('/guilds/:guildId/channels/:channelId/forum-subscribe', {
        preHandler: [requirePermission('VIEW_CHANNEL')],
    }, ctrl.getForumSubscription);

    // Forum Post Subscriptions (thread-level)
    fastify.put('/guilds/:guildId/channels/:channelId/post-subscribe', {
        preHandler: [requirePermission('VIEW_CHANNEL')],
    }, ctrl.subscribeToPost);

    fastify.delete('/guilds/:guildId/channels/:channelId/post-subscribe', {
        preHandler: [requirePermission('VIEW_CHANNEL')],
    }, ctrl.unsubscribeFromPost);

    fastify.get('/guilds/:guildId/channels/:channelId/post-subscribe', {
        preHandler: [requirePermission('VIEW_CHANNEL')],
    }, ctrl.getPostSubscription);

    fastify.get('/guilds/:guildId/channels/:channelId/post-subscribers', {
        preHandler: [requirePermission('VIEW_CHANNEL')],
    }, ctrl.listPostSubscribers);

    fastify.get('/guilds/:guildId/subscribed-forum-posts', {
        preHandler: [authenticate],
    }, ctrl.listSubscribedPosts);

    fastify.patch('/guilds/:guildId/threads/:threadId/tags', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    tagIds: { type: 'array', items: { type: 'string' }, maxItems: 5 },
                },
                additionalProperties: false,
            },
        },
        preHandler: [requirePermission('SEND_MESSAGES')],
    }, ctrl.setThreadTags);

    // P2.7 — Polls
    fastify.post('/guilds/:guildId/channels/:channelId/messages/:messageId/poll', {
        schema: {
            body: {
                type: 'object',
                required: ['question', 'options'],
                properties: {
                    question:  { type: 'string', minLength: 1, maxLength: 300 },
                    options:   { type: 'array', items: { type: 'string', minLength: 1, maxLength: 100 }, minItems: 2, maxItems: 10 },
                    multiple:  { type: 'boolean' },
                    expiresAt: { type: 'string', format: 'date-time' },
                },
                additionalProperties: false,
            },
        },
        preHandler: [requirePermission('SEND_MESSAGES')],
    }, ctrl.createPoll);

    fastify.post('/guilds/:guildId/polls/:pollId/vote', {
        schema: {
            body: {
                type: 'object',
                required: ['optionIds'],
                properties: {
                    optionIds: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 10 },
                },
                additionalProperties: false,
            },
        },
        preHandler: [requirePermission('SEND_MESSAGES', 'guild')],
    }, ctrl.votePoll);

    fastify.get('/guilds/:guildId/polls/:pollId', {
        preHandler: [requirePermission('SEND_MESSAGES', 'guild')],
    }, ctrl.getPoll);
}

module.exports = { routes };
