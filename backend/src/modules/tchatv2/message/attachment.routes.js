'use strict';

const ctrl = require('./attachment.controller');
const { requirePermission } = require('../permissions/permission.preHandler');
const { resolveCompanyContext } = require('../middlewares/companyContext.middleware');

const channelParams = {
    type: 'object',
    required: ['guildId', 'channelId'],
    properties: {
        guildId:   { type: 'string', pattern: '^[0-9]+$' },
        channelId: { type: 'string', pattern: '^[0-9]+$' },
    },
};

async function routes(fastify, opts) {
    const { authenticate } = opts.authMiddleware;
    fastify.addHook('preHandler', authenticate);
    fastify.addHook('preHandler', resolveCompanyContext);

    fastify.post('/guilds/:guildId/channels/:channelId/attachments', {
        schema: { params: channelParams },
        preHandler: [requirePermission('ATTACH_FILES')],
    }, ctrl.uploadFiles);
}

module.exports = { routes };
