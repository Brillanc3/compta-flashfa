// backend/src/routes/dashboard.js
const {
    getAvailableWidgets,
    getUserDashboardLayout,
    saveUserDashboardLayout,
    getTransactionLogData
} = require('../controllers/dashboardController');

const { authenticate, checkPermission } = require('../middleware/auth');

async function dashboardRoutes(fastify, options) {

    // Authentification requise pour toutes les routes du dashboard
    fastify.addHook('preHandler', authenticate);

    // Route pour obtenir les définitions de widgets disponibles pour un contexte donné
    // Ex: GET /dashboard/available-widgets?contextType=COMPANY&contextId=123
    fastify.get('/available-widgets', getAvailableWidgets);

    // Route pour obtenir la disposition sauvegardée du dashboard pour un contexte
    // Ex: GET /dashboard/layout?contextType=ADMIN_USER
    fastify.get('/layout', getUserDashboardLayout);

    // Route pour sauvegarder la disposition du dashboard pour un contexte
    // Ex: POST /dashboard/layout?contextType=COMPANY&contextId=123
    fastify.post('/layout', saveUserDashboardLayout);

    // Route spécifique pour récupérer les données d'un widget
    // Note: La permission est vérifiée dans le service, mais on pourrait aussi la mettre ici.
    fastify.get('/widgets/transaction-log', getTransactionLogData);
}

module.exports = dashboardRoutes;