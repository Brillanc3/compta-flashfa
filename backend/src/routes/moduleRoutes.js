// backend/src/routes/moduleRoutes.js

const { getAllModules } = require('../controllers/moduleController');
const { authenticate, checkPermission } = require('../middleware/auth');

/**
 * Définit les routes pour la gestion des modules.
 * @param {import('fastify').FastifyInstance} fastify
 */
async function moduleRoutes(fastify, options) {

    // Route pour lister tous les modules disponibles
    // Protégée par une permission d'administrateur, car seul un admin peut modifier les modules d'une entreprise.
    fastify.get('/', {
        preHandler: [authenticate, checkPermission('ADMIN.PANEL.COMPANY.EDIT')]
    }, getAllModules);

}

module.exports = moduleRoutes;