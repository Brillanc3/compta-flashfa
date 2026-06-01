// backend/src/routes/logRoutes.js

const { getAllLogs, reprocessLog } = require('../controllers/logController');
const { authenticate, checkPermission } = require('../middleware/auth');

async function logRoutes(fastify, options) {

    // Route pour lister tous les logs (avec filtres)
    // MODIFIÉ : Utilise la nouvelle permission spécifique aux logs.
    fastify.get('/', {
        preHandler: [authenticate, checkPermission('ADMIN.PANEL.LOG.VIEW')]
    }, getAllLogs);

    // Route pour relancer le traitement d'un log spécifique
    // MODIFIÉ : Utilise la nouvelle permission spécifique à la gestion des logs.
    fastify.post('/:id/reprocess', {
        preHandler: [authenticate, checkPermission('ADMIN.PANEL.LOG.MANAGE')]
    }, reprocessLog);

}

module.exports = logRoutes;