// /backend/src/modules/dashboard/dashboard.controller.js
const dashboardService = require('./dashboard.service');

const getAvailableWidgets = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const contextType = String(request.query.contextType || '');
        const contextId = parseInt(request.query.contextId, 10);

        // Pour les widgets d’entreprise on utilise le contextId comme companyId
        const companyId = contextType === 'COMPANY' ? contextId : null;

        const defs = await dashboardService.getFilteredWidgetDefinitions(userId, companyId);
        reply.send(defs);
    } catch (error) {
        request.log?.error?.(error);
        reply.code(500).send({ message: 'Erreur serveur' });
    }
};

const getUserDashboardLayout = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const contextType = String(request.query.contextType || '');
        const contextId = parseInt(request.query.contextId, 10);
        const companyId = contextType === 'COMPANY' ? contextId : null;

        const layout = await dashboardService.getUserDashboardLayout({ userId, companyId, contextType });
        reply.send(layout);
    } catch (error) {
        request.log?.error?.(error);
        reply.code(500).send({ message: 'Erreur serveur' });
    }
};

const saveUserDashboardLayout = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const companyId = parseInt(request.query.contextId, 10);
        const { widgets } = request.body;
        await dashboardService.saveUserDashboardLayout({ userId, companyId, widgets });
        reply.code(200).send({ success: true, message: "Disposition sauvegardée." });
    } catch (error) {
        console.error('[Dashboard Controller]', error);
        request.log.error("Erreur lors de la sauvegarde du layout:", error);
        reply.code(500).send({ message: "Erreur lors de la sauvegarde du layout." });
    }
};

module.exports = {
    getAvailableWidgets,
    getUserDashboardLayout,
    saveUserDashboardLayout,
};