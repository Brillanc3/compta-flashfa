'use strict';

const ctrl = require('./message.controller');
const { requirePermission } = require('../permissions/permission.preHandler');
const { rateLimit }  = require('../middlewares/rateLimit.middleware');
const { slowMode }   = require('../middlewares/slowMode.middleware');
const v = require('./message.validator');

const rlPostMsg = rateLimit({
    key:      (req) => `v2:rl:msg:${req.params.channelId}:${req.user?.id}`,
    windowMs: 5_000,
    limit:    5,
});

async function routes(fastify, opts) {
    const { authenticate } = opts.authMiddleware;
    fastify.addHook('preHandler', authenticate);

    // GET /guilds/:guildId/channels/:channelId/messages
    fastify.get('/guilds/:guildId/channels/:channelId/messages', {
        schema: { params: v.channelParams, querystring: v.listQuerystring },
        preHandler: [requirePermission('READ_MESSAGE_HISTORY')],
    }, ctrl.list);

    // GET /guilds/:guildId/channels/:channelId/messages/:messageId
    fastify.get('/guilds/:guildId/channels/:channelId/messages/:messageId', {
        schema: { params: v.messageParams },
        preHandler: [requirePermission('READ_MESSAGE_HISTORY')],
    }, ctrl.getOne);

    // POST /guilds/:guildId/channels/:channelId/messages
    fastify.post('/guilds/:guildId/channels/:channelId/messages', {
        schema: { params: v.channelParams, body: v.createBody },
        preHandler: [requirePermission('SEND_MESSAGES'), rlPostMsg, slowMode],
    }, ctrl.create);

    // GET /guilds/:guildId/channels/:channelId/messages/:messageId/history (P2.4 — historique édition)
    fastify.get('/guilds/:guildId/channels/:channelId/messages/:messageId/history', {
        schema: { params: v.messageParams },
        preHandler: [requirePermission('VIEW_CHANNEL')],
    }, ctrl.getHistory);

    // PATCH /guilds/:guildId/channels/:channelId/messages/:messageId (auteur only — vérifié dans service)
    fastify.patch('/guilds/:guildId/channels/:channelId/messages/:messageId', {
        schema: { params: v.messageParams, body: v.editBody },
        preHandler: [requirePermission('VIEW_CHANNEL')],
    }, ctrl.edit);

    // DELETE /guilds/:guildId/channels/:channelId/messages/:messageId
    fastify.delete('/guilds/:guildId/channels/:channelId/messages/:messageId', {
        schema: { params: v.messageParams },
        preHandler: [requirePermission('VIEW_CHANNEL')],
    }, ctrl.destroy);

    // POST /guilds/:guildId/channels/:channelId/messages/bulk-delete
    fastify.post('/guilds/:guildId/channels/:channelId/messages/bulk-delete', {
        schema: { params: v.channelParams, body: v.bulkDeleteBody },
        preHandler: [requirePermission('MANAGE_MESSAGES')],
    }, ctrl.bulkDelete);

    // POST /guilds/:guildId/channels/:channelId/ack — marquer les messages lus
    fastify.post('/guilds/:guildId/channels/:channelId/ack', {
        schema: { params: v.channelParams, body: { type: 'object', required: ['messageId'], properties: { messageId: { type: 'string' } } } },
        preHandler: [requirePermission('VIEW_CHANNEL')],
    }, ctrl.ack);

    // GET /guilds/:guildId/channels/:channelId/read-states — états de lecture du channel
    fastify.get('/guilds/:guildId/channels/:channelId/read-states', {
        schema: { params: v.channelParams },
        preHandler: [requirePermission('VIEW_CHANNEL')],
    }, ctrl.getReadStates);
}

module.exports = { routes };
