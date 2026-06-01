// /backend/src/modules/automation/automation.routes.js

'use strict';

const controller = require('./automation.controller');
const { buildAutomationGuard } = require('./automation.permissions');

async function automationRoutes(fastify, options) {
    const { authenticate } = options.authMiddleware;
    const { canView, canManage } = buildAutomationGuard(options.authMiddleware);

    // Auth globale pour accéder à la configuration
    fastify.addHook('preHandler', authenticate);

    // Lecture (config / modèles / workflows) → AUTOMATION.VIEW (ou MANAGE).
    fastify.get(
        '/config',
        { preHandler: [canView] },
        controller.getConfig
    );

    fastify.get(
        '/templates',
        { preHandler: [canView] },
        controller.getTemplates
    );

    fastify.get(
        '/workflows',
        { preHandler: [canView] },
        controller.getWorkflows
    );

    // Écriture (création / modification de workflows) → AUTOMATION.MANAGE.
    fastify.post(
        '/workflows',
        { preHandler: [canManage] },
        controller.saveWorkflows
    );
}

module.exports = {
    name: 'automation',
    routes: automationRoutes,
};
