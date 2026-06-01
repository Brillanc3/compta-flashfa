'use strict';

const ctrl = require('./role.controller');
const { requirePermission } = require('../permissions/permission.preHandler');
const { rateLimit } = require('../middlewares/rateLimit.middleware');

const rlCreateRole = rateLimit({
    key:      (req) => `v2:rl:role:${req.params.guildId}:${req.user?.id}`,
    windowMs: 60_000,
    limit:    10,
});

const guildParams = {
    type: 'object',
    required: ['guildId'],
    properties: { guildId: { type: 'string', pattern: '^[0-9]+$' } },
};
const roleParams = {
    type: 'object',
    required: ['guildId', 'roleId'],
    properties: {
        guildId: { type: 'string', pattern: '^[0-9]+$' },
        roleId:  { type: 'string', pattern: '^[0-9]+$' },
    },
};
const createBody = {
    type: 'object',
    required: ['name'],
    properties: {
        name:        { type: 'string', minLength: 1, maxLength: 100 },
        color:       { type: 'integer', minimum: 0 },
        hoist:       { type: 'boolean' },
        position:    { type: 'integer', minimum: 1 },
        permissions: { type: 'string' },
        mentionable: { type: 'boolean' },
    },
    additionalProperties: false,
};
const updateBody = {
    type: 'object',
    properties: {
        name:        { type: 'string', minLength: 1, maxLength: 100 },
        color:       { type: 'integer', minimum: 0 },
        hoist:       { type: 'boolean' },
        permissions: { type: 'string' },
        mentionable: { type: 'boolean' },
    },
    additionalProperties: false,
};
const reorderBody = {
    type: 'array',
    items: {
        type: 'object',
        required: ['id', 'position'],
        properties: {
            id:       { type: 'string' },
            position: { type: 'integer', minimum: 0 },
        },
    },
};

async function routes(fastify, opts) {
    const { authenticate } = opts.authMiddleware;
    fastify.addHook('preHandler', authenticate);

    fastify.get('/guilds/:guildId/roles', { schema: { params: guildParams } }, ctrl.list);

    fastify.post('/guilds/:guildId/roles', {
        schema: { params: guildParams, body: createBody },
        preHandler: [requirePermission('MANAGE_ROLES', 'guild'), rlCreateRole],
    }, ctrl.create);

    fastify.patch('/guilds/:guildId/roles', {
        schema: { params: guildParams, body: reorderBody },
        preHandler: [requirePermission('MANAGE_ROLES', 'guild')],
    }, ctrl.reorder);

    fastify.patch('/guilds/:guildId/roles/:roleId', {
        schema: { params: roleParams, body: updateBody },
        preHandler: [requirePermission('MANAGE_ROLES', 'guild')],
    }, ctrl.update);

    fastify.delete('/guilds/:guildId/roles/:roleId', {
        schema: { params: roleParams },
        preHandler: [requirePermission('MANAGE_ROLES', 'guild')],
    }, ctrl.destroy);
}

module.exports = { routes };
