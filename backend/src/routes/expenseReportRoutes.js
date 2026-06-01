// backend/src/routes/expenseReportRoutes.js

const {
    getExpenseReports,
    submitExpenseReport,
    reviewExpenseReport,
    getStats
} = require('../controllers/expenseReportController');

const { authenticate, checkPermission } = require('../middleware/auth');

/**
 * Définit les routes pour la gestion des notes de frais.
 * @param {object} fastify - L'instance de Fastify.
 */
async function expenseReportRoutes(fastify, options) {

    // On applique le middleware d'authentification à toutes les routes de ce fichier.
    fastify.addHook('preHandler', authenticate);

    // Doit être déclarée avant la route plus générale '/expense-reports' pour être interceptée correctement.
    fastify.get('/companies/:companyId/expense-reports/stats', {
        preHandler: [checkPermission('COMPANY.{companyId}.NOTE_DE_FRAIS.VIEW')]
    }, getStats);

    // --- Route pour les employés et les managers ---
    // Récupérer la liste des notes de frais (filtrée par le service selon les droits)
    fastify.get('/companies/:companyId/expense-reports', getExpenseReports);

    // Soumettre une nouvelle note de frais
    fastify.post('/companies/:companyId/expense-reports', submitExpenseReport);


    // --- Route réservée aux managers ---
    // Valider ou refuser une note de frais
    fastify.patch('/companies/:companyId/expense-reports/:reportId', {
        preHandler: [checkPermission('COMPANY.{companyId}.NOTE_DE_FRAIS.MANAGE')]
    }, reviewExpenseReport);

}



module.exports = expenseReportRoutes;