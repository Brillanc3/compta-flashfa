// backend/src/controllers/expenseReportController.js

const {
    createExpenseReport,
    updateExpenseReportStatus,
    findExpenseReports,
    getExpenseReportStats
} = require('../services/expenseReportService');

/**
 * Récupère les notes de frais.
 * La logique de permission (voir tout vs. voir les siennes) est dans le service.
 */
const getExpenseReports = async (request, reply) => {
    try {
        const { companyId } = request.params;
        const reports = await findExpenseReports({
            companyId: parseInt(companyId, 10),
            user: request.user, // L'objet user est attaché par le middleware d'authentification
        });
        reply.send(reports);
    } catch (error) {
        console.error("[ExpenseReportController] Erreur dans getExpenseReports:", error);
        reply.code(500).send({ message: "Erreur lors de la récupération des notes de frais." });
    }
};

/**
 * Crée une nouvelle note de frais.
 */
const submitExpenseReport = async (request, reply) => {
    try {
        const { companyId } = request.params;
        const { amount, comment, date } = request.body;

        if (!amount || !comment || !date) {
            return reply.code(400).send({ message: "Les champs 'amount', 'comment', et 'date' sont requis." });
        }

        const newReport = await createExpenseReport({
            amount,
            comment,
            date,
            authorId: request.user.userId,
            companyId: parseInt(companyId, 10),
        });

        reply.code(201).send(newReport);
    } catch (error) {
        console.error("[ExpenseReportController] Erreur dans submitExpenseReport:", error);
        // On renvoie le message d'erreur du service (ex: date invalide)
        reply.code(400).send({ message: error.message || "Erreur lors de la création de la note de frais." });
    }
};

/**
 * Met à jour le statut d'une note de frais (pour les managers).
 */
const reviewExpenseReport = async (request, reply) => {
    try {
        const { companyId, reportId } = request.params;
        const { status } = request.body;

        if (!status || !['REIMBURSED', 'REJECTED'].includes(status)) {
            return reply.code(400).send({ message: "Le statut doit être 'REIMBURSED' ou 'REJECTED'." });
        }

        const updatedReport = await updateExpenseReportStatus({
            reportId: parseInt(reportId, 10),
            status,
            reviewerId: request.user.userId,
            companyId: parseInt(companyId, 10),
        });

        reply.send(updatedReport);
    } catch (error) {
        console.error("[ExpenseReportController] Erreur dans reviewExpenseReport:", error);
        reply.code(500).send({ message: "Erreur lors de la mise à jour de la note de frais." });
    }
};

/**
 * Récupère les statistiques des notes de frais.
 */
const getStats = async (request, reply) => {
    try {
        const { companyId } = request.params;
        const stats = await getExpenseReportStats(parseInt(companyId, 10));
        reply.send(stats);
    } catch (error) {
        console.error("[ExpenseReportController] Erreur dans getStats:", error);
        reply.code(500).send({ message: "Erreur lors de la récupération des statistiques." });
    }
};


module.exports = {
    getExpenseReports,
    submitExpenseReport,
    reviewExpenseReport,
    getStats
};