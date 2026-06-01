// backend/src/routes/fidelityRoutes.js

const {
    getFidelityTemplate,
    setupFidelityTemplate,
    serveCardImage,
    addStamp,
    createOrResetCard
} = require('../controllers/fidelityController');

const { authenticate, checkPermission } = require('../middleware/auth');

async function fidelityRoutes(fastify, options) {

    // --- Route Publique pour afficher une carte ---
    // Accessible par tout le monde via le lien unique (ex: /fidelity/view/abc123)
    fastify.get('/view/:publicLink', serveCardImage);

    // --- Routes Protégées pour la Gestion (pour les managers) ---

    // Récupérer le modèle de carte actif pour une entreprise
    fastify.get('/:id/template', {
        preHandler: [authenticate, checkPermission('COMPANY.{id}.FIDELITY.VIEW')]
    }, getFidelityTemplate);

    // Configurer ou mettre à jour le modèle de carte
    fastify.post('/:id/template/setup', {
        preHandler: [authenticate, checkPermission('COMPANY.{id}.FIDELITY.MANAGE')]
    }, setupFidelityTemplate);


    fastify.post('/card/:publicLink/add-stamp', {
        preHandler: [authenticate]
    }, addStamp);

    // Cette route est imbriquée pour être logique et sécurisée
    fastify.post('/companies/:companyId/clients/:clientId/card', {
        preHandler: [authenticate, checkPermission('COMPANY.{companyId}.FIDELITY.MANAGE')]
    }, createOrResetCard);
}

module.exports = fidelityRoutes;