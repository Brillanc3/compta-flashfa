'use strict';

const ctrl = require('./member.controller');
const { requirePermission } = require('../permissions/permission.preHandler');

const guildParams = {
    type: 'object',
    required: ['guildId'],
    properties: { guildId: { type: 'string', pattern: '^[0-9]+$' } },
};
const memberParams = {
    type: 'object',
    required: ['guildId', 'userId'],
    properties: {
        guildId: { type: 'string', pattern: '^[0-9]+$' },
        userId:  { type: 'string', pattern: '^[0-9]+$' },
    },
};
const roleParams = {
    type: 'object',
    required: ['guildId', 'userId', 'roleId'],
    properties: {
        guildId: { type: 'string', pattern: '^[0-9]+$' },
        userId:  { type: 'string', pattern: '^[0-9]+$' },
        roleId:  { type: 'string', pattern: '^[0-9]+$' },
    },
};
const updateBody = {
    type: 'object',
    properties: {
        nickname: { type: 'string', maxLength: 32, nullable: true },
        roles:    { type: 'array', items: { type: 'string' } },
    },
    additionalProperties: false,
};

async function routes(fastify, opts) {
    const { authenticate } = opts.authMiddleware;
    fastify.addHook('preHandler', authenticate);

    fastify.get('/guilds/:guildId/members', {
        schema: {
            params: guildParams,
            querystring: {
                type: 'object',
                properties: {
                    limit:     { type: 'integer', minimum: 1, maximum: 1000 },
                    after:     { type: 'string', pattern: '^[0-9]+$' },
                    channelId: { type: 'string', pattern: '^[0-9]+$' },
                },
            },
        },
    }, ctrl.list);

    fastify.get('/guilds/:guildId/members/:userId', {
        schema: { params: memberParams },
    }, ctrl.getOne);

    fastify.patch('/guilds/:guildId/members/:userId', {
        schema: { params: memberParams, body: updateBody },
        preHandler: [requirePermission('MANAGE_NICKNAMES', 'guild')],
    }, ctrl.update);

    fastify.delete('/guilds/:guildId/members/:userId', {
        schema: { params: memberParams },
        preHandler: [requirePermission('KICK_MEMBERS', 'guild')],
    }, ctrl.kick);

    fastify.put('/guilds/:guildId/members/:userId/roles/:roleId', {
        schema: { params: roleParams },
        preHandler: [requirePermission('MANAGE_ROLES', 'guild')],
    }, ctrl.putRole);

    fastify.delete('/guilds/:guildId/members/:userId/roles/:roleId', {
        schema: { params: roleParams },
        preHandler: [requirePermission('MANAGE_ROLES', 'guild')],
    }, ctrl.deleteRole);

    fastify.get('/users/mutual', {
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    q:              { type: 'string', maxLength: 64 },
                    excludeGuildId: { type: 'string', pattern: '^[0-9]+$' },
                    limit:          { type: 'integer', minimum: 1, maximum: 50 },
                },
                additionalProperties: false,
            },
        },
    }, ctrl.mutual);
}

module.exports = { routes };
