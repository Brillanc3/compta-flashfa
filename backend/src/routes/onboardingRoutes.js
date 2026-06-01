// backend/src/routes/onboardingRoutes.js

const {
    startOnboarding,
    linkAccount,
    createAndLinkAccount,
} = require('../controllers/onboardingController');

/**
 * Définit les routes pour le processus d'intégration d'un nouvel employé.
 * @param {object} fastify - L'instance de Fastify.
 */
async function onboardingRoutes(fastify, options) {

    // Route 1: Point d'entrée pour initialiser le processus.
    // On utilise POST car cette action peut potentiellement créer un nouvel employé,
    // ce qui est une modification de données.
    fastify.post('/start', startOnboarding);

    // Route 2: Utilisée lorsque l'utilisateur existe déjà et soumet ses informations
    // pour lier son compte.
    fastify.post('/link', linkAccount);

    // Route 3: Utilisée lorsque l'utilisateur n'existe pas et soumet ses informations
    // pour finaliser la création de son compte.
    fastify.post('/create', createAndLinkAccount);

}

module.exports = onboardingRoutes;