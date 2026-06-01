// /backend/src/modules/user/user.routes.js

const controller = require('./user.controller');

async function userRoutes(fastify, options) {
    const { authenticate } = options.authMiddleware;
    fastify.addHook('preHandler', authenticate); // Toutes les routes ici sont pour l'utilisateur connecté

    fastify.patch('/me', controller.updateSelf);

    const { getMyBills } = require('../../controllers/userBills.controller');
    fastify.get('/me/bills', getMyBills);

    fastify.get('/me/electronic-signature', controller.getMyElectronicSignature);
    fastify.put('/me/electronic-signature', controller.updateMyElectronicSignature);

    fastify.get('/preferences/:pageKey', controller.getPreferences);
    fastify.post('/preferences/:pageKey', controller.savePreferences);

    fastify.get('/me/rank-history', controller.getRankHistory);

    fastify.post('/me/change-password', controller.changePassword);
}

module.exports = {
    name: 'user',
    routes: userRoutes,
};
