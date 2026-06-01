// backend/src/routes/ingestionRoutes.js

const { handleIngestion } = require('../controllers/ingestionController');

/**
 * Définit la route pour la réception des données du jeu.
 * @param {import('fastify').FastifyInstance} fastify
 */
async function ingestionRoutes(fastify, options) {

    // L'URL utilise l'ID de l'entreprise (:companyId) et sa clé (:apiKey).
    fastify.route({
        method: ['POST', 'GET'],
        url: '/:companyId/:apiKey',
        handler: handleIngestion,
    });

}

module.exports = ingestionRoutes;