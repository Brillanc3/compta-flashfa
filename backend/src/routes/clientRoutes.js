// backend/src/routes/clientRoutes.js

const {
    listClients,
    getClientDetails,
    updateClient
} = require('../controllers/clientController');

const { authenticate, checkPermission } = require('../middleware/auth');

async function clientRoutes(fastify, options) {

    // Récupérer la liste de tous les clients pour une entreprise
    fastify.get('/:id/clients', {
        preHandler: [authenticate, checkPermission('COMPANY.{id}.CLIENT.VIEW')]
    }, listClients);

    // Récupérer les détails d'un client spécifique (avec son historique de factures)
    fastify.get('/:id/clients/:clientId', {
        preHandler: [authenticate, checkPermission('COMPANY.{id}.CLIENT.VIEW')]
    }, getClientDetails);

    // Mettre à jour les informations d'un client
    fastify.patch('/:id/clients/:clientId', {
        preHandler: [authenticate, checkPermission('COMPANY.{id}.CLIENT.MANAGE')]
    }, updateClient);
}

module.exports = clientRoutes;