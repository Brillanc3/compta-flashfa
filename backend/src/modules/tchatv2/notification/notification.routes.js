'use strict';

const svc = require('./notification.service');
const { rateLimit } = require('../middlewares/rateLimit.middleware');

const rlSubscribe = rateLimit({
    key:      (req) => `v2:rl:push-sub:${req.user?.id}`,
    windowMs: 60_000,
    limit:    10,
});

/**
 * @param {import('fastify').FastifyInstance} fastify
 * @param {object} opts
 */
async function routes(fastify, opts) {
    const { authenticate } = opts.authMiddleware;
    fastify.addHook('preHandler', authenticate);

    // GET /push/vapid-public-key — clé publique VAPID (non sensible)
    fastify.get('/push/vapid-public-key', async (_req, reply) => {
        const publicKey = process.env.VAPID_PUBLIC_KEY || null;
        return reply.send({ publicKey });
    });

    // POST /push/subscribe — enregistre une souscription push
    fastify.post('/push/subscribe', {
        preHandler: [rlSubscribe],
        schema: {
            body: {
                type: 'object',
                required: ['endpoint', 'p256dh', 'auth'],
                properties: {
                    endpoint:   { type: 'string', maxLength: 500 },
                    p256dh:     { type: 'string', maxLength: 256 },
                    auth:       { type: 'string', maxLength: 64 },
                    deviceType: { type: 'string', maxLength: 20 },
                },
            },
        },
    }, async (req, reply) => {
        const { endpoint, p256dh, auth, deviceType } = req.body;
        const sub = await svc.subscribe(req.user.id, { endpoint, p256dh, auth, deviceType });
        return reply.status(200).send({ ok: true, id: sub.id });
    });

    // DELETE /push/unsubscribe — supprime une souscription push
    fastify.delete('/push/unsubscribe', {
        preHandler: [],
        schema: {
            body: {
                type: 'object',
                required: ['endpoint'],
                properties: {
                    endpoint: { type: 'string', maxLength: 500 },
                },
            },
        },
    }, async (req, reply) => {
        await svc.unsubscribe(req.user.id, req.body.endpoint);
        return reply.status(204).send();
    });

    const settingsCtrl = require('./userSettings.controller');

    // GET /guilds/:guildId/notif-settings — toutes les prefs user pour ce guild (batch)
    fastify.get('/guilds/:guildId/notif-settings', {
        schema: {
            params: { type: 'object', required: ['guildId'], properties: { guildId: { type: 'string' } } },
        },
    }, settingsCtrl.listForGuild);

    // GET /guilds/:guildId/channels/:channelId/notif-settings — préférences user pour un channel
    fastify.get('/guilds/:guildId/channels/:channelId/notif-settings', {
        schema: {
            params: { type: 'object', required: ['guildId', 'channelId'], properties: {
                guildId: { type: 'string' }, channelId: { type: 'string' },
            }},
        },
    }, settingsCtrl.getSettings);

    // PUT /guilds/:guildId/channels/:channelId/notif-settings
    fastify.put('/guilds/:guildId/channels/:channelId/notif-settings', {
        schema: {
            params: { type: 'object', required: ['guildId', 'channelId'], properties: {
                guildId: { type: 'string' }, channelId: { type: 'string' },
            }},
            body: {
                type: 'object',
                properties: {
                    level:          { type: 'integer', minimum: 0, maximum: 3 },
                    muteDurationMs: { type: 'integer', minimum: 0 },
                    muteForever:    { type: 'boolean' },
                    unmute:         { type: 'boolean' },
                },
                additionalProperties: false,
            },
        },
    }, settingsCtrl.setSettings);

    // GET /guilds/:guildId/notif-settings/guild — préférences guild-level
    fastify.get('/guilds/:guildId/notif-settings/guild', {
        schema: {
            params: { type: 'object', required: ['guildId'], properties: { guildId: { type: 'string' } } },
        },
    }, settingsCtrl.getGuildSettings);

    // PUT /guilds/:guildId/notif-settings/guild
    fastify.put('/guilds/:guildId/notif-settings/guild', {
        schema: {
            params: { type: 'object', required: ['guildId'], properties: { guildId: { type: 'string' } } },
            body: {
                type: 'object',
                properties: {
                    level:      { type: 'integer', minimum: 0, maximum: 3 },
                    mutedUntil: { type: 'string', format: 'date-time', nullable: true },
                    unmute:     { type: 'boolean' },
                },
                additionalProperties: false,
            },
        },
    }, settingsCtrl.setGuildSettings);
}

module.exports = { routes };
