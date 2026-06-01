// backend/src/routes/transactionRoutes.js
const transactionController = require('../controllers/transactionController');
const { authenticate } = require('../middleware/auth');

async function transactionRoutes(fastify, options) {
    fastify.addHook('preHandler', authenticate);

    // --- MODIFICATION : Passage en POST pour les filtres complexes ---
    // Sera préfixé par /api/companies/:id/transactions
    fastify.post('/journal/search', transactionController.getJournal);
    fastify.post('/journal/summary/search', transactionController.getSummary);

    // La route pour la mise à jour reste en PATCH
    fastify.patch('/:transactionId', transactionController.updateCategory);
}

module.exports = transactionRoutes;