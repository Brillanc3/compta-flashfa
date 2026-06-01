'use strict';

const chanCtrl = require('./channel.controller');
const owCtrl   = require('./overwrite.controller');
const { requirePermission } = require('../permissions/permission.preHandler');
const { rateLimit } = require('../middlewares/rateLimit.middleware');
const repo = require('./channel.repository');

const rlCreateChannel = rateLimit({
    key:      (req) => `v2:rl:chan:${req.params.guildId}:${req.user?.id}`,
    windowMs: 60_000,
    limit:    10,
});

const guildParams = {
    type: 'object',
    required: ['guildId'],
    properties: { guildId: { type: 'string', pattern: '^[0-9]+$' } },
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
    required: ['name', 'type'],
    properties: {
        name:             { type: 'string', minLength: 1, maxLength: 100 },
        type:             { type: 'integer', minimum: 0 },
        topic:            { type: 'string', maxLength: 1024 },
        position:         { type: 'integer', minimum: 0 },
        parentId:         { type: 'string', nullable: true },
        nsfw:             { type: 'boolean' },
        rateLimitPerUser: { type: 'integer', minimum: 0, maximum: 21600 },
    },
    additionalProperties: false,
};
const updateBody = {
    type: 'object',
    properties: {
        name:             { type: 'string', minLength: 1, maxLength: 100 },
        topic:            { type: 'string', maxLength: 1024, nullable: true },
        position:         { type: 'integer', minimum: 0 },
        parentId:         { type: 'string', nullable: true },
        nsfw:             { type: 'boolean' },
        rateLimitPerUser: { type: 'integer', minimum: 0, maximum: 21600 },
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
            parentId: { type: 'string', nullable: true },
        },
    },
};
const overwriteBody = {
    type: 'object',
    required: ['type'],
    properties: {
        type:  { type: 'string', enum: ['ROLE', 'MEMBER'] },
        allow: { type: 'string' },
        deny:  { type: 'string' },
    },
    additionalProperties: false,
};
const overwriteParams = {
    type: 'object',
    required: ['guildId', 'channelId', 'targetId'],
    properties: {
        guildId:   { type: 'string', pattern: '^[0-9]+$' },
        channelId: { type: 'string', pattern: '^[0-9]+$' },
        targetId:  { type: 'string', pattern: '^[0-9]+$' },
    },
};

async function routes(fastify, opts) {
    const { authenticate } = opts.authMiddleware;
    fastify.addHook('preHandler', authenticate);

    // Guild channels listing + creation + batch reorder
    fastify.get('/guilds/:guildId/channels', {
        schema: { params: guildParams },
        preHandler: [requirePermission('VIEW_CHANNEL', 'guild')],
    }, chanCtrl.list);

    fastify.post('/guilds/:guildId/channels', {
        schema: { params: guildParams, body: createBody },
        preHandler: [requirePermission('MANAGE_CHANNELS', 'guild'), rlCreateChannel],
    }, chanCtrl.create);

    fastify.patch('/guilds/:guildId/channels', {
        schema: { params: guildParams, body: reorderBody },
        preHandler: [requirePermission('MANAGE_CHANNELS', 'guild')],
    }, chanCtrl.reorder);

    // Individual channel — GET needs only VIEW_CHANNEL
    fastify.get('/guilds/:guildId/channels/:channelId', {
        schema: { params: chanInGuildParams },
        preHandler: [requirePermission('VIEW_CHANNEL', 'guild')],
    }, chanCtrl.getOne);

    fastify.patch('/guilds/:guildId/channels/:channelId', {
        schema: { params: chanInGuildParams, body: updateBody },
        preHandler: [requirePermission('MANAGE_CHANNELS', 'guild')],
    }, chanCtrl.update);

    fastify.delete('/guilds/:guildId/channels/:channelId', {
        schema: { params: chanInGuildParams },
        preHandler: [requirePermission('MANAGE_CHANNELS', 'guild')],
    }, chanCtrl.destroy);

    // Overwrites (3.4) — chemin /guilds/:guildId/channels/:channelId/permissions/:targetId
    fastify.put('/guilds/:guildId/channels/:channelId/permissions/:targetId', {
        schema: { params: overwriteParams, body: overwriteBody },
        preHandler: [requirePermission('MANAGE_CHANNELS', 'guild')],
    }, owCtrl.upsert);

    fastify.delete('/guilds/:guildId/channels/:channelId/permissions/:targetId', {
        schema: { params: overwriteParams },
        preHandler: [requirePermission('MANAGE_CHANNELS', 'guild')],
    }, owCtrl.destroy);
}

module.exports = { routes };
