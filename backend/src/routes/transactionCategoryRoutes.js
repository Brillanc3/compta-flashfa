// backend/src/routes/transactionCategoryRoutes.js
const transactionCategoryController = require('../controllers/transactionCategoryController');
const { authenticate } = require('../middleware/auth');

async function transactionCategoryRoutes(fastify, options) {
    fastify.addHook('preHandler', authenticate);

    fastify.get('/', transactionCategoryController.getAll);
}

module.exports = transactionCategoryRoutes;