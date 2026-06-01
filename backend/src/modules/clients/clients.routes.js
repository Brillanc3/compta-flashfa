// /backend/src/modules/clients/clients.routes.js

const controller = require('./clients.controller');
const { PERMISSIONS, HIERARCHY } = require('./clients.permissions');

async function clientRoutes(fastify, options) {
    const { authenticate, checkPermission } = options.authMiddleware;

    /* -----------------------------------------------------------
     *   APPLIQUER L'AUTH GLOBALE AUX ROUTES PROTÉGÉES
     * ----------------------------------------------------------- */
    fastify.addHook('preHandler', authenticate);

    const viewOpts = { preHandler: [checkPermission(PERMISSIONS.CLIENTS_VIEW, HIERARCHY)] };
    const manageOpts = { preHandler: [checkPermission(PERMISSIONS.CLIENTS_MANAGE, HIERARCHY)] };

    const fidelityViewOpts = { preHandler: [checkPermission(PERMISSIONS.FIDELITY_VIEW, HIERARCHY)] };
    const fidelityManageOpts = { preHandler: [checkPermission(PERMISSIONS.FIDELITY_MANAGE, HIERARCHY)] };
    const fidelityStampOpts = { preHandler: [checkPermission(PERMISSIONS.FIDELITY_STAMP, HIERARCHY)] };

    const variablesManageOpts = { preHandler: [checkPermission(PERMISSIONS.CLIENTS_VARIABLES_MANAGE, HIERARCHY)] };

    /* -----------------------------------------------------------
     *   ROUTES CLIENTS
     * ----------------------------------------------------------- */
    fastify.get('', viewOpts, controller.listClients);
    fastify.post('', manageOpts, controller.createClient);
    fastify.get('/:clientId', viewOpts, controller.getClientDetails);
    fastify.patch('/:clientId', manageOpts, controller.updateClient);

    /* -----------------------------------------------------------
     *   ROUTES FIDÉLITÉ — TEMPLATES
     * ----------------------------------------------------------- */
    fastify.get('/template', fidelityViewOpts, controller.getFidelityTemplate);
    fastify.get('/template-all', fidelityViewOpts, controller.getAllFidelityTemplates);
    fastify.post('/template/setup', fidelityManageOpts, controller.setupFidelityTemplate);
    fastify.patch('/template/:templateId/active', fidelityManageOpts, controller.setTemplateActive);

    /* -----------------------------------------------------------
     *   ROUTES FIDÉLITÉ — CARTES
     * ----------------------------------------------------------- */
    fastify.post('/:clientId/card/create', fidelityManageOpts, controller.createCardForClient);
    fastify.post('/card/:publicLink/add-stamp', fidelityStampOpts, controller.addStamp);
    fastify.post('/card/:cardId/status', fidelityManageOpts, controller.setFidelityCardStatus);
    fastify.post('/card/:cardId/set-stamps', fidelityManageOpts, controller.setFidelityCardStampCount);
    fastify.delete('/card/:cardId', fidelityManageOpts, controller.deleteFidelityCard);
    fastify.get('/card/:cardId/history/last', fidelityViewOpts, controller.getCardLastHistory);
    fastify.patch('/card/:cardId/renew', fidelityManageOpts, controller.renewCard);

    /* -----------------------------------------------------------
     *   ROUTE PUBLIC VIEW (Image)
     * ----------------------------------------------------------- */
    fastify.get('/view/:publicLink', controller.serveCardImage);

    /* -----------------------------------------------------------
     *   ROUTE MES AVANTAGES (cross-company, auth seule)
     * ----------------------------------------------------------- */
    fastify.get('/me/perks', controller.getMyPerks);
    fastify.get('/perks-catalog', controller.getPerksCatalog);

    /* -----------------------------------------------------------
     *   ROUTES VARIABLES CLIENTS
     * ----------------------------------------------------------- */
    // Lister toutes les variables (visible par tous ayant CLIENTS_VIEW)
    fastify.get('/variables', viewOpts, controller.listVariables);

    // CRUD variables — réservé à clients.variables.manage
    fastify.post('/variables', variablesManageOpts, controller.createVariable);
    fastify.patch('/variables/:variableId', variablesManageOpts, controller.updateVariable);
    fastify.delete('/variables/:variableId', variablesManageOpts, controller.deleteVariable);
    fastify.post('/variables/:variableId/icon', variablesManageOpts, controller.uploadVariableIcon);

    // Rangs disponibles pour configurer l'ACL d'une variable
    fastify.get('/variables/ranks', variablesManageOpts, controller.getVariableRanks);

    // Gestion des accès (qui peut modifier une variable)
    fastify.patch('/variables/:variableId/access', variablesManageOpts, controller.updateVariableAccess);

    // Valeurs par client (lecture = viewOpts, écriture = viewOpts car le service vérifie les droits ACL)
    fastify.get('/:clientId/variables', viewOpts, controller.getClientVariableValues);
    fastify.patch('/:clientId/variables/:variableId', viewOpts, controller.setClientVariableValue);
}

module.exports = {
    name: 'clients',
    isDefault: true,
    routes: clientRoutes,
};
