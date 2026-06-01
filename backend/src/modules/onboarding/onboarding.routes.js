// /backend/src/modules/onboarding/onboarding.routes.js
const controller = require('./onboarding.controller');

/**
 * Module public : Onboarding (aucune authentification requise)
 */
async function onboardingRoutes(fastify) {
    fastify.post('/start', controller.startOnboarding);
    fastify.post('/link', controller.linkAccount);
    fastify.post('/create', controller.createAndLinkAccount);
}

module.exports = {
    name: 'onboarding',
    isDefault: true,
    routes: onboardingRoutes
};
