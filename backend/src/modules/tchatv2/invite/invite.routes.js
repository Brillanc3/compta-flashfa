'use strict';

const ctrl = require('./invite.controller');
const { requirePermission } = require('../permissions/permission.preHandler');

const guildParams = {
    type: 'object',
    required: ['guildId'],
    properties: {
        guildId: { type: 'string', pattern: '^[0-9]+$' },
    },
};
const chanInGuildParams = {
    type: 'object',
    required: ['guildId', 'channelId'],
    properties: {
        guildId:   { type: 'string', pattern: '^[0-9]+$' },
        channelId: { type: 'string', pattern: '^[0-9]+$' },
    },
};
const createBody = {
    type: 'object',
    properties: {
        maxUses:   { type: 'integer', minimum: 0, maximum: 100 },
        maxAge:    { type: 'integer', minimum: 0, maximum: 2592000 },
        temporary: { type: 'boolean' },
    },
    additionalProperties: false,
};

async function routes(fastify, opts) {
    const { authenticate } = opts.authMiddleware;

    // Public — pas besoin d'auth pour voir l'aperçu
    fastify.get('/invites/:code', ctrl.getByCode);

    // Protégé
    fastify.register(async (sub) => {
        sub.addHook('preHandler', authenticate);

        sub.post('/invites/:code', ctrl.join);

        sub.delete('/invites/:code', ctrl.destroy);

        sub.get('/guilds/:guildId/invites', {
            schema: { params: guildParams },
            preHandler: [requirePermission('MANAGE_CHANNELS', 'guild')],
        }, ctrl.listByGuild);

        sub.post('/guilds/:guildId/invites', {
            schema: { params: guildParams, body: createBody },
            preHandler: [requirePermission('CREATE_INSTANT_INVITE', 'guild')],
        }, ctrl.createForGuild);

        sub.get('/guilds/:guildId/channels/:channelId/invites', {
            schema: { params: chanInGuildParams },
            preHandler: [requirePermission('MANAGE_CHANNELS', 'guild')],
        }, ctrl.listByChannel);

        sub.post('/guilds/:guildId/channels/:channelId/invites', {
            schema: { params: chanInGuildParams, body: createBody },
            preHandler: [requirePermission('CREATE_INSTANT_INVITE', 'guild')],
        }, ctrl.create);
    });
}

module.exports = { routes };
