// /backend/src/modules/dashboard/dashboard.routes.js
const controller = require('./dashboard.controller');

async function routes(fastify, options) {
    const { authenticate } = options.authMiddleware;
    fastify.addHook('preHandler', authenticate);

    // Routes pour la gestion du layout et la liste des widgets
    fastify.get('/available-widgets', controller.getAvailableWidgets);
    fastify.get('/layout', controller.getUserDashboardLayout);
    fastify.post('/layout', controller.saveUserDashboardLayout);
}

module.exports = {
    name: 'dashboard',
    routes: routes,
};