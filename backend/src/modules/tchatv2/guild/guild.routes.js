'use strict';

const ctrl = require('./guild.controller');
const { requirePermission } = require('../permissions/permission.preHandler');
const { createGuildBody, updateGuildBody, guildIdParams } = require('./guild.validator');
const { buildEffectiveCompanyPermissions, hasPermission } = require('../../../middleware/auth');

async function routes(fastify, opts) {
    const { authenticate } = opts.authMiddleware;
    fastify.addHook('preHandler', authenticate);

    // POST /guilds
    fastify.post('/guilds', {
        schema: { body: createGuildBody },
        preHandler: [async (req, reply) => {
            const companyId = Number(req.headers['x-company-id'] ?? req.body?.companyId);
            if (!companyId || !Number.isInteger(companyId) || companyId < 1) {
                return reply.code(403).send({ message: 'companyId requis pour créer une guild (header x-company-id ou body)' });
            }
            const perms = await buildEffectiveCompanyPermissions(req.user.userId, companyId);
            if (!hasPermission(perms, `COMPANY.${companyId}.*`)) {
                return reply.code(403).send({ message: 'Permission insuffisante pour créer une guild pour cette company' });
            }
            // Injecte dans le body pour que createGuild reçoive companyId
            req.body = { ...(req.body ?? {}), companyId };
        }],
    }, ctrl.create);

    // GET /users/@me/guilds
    fastify.get('/users/@me/guilds', ctrl.myGuilds);

    // POST /users/@me/refresh-cache — vide les caches Redis user-scoped (Ctrl+R)
    fastify.post('/users/@me/refresh-cache', ctrl.refreshCache);

    // GET /guilds/:guildId
    fastify.get('/guilds/:guildId', {
        schema: { params: guildIdParams },
        preHandler: [requirePermission('VIEW_CHANNEL', 'guild')],
    }, ctrl.getOne);

    // PATCH /guilds/:guildId
    fastify.patch('/guilds/:guildId', {
        schema: { params: guildIdParams, body: updateGuildBody },
        preHandler: [requirePermission('MANAGE_GUILD', 'guild')],
    }, ctrl.update);

    // DELETE /guilds/:guildId (owner only — vérifié dans le service)
    fastify.delete('/guilds/:guildId', {
        schema: { params: guildIdParams },
    }, ctrl.destroy);

    // GET /guilds/:guildId/presences
    fastify.get('/guilds/:guildId/presences', {
        schema: { params: guildIdParams },
        preHandler: [requirePermission('VIEW_CHANNEL', 'guild')],
    }, ctrl.guildPresences);

    // POST /guilds/:guildId/sync-members
    fastify.post('/guilds/:guildId/sync-members', {
        schema: { params: guildIdParams },
        preHandler: [requirePermission('MANAGE_GUILD', 'guild')],
    }, ctrl.syncMembers);

    // POST /guilds/:guildId/icon
    fastify.post('/guilds/:guildId/icon', {
        schema: { params: guildIdParams },
        preHandler: [requirePermission('MANAGE_GUILD', 'guild')],
    }, ctrl.uploadIcon);

    // POST /guilds/:guildId/banner
    fastify.post('/guilds/:guildId/banner', {
        schema: { params: guildIdParams },
        preHandler: [requirePermission('MANAGE_GUILD', 'guild')],
    }, ctrl.uploadBanner);

    // GET /guilds/:guildId/audit-logs
    fastify.get('/guilds/:guildId/audit-logs', {
        schema: {
            params: guildIdParams,
            querystring: {
                type: 'object',
                properties: {
                    limit:       { type: 'integer', minimum: 1, maximum: 100 },
                    before:      { type: 'string', pattern: '^[0-9]+$' },
                    action_type: { type: 'integer', minimum: 1 },
                    user_id:     { type: 'string', pattern: '^[0-9]+$' },
                },
            },
        },
        preHandler: [requirePermission('VIEW_AUDIT_LOG', 'guild')],
    }, ctrl.auditLogs);
}

module.exports = { routes };
