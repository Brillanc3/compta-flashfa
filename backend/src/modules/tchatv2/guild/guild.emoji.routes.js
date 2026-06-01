'use strict';

const ctrl = require('./guild.emoji.controller');
const { requirePermission } = require('../permissions/permission.preHandler');

const guildParams = {
    type: 'object',
    required: ['guildId'],
    properties: { guildId: { type: 'string', pattern: '^[0-9]+$' } },
};
const emojiParams = {
    type: 'object',
    required: ['guildId', 'emojiId'],
    properties: {
        guildId: { type: 'string', pattern: '^[0-9]+$' },
        emojiId: { type: 'string', pattern: '^[0-9]+$' },
    },
};

async function routes(fastify, opts) {
    const { authenticate } = opts.authMiddleware;
    fastify.addHook('preHandler', authenticate);

    fastify.get('/guilds/:guildId/emojis', {
        schema: { params: guildParams },
        preHandler: [requirePermission('VIEW_CHANNEL', 'guild')],
    }, ctrl.list);

    fastify.post('/guilds/:guildId/emojis', {
        schema: { params: guildParams },
        preHandler: [requirePermission('MANAGE_GUILD', 'guild')],
    }, ctrl.create);

    fastify.delete('/guilds/:guildId/emojis/:emojiId', {
        schema: { params: emojiParams },
        preHandler: [requirePermission('MANAGE_GUILD', 'guild')],
    }, ctrl.destroy);
}

module.exports = { routes };
