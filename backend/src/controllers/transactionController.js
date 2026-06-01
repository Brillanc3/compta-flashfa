// backend/src/controllers/transactionController.js
const transactionService = require('../services/transactionService');

const getJournal = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.id, 10);
        // --- MODIFICATION : Lecture depuis le body ---
        const { weekParams, filters, page, pageSize } = request.body;

        const validatedPage = page || 1;
        const validatedPageSize = pageSize || 15;

        if (isNaN(companyId) || !weekParams?.year || !weekParams?.week) {
            return reply.code(400).send({ message: "Les paramètres companyId et weekParams (year, week) sont requis." });
        }

        const result = await transactionService.getJournalTransactions(companyId, weekParams, filters || {}, validatedPage, validatedPageSize);
        reply.send(result);

    } catch (error) {
        request.log.error("Erreur lors de la récupération du journal de transaction:", error);
        reply.code(500).send({ message: "Erreur serveur lors de la récupération du journal." });
    }
};

const getSummary = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.id, 10);
        // --- MODIFICATION : Lecture depuis le body ---
        const { weekParams, filters } = request.body;

        if (isNaN(companyId) || !weekParams?.year || !weekParams?.week) {
            return reply.code(400).send({ message: "Les paramètres companyId et weekParams (year, week) sont requis." });
        }

        const summary = await transactionService.getJournalSummary(companyId, weekParams, filters || {});
        reply.send(summary);
    } catch (error) {
        request.log.error("Erreur lors de la récupération du résumé des transactions:", error);
        reply.code(500).send({ message: "Erreur serveur." });
    }
};

const updateCategory = async (request, reply) => {
    try {
        // --- MODIFICATION : On récupère le companyId pour la sécurité ---
        const companyId = parseInt(request.params.id, 10);
        const transactionId = parseInt(request.params.transactionId, 10);
        const { categoryId } = request.body;

        if (isNaN(transactionId) || !categoryId || isNaN(companyId)) {
            return reply.code(400).send({ message: "transactionId, categoryId et companyId sont requis." });
        }

        const updatedTransaction = await transactionService.updateTransactionCategory(transactionId, categoryId, companyId);
        reply.send(updatedTransaction);
    } catch (error) {
        // Gérer le cas où la transaction n'est pas trouvée (sécurité)
        if (error.code === 'P2025') {
            return reply.code(404).send({ message: "Transaction non trouvée ou n'appartenant pas à cette entreprise." });
        }
        request.log.error("Erreur lors de la mise à jour de la catégorie:", error);
        reply.code(500).send({ message: "Erreur serveur." });
    }
};

module.exports = {
    getJournal,
    getSummary,
    updateCategory,
};