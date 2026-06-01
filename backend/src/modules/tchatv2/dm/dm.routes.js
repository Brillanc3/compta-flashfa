'use strict';

const ctrl = require('./dm.controller');

async function routes(fastify, opts) {
    const { authenticate } = opts.authMiddleware;
    fastify.addHook('preHandler', authenticate);

    // GET /dm — lister ses DMs
    fastify.get('/dm', {}, ctrl.list);

    // POST /dm/group — créer GROUP_DM (avant /:targetUserId pour éviter collision)
    fastify.post('/dm/group', {
        schema: {
            body: {
                type: 'object',
                required: ['memberIds'],
                properties: {
                    memberIds: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 9 },
                    name: { type: 'string', maxLength: 100 },
                },
            },
        },
    }, ctrl.createGroup);

    // POST /dm/:targetUserId — ouvrir/créer DM avec un user
    fastify.post('/dm/:targetUserId', {
        schema: {
            params: {
                type: 'object',
                required: ['targetUserId'],
                properties: { targetUserId: { type: 'string' } },
            },
        },
    }, ctrl.open);

    // DELETE /dm/:channelId — cacher un DM
    fastify.delete('/dm/:channelId', {
        schema: {
            params: {
                type: 'object',
                required: ['channelId'],
                properties: { channelId: { type: 'string' } },
            },
        },
    }, ctrl.close);

    // GET /dm/:channelId/messages — lire messages DM
    fastify.get('/dm/:channelId/messages', {
        schema: {
            params: {
                type: 'object',
                required: ['channelId'],
                properties: { channelId: { type: 'string' } },
            },
            querystring: {
                type: 'object',
                properties: {
                    before: { type: 'string' },
                    limit: { type: 'number' },
                },
            },
        },
    }, ctrl.getMessages);

    // POST /dm/:channelId/messages — envoyer message dans DM
    fastify.post('/dm/:channelId/messages', {
        schema: {
            params: {
                type: 'object',
                required: ['channelId'],
                properties: { channelId: { type: 'string' } },
            },
            body: {
                type: 'object',
                required: ['content'],
                properties: { content: { type: 'string', maxLength: 2000 } },
            },
        },
    }, ctrl.sendMessage);

    // DELETE /dm/:channelId/messages/:messageId — supprimer un message DM
    fastify.delete('/dm/:channelId/messages/:messageId', {
        schema: {
            params: {
                type: 'object',
                required: ['channelId', 'messageId'],
                properties: {
                    channelId: { type: 'string' },
                    messageId: { type: 'string' },
                },
            },
        },
    }, ctrl.deleteMessage);
}

module.exports = { routes };
