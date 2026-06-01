// /backend/src/modules/status/status.routes.js

const controller = require('./status.controller');

/**
 * Définit les routes pour le module de statut.
 * Ces routes sont publiques et ne nécessitent aucune authentification.
 * @param {import('fastify').FastifyInstance} fastify
 */
async function statusRoutes(fastify, options) {

    // On ne met AUCUN hook d'authentification ici.

    fastify.get('/', controller.getStatus);

}

module.exports = {
    name: 'status',
    routes: statusRoutes
};