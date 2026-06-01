'use strict';

const ctrl = require('./webhook.controller');
const { requirePermission } = require('../permissions/permission.preHandler');

const createBody = {
    type: 'object',
    required: ['name'],
    properties: {
        name: { type: 'string', minLength: 1, maxLength: 80 },
        avatarHash: { type: 'string' },
    },
};

const embedFieldSchema = {
    type: 'object',
    properties: {
        name:   { type: 'string', maxLength: 256 },
        value:  { type: 'string', maxLength: 1024 },
        inline: { type: 'boolean' },
    },
};

const embedSchema = {
    type: 'object',
    properties: {
        title:       { type: 'string', maxLength: 256 },
        type:        { type: 'string' },
        description: { type: 'string', maxLength: 4096 },
        url:         { type: 'string', maxLength: 512 },
        timestamp:   { type: 'string' },
        color:       { type: 'integer', minimum: 0, maximum: 16777215 },
        footer:      { type: 'object', properties: { text: { type: 'string', maxLength: 2048 }, icon_url: { type: 'string', maxLength: 512 } } },
        image:       { type: 'object', properties: { url: { type: 'string', maxLength: 512 } } },
        thumbnail:   { type: 'object', properties: { url: { type: 'string', maxLength: 512 } } },
        author:      { type: 'object', properties: { name: { type: 'string', maxLength: 256 }, url: { type: 'string', maxLength: 512 }, icon_url: { type: 'string', maxLength: 512 } } },
        fields:      { type: 'array', maxItems: 25, items: embedFieldSchema },
    },
};

const executeBody = {
    type: 'object',
    properties: {
        content:       { type: 'string', maxLength: 2000 },
        username:      { type: 'string', maxLength: 80 },
        avatar_url:    { type: 'string', maxLength: 512 },
        avatarUrl:     { type: 'string', maxLength: 512 },
        tts:           { type: 'boolean' },
        embeds:        { type: 'array', maxItems: 10, items: embedSchema },
        attachmentIds: { type: 'array', items: { type: 'string' }, maxItems: 10 },
    },
};

async function routes(fastify, opts) {
    const { authenticate } = opts.authMiddleware;

    // Routes authentifiées
    fastify.post('/guilds/:guildId/channels/:channelId/webhooks', {
        schema: { body: createBody },
        preHandler: [authenticate, requirePermission('MANAGE_WEBHOOKS')],
    }, ctrl.create);

    fastify.get('/guilds/:guildId/channels/:channelId/webhooks', {
        preHandler: [authenticate, requirePermission('MANAGE_WEBHOOKS')],
    }, ctrl.listByChannel);

    fastify.get('/guilds/:guildId/webhooks', {
        preHandler: [authenticate, requirePermission('MANAGE_WEBHOOKS', 'guild')],
    }, ctrl.listByGuild);

    fastify.delete('/guilds/:guildId/webhooks/:webhookId', {
        preHandler: [authenticate, requirePermission('MANAGE_WEBHOOKS', 'guild')],
    }, ctrl.destroy);

    // Route publique exécution webhook (pas d'auth requise)
    fastify.post('/webhooks/:webhookId/:token', {
        schema: { body: executeBody },
    }, ctrl.execute);
}

module.exports = { routes };
