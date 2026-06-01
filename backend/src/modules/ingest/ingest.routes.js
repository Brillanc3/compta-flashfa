// /backend/src/modules/ingest/ingest.routes.js

const controller = require('./ingest.controller');

/**
 * Définit la route pour la réception des données externes (ex: jeu).
 * Cette route n'utilise PAS le middleware d'authentification standard.
 * La sécurité est gérée par une clé d'API vérifiée dans le contrôleur.
 * @param {import('fastify').FastifyInstance} fastify
 */
async function ingestionRoutes(fastify, options) {

    fastify.options('/:companyId/:apiKey', (req, reply) => {
        reply
          .header('Access-Control-Allow-Origin', req.headers.origin || '*')
          .header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
          .header('Access-Control-Allow-Headers', 'Content-Type,Authorization')
          .send();
    });

    fastify.route({
        method: ['POST', 'GET'],
        url: '/:companyId/:apiKey',
        handler: controller.handleIngestion,
    });

}

module.exports = {
    name: 'ingest',
    routes: ingestionRoutes
};