'use strict';

// Patch BigInt → string pour toutes les réponses JSON du module
require('./lib/bigint');

const { routes: guildRoutes }      = require('./guild/guild.routes');
const { routes: guildEmojiRoutes } = require('./guild/guild.emoji.routes');
const { routes: roleRoutes }       = require('./role/role.routes');
const { routes: channelRoutes }    = require('./channel/channel.routes');
const { routes: memberRoutes }     = require('./member/member.routes');
const { routes: inviteRoutes }     = require('./invite/invite.routes');
const { routes: banRoutes }        = require('./moderation/ban.routes');
const { routes: messageRoutes }    = require('./message/message.routes');
const { routes: attachmentRoutes } = require('./message/attachment.routes');
const { routes: pinRoutes }        = require('./message/pin.routes');
const { routes: threadRoutes }     = require('./thread/thread.routes');
const { routes: reactionRoutes }   = require('./reaction/reaction.routes');
const { routes: webhookRoutes }    = require('./webhook/webhook.routes');
const { routes: migrationRoutes }  = require('./migration/migration.routes');
const { routes: searchRoutes }     = require('./search/search.routes');
const { routes: notifRoutes }      = require('./notification/notification.routes');
const { routes: dmRoutes }         = require('./dm/dm.routes');
const { routes: monitoringRoutes } = require('./monitoring/monitoring.routes');
const { rateLimit }                = require('./middlewares/rateLimit.middleware');
const { startCleanupWorker, scheduleCleanupJob } = require('./jobs/cleanup.job');
const { startArchiveWorker, scheduleArchiveJob } = require('./jobs/archiveThreads.job');
const { startNotificationWorker }  = require('./notification/notification.worker');

/**
 * @param {import('fastify').FastifyInstance} fastify
 * @param {object} opts
 */
// Init Sentry backend (no-op si SENTRY_DSN absent)
require('./monitoring/sentry').init();

// Démarrage des workers BullMQ (idempotent — appelé une seule fois par shard)
startCleanupWorker();
scheduleCleanupJob().catch(() => {});
startArchiveWorker();
scheduleArchiveJob().catch(() => {});
startNotificationWorker();

const rlGlobal = rateLimit({
    key:      (req) => `v2:rl:global:${req.user?.id}`,
    windowMs: 10_000,
    limit:    50,
});

async function routes(fastify, opts) {
    const subOpts = { authMiddleware: opts.authMiddleware };

    fastify.get('/health', async () => ({ status: 'ok' }));

    // Rate limit global par user (50 req / 10s)
    fastify.addHook('preHandler', async (req, reply) => {
        if (req.url?.endsWith('/health')) return;
        if (!req.user?.id) return;
        return rlGlobal(req, reply);
    });

    // P0.6 — `resolveCompanyContext` est exporté depuis middlewares/companyContext.middleware
    // et doit être ajouté APRÈS `authenticate` au scope de chaque sous-module qui l'utilise
    // (req.user.id doit déjà être résolu). Migration progressive route par route.

    await fastify.register(guildRoutes,      subOpts);
    await fastify.register(guildEmojiRoutes, subOpts);
    await fastify.register(roleRoutes,       subOpts);
    await fastify.register(channelRoutes,    subOpts);
    await fastify.register(memberRoutes,     subOpts);
    await fastify.register(inviteRoutes,     subOpts);
    await fastify.register(banRoutes,        subOpts);
    await fastify.register(messageRoutes,    subOpts);
    await fastify.register(attachmentRoutes, subOpts);
    await fastify.register(pinRoutes,        subOpts);
    await fastify.register(threadRoutes,     subOpts);
    await fastify.register(reactionRoutes,   subOpts);
    await fastify.register(webhookRoutes,    subOpts);
    await fastify.register(migrationRoutes,  subOpts);
    await fastify.register(searchRoutes,     subOpts);
    await fastify.register(notifRoutes,      subOpts);
    await fastify.register(dmRoutes,         subOpts);
    await fastify.register(monitoringRoutes, subOpts);
}

module.exports = {
    name: 'tchatv2',
    routes,
    isDefault: true,
};
