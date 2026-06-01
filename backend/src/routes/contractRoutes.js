// backend/src/routes/contractRoutes.js
const {
    assignContract,
    getTemplates,
    getTemplateById,
    getAssignedContractById,
    signContract,
    postTemplate,
    getMyAssignedContracts
} = require('../controllers/contractController');
const { authenticate } = require('../middleware/auth');

async function contractRoutes(fastify, options) {
    fastify.addHook('preHandler', authenticate);

    // --- Routes pour les MODÈLES de contrat (Admin) ---
    fastify.get('/templates', getTemplates);
    fastify.get('/templates/:id', getTemplateById);
    fastify.post('/templates', postTemplate);
    fastify.post('/assign', assignContract);

    // Récupère TOUS les contrats assignés à l'utilisateur connecté
    fastify.get('/assigned/me', getMyAssignedContracts);
    // Récupère les détails d'un contrat spécifique assigné à l'utilisateur connecté
    fastify.get('/assigned/:id', getAssignedContractById);

    // Permet à l'utilisateur de signer son contrat
    fastify.post('/assigned/:id/sign', signContract);
}

module.exports = contractRoutes;