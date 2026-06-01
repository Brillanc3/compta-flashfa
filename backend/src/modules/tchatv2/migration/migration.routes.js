'use strict';

const ctrl = require('./migration.controller');

const companyIdParams = {
    type: 'object',
    required: ['companyId'],
    properties: { companyId: { type: 'string', pattern: '^[0-9]+$' } },
};

async function routes(fastify, opts) {
    const { authenticate } = opts.authMiddleware;
    fastify.addHook('preHandler', authenticate);

    // GET  /admin/companies/:companyId/tchatv2-migrate
    fastify.get(
        '/admin/companies/:companyId/tchatv2-migrate',
        { schema: { params: companyIdParams } },
        ctrl.status,
    );

    // POST /admin/companies/:companyId/tchatv2-migrate  → active V2
    fastify.post(
        '/admin/companies/:companyId/tchatv2-migrate',
        { schema: { params: companyIdParams } },
        ctrl.enable,
    );

    // DELETE /admin/companies/:companyId/tchatv2-migrate → rollback V1
    fastify.delete(
        '/admin/companies/:companyId/tchatv2-migrate',
        { schema: { params: companyIdParams } },
        ctrl.disable,
    );

    // POST /admin/companies/:companyId/tchatv2-sync-ranks → backfill managed roles for existing members
    fastify.post(
        '/admin/companies/:companyId/tchatv2-sync-ranks',
        { schema: { params: companyIdParams } },
        ctrl.syncRanks,
    );
}

module.exports = { routes };
