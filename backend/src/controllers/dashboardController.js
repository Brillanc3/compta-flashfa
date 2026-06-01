// backend/src/controllers/dashboardController.js
const dashboardService = require('../services/dashboardService');
const { getFilteredWidgetDefinitions } = dashboardService;

/**
 * Logique pour obtenir le layout d'un utilisateur pour un contexte donné.
 */
const getUserDashboardLayout = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const { contextType = 'COMPANY', contextId: rawContextId } = request.query;
        const contextId = rawContextId ? parseInt(rawContextId, 10) : null;

        const isUserContext = contextType === 'ADMIN_USER';
        const userIdForContext = isUserContext ? userId : null;
        const companyIdForContext = !isUserContext ? contextId : null;

        if (!isUserContext && !contextId) {
            return reply.code(400).send({ message: "Le paramètre 'contextId' est requis pour le contexte 'COMPANY'." });
        }

        const widgets = await dashboardService.getUserDashboardLayout({
            userId,
            companyId: companyIdForContext,
            userIdForContext: userIdForContext,
            contextType,
        });

        reply.send(widgets);
    } catch (error) {
        request.log.error("Erreur lors de la récupération du layout:", error);
        reply.code(500).send({ message: "Erreur lors de la récupération du layout." });
    }
};


/**
 * Logique pour sauvegarder le layout de widgets de l'utilisateur pour un contexte donné.
 */
const saveUserDashboardLayout = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const { contextType = 'COMPANY', contextId: rawContextId } = request.query;
        const contextId = rawContextId ? parseInt(rawContextId, 10) : null;

        const { widgets } = request.body;

        const isUserContext = contextType === 'ADMIN_USER';
        const userIdForContext = isUserContext ? userId : null;
        const companyIdForContext = !isUserContext ? contextId : null;

        if (!isUserContext && !contextId) {
            return reply.code(400).send({ message: "Le paramètre 'contextId' est requis pour le contexte 'COMPANY'." });
        }

        await dashboardService.saveUserDashboardLayout({
            userId,
            companyId: companyIdForContext,
            userIdForContext: userIdForContext,
            contextType,
            widgets,
        });

        reply.code(200).send({ success: true, message: "Disposition sauvegardée." });
    } catch (error) {
        request.log.error("Erreur lors de la sauvegarde du layout:", error);
        reply.code(500).send({ message: "Erreur lors de la sauvegarde du layout." });
    }
};


/**
 * Récupère la liste de toutes les définitions de widgets qu'un utilisateur peut ajouter.
 */
const getAvailableWidgets = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const { contextType = 'COMPANY', contextId: rawContextId } = request.query;
        const contextId = rawContextId ? parseInt(rawContextId, 10) : null;

        if (!contextId && contextType === 'COMPANY') {
            return reply.code(400).send({ message: "L'ID de contexte est requis pour le contexte COMPANY." });
        }

        // Pour le contexte ADMIN, l'ID de contexte est l'ID de l'admin lui-même
        const idForFiltering = contextType === 'ADMIN_USER' ? userId : contextId;

        const availableWidgets = await getFilteredWidgetDefinitions(userId, idForFiltering, contextType);
        reply.send(availableWidgets);
    } catch (error) {
        request.log.error("Erreur de récupération des widgets disponibles:", error);
        reply.code(500).send({ message: "Erreur lors de la récupération des widgets disponibles." });
    }
};

/**
 * Récupère les données pour le widget Journal de Transaction.
 */
const getTransactionLogData = async (request, reply) => {
    try {
        // MODIFIÉ: L'ID de la compagnie vient du contextId
        const companyId = parseInt(request.query.contextId, 10);
        const config = JSON.parse(request.query.config);

        if (isNaN(companyId)) {
            return reply.code(400).send({ message: "Le 'contextId' de la compagnie est manquant ou invalide." });
        }

        const data = await dashboardService.getTransactionLogData(companyId, config);
        reply.send(data);
    } catch (error) {
        request.log.error("Erreur lors de la récupération des données de transaction:", error);
        reply.code(500).send({ message: "Erreur lors de la récupération des données de transaction." });
    }
};

module.exports = {
    getAvailableWidgets,
    getUserDashboardLayout,
    saveUserDashboardLayout,
    getTransactionLogData
};