'use strict';

const banCtrl  = require('./ban.controller');
const { requirePermission } = require('../permissions/permission.preHandler');
const { prisma } = require('../../../shards/database');
const { setTimeout: setMemberTimeout } = require('./timeout.service');

const guildParams = {
    type: 'object',
    required: ['guildId'],
    properties: { guildId: { type: 'string', pattern: '^[0-9]+$' } },
};
const banParams = {
    type: 'object',
    required: ['guildId', 'userId'],
    properties: {
        guildId: { type: 'string', pattern: '^[0-9]+$' },
        userId:  { type: 'string', pattern: '^[0-9]+$' },
    },
};
const banBody = {
    type: 'object',
    properties: {
        reason:            { type: 'string', maxLength: 512 },
        deleteMessageDays: { type: 'integer', minimum: 0, maximum: 7 },
    },
    additionalProperties: false,
};
const timeoutBody = {
    type: 'object',
    properties: {
        until: { type: 'string', format: 'date-time', nullable: true },
    },
    additionalProperties: false,
};

async function routes(fastify, opts) {
    const { authenticate } = opts.authMiddleware;
    fastify.addHook('preHandler', authenticate);

    // Bans
    fastify.get('/guilds/:guildId/bans', {
        schema: {
            params: guildParams,
            querystring: {
                type: 'object',
                properties: {
                    limit:  { type: 'integer', minimum: 1, maximum: 1000 },
                    before: { type: 'string', pattern: '^[0-9]+$' },
                },
            },
        },
        preHandler: [requirePermission('BAN_MEMBERS', 'guild')],
    }, banCtrl.list);

    fastify.put('/guilds/:guildId/bans/:userId', {
        schema: { params: banParams, body: banBody },
        preHandler: [requirePermission('BAN_MEMBERS', 'guild')],
    }, banCtrl.create);

    fastify.delete('/guilds/:guildId/bans/:userId', {
        schema: { params: banParams },
        preHandler: [requirePermission('BAN_MEMBERS', 'guild')],
    }, banCtrl.destroy);

    // Timeout (3.8)
    fastify.patch('/guilds/:guildId/members/:userId/timeout', {
        schema: { params: banParams, body: timeoutBody },
        preHandler: [requirePermission('MODERATE_MEMBERS', 'guild')],
    }, async (req, reply) => {
        try {
            await setMemberTimeout(req.params.guildId, req.params.userId, req.body.until ?? null, req.user.id);
            return reply.code(204).send();
        } catch (err) {
            return reply.code(err.status || 500).send({ message: err.message });
        }
    });
}

module.exports = { routes };
