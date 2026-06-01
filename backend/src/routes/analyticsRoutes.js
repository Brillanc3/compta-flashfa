// backend/src/routes/analyticsRoutes.js

const { getCompanyAnalytics, getUserAnalytics } = require('../controllers/analyticsController');
const { authenticate, checkPermission } = require('../middleware/auth');

/**
 * Définit les routes pour les données analytiques d'une entreprise.
 * @param {import('fastify').FastifyInstance} fastify
 */
async function analyticsRoutes(fastify, options) {

    // Route pour récupérer les données agrégées de l'ENTREPRISE (pour les managers)
    fastify.get('/:id/analytics', {
        preHandler: [authenticate, checkPermission('COMPANY.{id}.ANALYTICS.VIEW')]
    }, getCompanyAnalytics);

    // Récupérer les données personnelles de l'UTILISATEUR connecté
    fastify.get('/:id/analytics/me', {
        // La seule condition est d'être authentifié.
        // La logique dans le contrôleur s'assure que l'utilisateur ne voit que ses propres données.
        preHandler: [authenticate]
    }, getUserAnalytics);

}

module.exports = analyticsRoutes;