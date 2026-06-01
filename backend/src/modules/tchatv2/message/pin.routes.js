'use strict';

const ctrl = require('./pin.controller');
const { requirePermission } = require('../permissions/permission.preHandler');

const channelParams = {
    type: 'object',
    required: ['guildId', 'channelId'],
    properties: {
        guildId:   { type: 'string', pattern: '^[0-9]+$' },
        channelId: { type: 'string', pattern: '^[0-9]+$' },
    },
};

const pinParams = {
    type: 'object',
    required: ['guildId', 'channelId', 'messageId'],
    properties: {
        guildId:   { type: 'string', pattern: '^[0-9]+$' },
        channelId: { type: 'string', pattern: '^[0-9]+$' },
        messageId: { type: 'string', pattern: '^[0-9]+$' },
    },
};

async function routes(fastify, opts) {
    const { authenticate } = opts.authMiddleware;
    fastify.addHook('preHandler', authenticate);

    fastify.get('/guilds/:guildId/channels/:channelId/pins', {
        schema: { params: channelParams },
        preHandler: [requirePermission('READ_MESSAGE_HISTORY')],
    }, ctrl.list);

    fastify.put('/guilds/:guildId/channels/:channelId/pins/:messageId', {
        schema: { params: pinParams },
        preHandler: [requirePermission('MANAGE_MESSAGES')],
    }, ctrl.pin);

    fastify.delete('/guilds/:guildId/channels/:channelId/pins/:messageId', {
        schema: { params: pinParams },
        preHandler: [requirePermission('MANAGE_MESSAGES')],
    }, ctrl.unpin);
}

module.exports = { routes };
