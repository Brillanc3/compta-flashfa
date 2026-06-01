'use strict';

const ctrl = require('./search.controller');
const { rateLimit } = require('../middlewares/rateLimit.middleware');
const { requirePermission } = require('../permissions/permission.preHandler');

const rlSearch = rateLimit({
    key:      (req) => `v2:rl:search:${req.user?.id}`,
    windowMs: 10_000,
    limit:    10,
});

const querySchema = {
    type: 'object',
    required: ['q'],
    properties: {
        q:      { type: 'string', minLength: 2, maxLength: 200 },
        in:     { type: 'string' },
        from:   { type: 'string' },
        before: { type: 'string', format: 'date-time' },
        after:  { type: 'string', format: 'date-time' },
        limit:  { type: 'integer', minimum: 1, maximum: 25, default: 25 },
        cursor: { type: 'string' },
    },
};

async function routes(fastify, opts) {
    const { authenticate } = opts.authMiddleware;
    fastify.addHook('preHandler', authenticate);

    fastify.get('/guilds/:guildId/search', {
        schema: {
            params: {
                type: 'object',
                required: ['guildId'],
                properties: { guildId: { type: 'string' } },
            },
            querystring: querySchema,
        },
        preHandler: [rlSearch],
    }, ctrl.search);
}

module.exports = { routes };
