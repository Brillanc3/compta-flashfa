// /backend/src/modules/admin/admin.routes.js

const controller = require('./admin.controller');
const imageController = require('./admin.images.controller');
const { PERMISSIONS, HIERARCHY } = require('./admin.permissions');

/**
 * Routes du module Admin.
 * @param {import('fastify').FastifyInstance} fastify
 * @param {{ authMiddleware: { authenticate: Function, checkPermission: Function } }} options
 */
async function adminRoutes(fastify, options) {
    const { authenticate, checkPermission } = options.authMiddleware;

    fastify.addHook('preHandler', authenticate);

    // Base — ping d'accès
    fastify.get('/', {
        preHandler: [checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS)],
    }, controller.checkAccess);

    // Support facturation (semaine/année)
    // GET /admin/billing-support-dashboard?week=43&year=2025
    fastify.get('/billing-support-dashboard', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            // MANAGE implique VIEW via HIERARCHY
            checkPermission(PERMISSIONS.ADMIN_BILLING_SUPPORT_VIEW, HIERARCHY),
        ],
    }, controller.getBillingSupportDashboard);

    // Gestion Entreprises (inchangé)
    fastify.get('/companies', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_VIEW, HIERARCHY),
        ],
    }, controller.listCompanies);

    fastify.get('/companies/basic', {
        preHandler: [checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS)],
    }, controller.listCompaniesBasic);

    fastify.post('/companies', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_MANAGE, HIERARCHY),
        ],
    }, controller.createCompany);

    fastify.post('/companies/:companyId/shard/known', {
        preHandler: [checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS), checkPermission(PERMISSIONS.ADMIN_COMPANY_MANAGE, HIERARCHY)],
    }, controller.setCompanyKnown);

    fastify.patch('/companies/:companyId', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_MANAGE, HIERARCHY),
        ],
    }, controller.updateCompany);

    fastify.delete('/companies/:companyId', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_MANAGE, HIERARCHY),
        ],
    }, controller.deleteCompany);


    // Contacts facturables
    fastify.post('/companies/:companyId/billable-contacts', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_BILLING_SUPPORT_MANAGE, HIERARCHY),
        ],
    }, controller.assignBillableContact);

    fastify.post('/companies/:companyId/notify-incomplete', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_BILLING_SUPPORT_MANAGE, HIERARCHY),
        ],
    }, controller.notifyIncompleteCompany);

    fastify.delete('/companies/:companyId/billable-contacts/:userId', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_BILLING_SUPPORT_MANAGE, HIERARCHY),
        ],
    }, controller.removeBillableContact);

    fastify.patch('/companies/:companyId/billable-contacts/:userId', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_BILLING_SUPPORT_MANAGE, HIERARCHY),
        ],
    }, controller.setBillableContactPrio);


    fastify.patch('/companies/:companyId/accounting-price', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_BILLING_SUPPORT_MANAGE, HIERARCHY),
        ],
    }, controller.updateCompanyAccountingPrice);

    fastify.patch('/companies/:companyId/accounting-suspension', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_MANAGE, HIERARCHY),
        ],
    }, controller.setAccountingSuspension);

    fastify.patch('/bills/:billId/accounting-routing', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_BILLING_SUPPORT_MANAGE, HIERARCHY),
        ],
    }, controller.setBillAccountingRouting);

    fastify.post('/bills/:billId/accounting/issue', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_BILLING_SUPPORT_MANAGE, HIERARCHY),
        ],
    }, controller.issueAccountingBill);

    // Utilisateurs (sélecteur)
    fastify.get('/users', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_BILLING_SUPPORT_MANAGE, HIERARCHY),
        ],
    }, controller.listUsers);

    // Détails entreprise (summary)
    fastify.get('/companies/:companyId/details', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_VIEW_DETAILS, HIERARCHY),
        ],
    }, controller.getCompanyDetails);

    // Listes paginées (évite le mega payload)
    fastify.get('/companies/:companyId/transactions', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_VIEW_DETAILS, HIERARCHY),
        ],
    }, controller.listCompanyTransactions);

    fastify.get('/companies/:companyId/bills', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_VIEW_DETAILS, HIERARCHY),
        ],
    }, controller.listCompanyBills);

    fastify.get('/companies/:companyId/employees', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_VIEW_DETAILS, HIERARCHY),
        ],
    }, controller.listCompanyEmployees);

    fastify.get('/companies/:companyId/clients', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_VIEW_DETAILS, HIERARCHY),
        ],
    }, controller.listCompanyClients);


    // Logs (paginés)
    fastify.get('/companies/:companyId/logs', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
             checkPermission(PERMISSIONS.ADMIN_COMPANY_VIEW_DETAILS, HIERARCHY),
         ],
     }, controller.listCompanyLogs);
 
    fastify.get('/logs', {
        preHandler: [checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS)],
    }, controller.listGlobalLogs);
     fastify.post('/logs/:logId/retry', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_MANAGE, HIERARCHY),
        ],
    }, controller.retryLog);

    fastify.get('/logs/stats', {
        preHandler: [checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS)],
    }, controller.getLogsStats);

    fastify.post('/logs/retry-all', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_MANAGE, HIERARCHY),
        ],
    }, controller.retryAllFailedLogs);

    // Rangs (CRUD)
    fastify.get('/companies/:companyId/ranks', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_VIEW_DETAILS, HIERARCHY),
        ],
    }, controller.listCompanyRanks);

    fastify.post('/companies/:companyId/ranks', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_MANAGE, HIERARCHY),
        ],
    }, controller.createCompanyRank);

    fastify.patch('/companies/:companyId/ranks/order', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_MANAGE, HIERARCHY),
        ],
    }, controller.updateCompanyRankOrder);

    fastify.patch('/companies/:companyId/ranks/:rankId', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_MANAGE, HIERARCHY),
        ],
    }, controller.updateCompanyRank);

    fastify.delete('/companies/:companyId/ranks/:rankId', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_MANAGE, HIERARCHY),
        ],
    }, controller.deleteCompanyRank);

    // Services Custom
    fastify.get('/companies/:companyId/custom-services', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_SERVICE_MANAGE, HIERARCHY),
        ],
    }, controller.listCustomServices);

    fastify.post('/companies/:companyId/custom-services', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_SERVICE_CREATE, HIERARCHY),
        ],
    }, controller.createCustomService);

    fastify.patch('/custom-services/:serviceId', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_SERVICE_UPDATE, HIERARCHY),
        ],
    }, controller.updateCustomService);

    fastify.delete('/custom-services/:serviceId', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_SERVICE_DELETE, HIERARCHY),
        ],
    }, controller.deleteCustomService);

    // Permission templates (pour édition ranks)
    fastify.get('/permission-templates', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_VIEW_DETAILS, HIERARCHY),
        ],
    }, controller.listPermissionTemplates);

    // Employés (actions admin)
    fastify.post('/companies/:companyId/employees/:employeeId/reset-account', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_MANAGE, HIERARCHY),
        ],
    }, controller.resetEmployeeAccountAdmin);

    fastify.patch('/companies/:companyId/employees/:employeeId/user-profile', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_MANAGE, HIERARCHY),
        ],
    }, controller.updateEmployeeUserProfileAdmin);

    // Factures / Transactions (actions admin)
    fastify.patch('/companies/:companyId/bills/:billId/status', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_MANAGE, HIERARCHY),
        ],
    }, controller.updateBillStatusAdmin);

    fastify.patch('/companies/:companyId/transactions/:transactionId/category', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_MANAGE, HIERARCHY),
        ],
    }, controller.updateTransactionCategoryAdmin);

    // Clients (actions admin)
    fastify.post('/companies/:companyId/clients', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_MANAGE, HIERARCHY),
        ],
    }, controller.createClientAdmin);

    fastify.patch('/companies/:companyId/clients/:clientId', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_MANAGE, HIERARCHY),
        ],
    }, controller.updateClientAdmin);

    fastify.delete('/companies/:companyId/clients/:clientId', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_MANAGE, HIERARCHY),
        ],
    }, controller.deleteClientAdmin);

    // Contacts facturables (liste)
    fastify.get('/companies/:companyId/billable-contacts', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_BILLING_SUPPORT_VIEW, HIERARCHY),
        ],
    }, controller.listBillableContacts);


    fastify.get('/modules', {
        preHandler: [checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS)],
        handler: controller.getAllModules,
    });


// --- Attribution de modules à une entreprise ---
    fastify.post('/companies/:companyId/modules/assign', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_MANAGE)
        ]
    }, controller.assignCompanyModules);

// --- Retrait d'un module d'une entreprise ---
    fastify.post('/companies/:companyId/modules/remove', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_MANAGE)
        ]
    }, controller.removeCompanyModule);

    // Régénérer / définir la clé d’onboarding
    fastify.patch('/companies/:companyId/onboarding-key', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_MANAGE),
        ],
    }, controller.updateOnboardingKey);

    // Régénérer / définir la clé API
    fastify.patch('/companies/:companyId/api-key', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_MANAGE),
        ],
    }, controller.updateApiKey);

    // Récupérer (ou assurer) la permission full d'une entreprise
    fastify.get('/companies/:companyId/permissions/full', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_VIEW, HIERARCHY),
        ],
    }, controller.getCompanyFullPermission);

    fastify.get('/companies/:companyId/permissions/full-users', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_VIEW, HIERARCHY),
        ],
    }, controller.listCompanyFullUsers);

    // Employé — profil admin
    fastify.get('/companies/:companyId/employees/:employeeId/admin-profile', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_VIEW_DETAILS, HIERARCHY),
        ],
    }, controller.getEmployeeAdminProfile);

    fastify.post(
        '/companies/:companyId/users/:userId/full-access',
        { preHandler: [authenticate, checkPermission(PERMISSIONS.ADMIN_COMPANY_MANAGE, HIERARCHY)] },
        controller.setCompanyFullAccess
    );

    // Employé — statut
    fastify.patch('/companies/:companyId/employees/:employeeId/status', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_MANAGE, HIERARCHY),
        ],
    }, controller.setEmployeeStatus);

    // Employé — assign/remove rang
    fastify.post('/companies/:companyId/employees/:employeeId/rank', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_MANAGE, HIERARCHY),
        ],
    }, controller.assignEmployeeRank);

    fastify.delete('/companies/:companyId/employees/:employeeId/rank/:rankId', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_MANAGE, HIERARCHY),
        ],
    }, controller.removeEmployeeRank);

    // Employé — ajout historique de rang
    fastify.post('/companies/:companyId/employees/:employeeId/rank-history', {
        preHandler: [
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_MANAGE, HIERARCHY),
        ],
    }, controller.addEmployeeRankHistory);

    fastify.post('/companies/:companyId/users/:userId/avatar', {
        preHandler: [
            authenticate,
            checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS),
            checkPermission(PERMISSIONS.ADMIN_COMPANY_MANAGE, HIERARCHY),
        ],
    }, controller.uploadUserAvatarByAdmin);

    /* ===============================================================
     🏢 Conversations liées à une entreprise
     =============================================================== */
    fastify.get(
        '/companies/:companyId/conversations',
        { preHandler: [authenticate, checkPermission(PERMISSIONS.ADMIN_COMPANY_VIEW_DETAILS, HIERARCHY)] },
        controller.listCompanyConversations
    );

    fastify.get(
        '/conversations/:conversationId/messages',
        { preHandler: [authenticate, checkPermission(PERMISSIONS.ADMIN_COMPANY_VIEW_DETAILS, HIERARCHY)] },
        controller.listConversationMessages
    );

    /* ===============================================================
       💬 Messages (modération)
       =============================================================== */
    fastify.put(
        '/messages/:messageId',
        { preHandler: [authenticate, checkPermission(PERMISSIONS.ADMIN_COMPANY_MANAGE, HIERARCHY)] },
        controller.editMessage
    );

    fastify.delete(
        '/messages/:messageId',
        { preHandler: [authenticate, checkPermission(PERMISSIONS.ADMIN_COMPANY_MANAGE, HIERARCHY)] },
        controller.deleteMessage
    );

    fastify.post(
        '/conversations/:conversationId/system-message',
        { preHandler: [authenticate, checkPermission(PERMISSIONS.ADMIN_COMPANY_MANAGE, HIERARCHY)] },
        controller.sendSystemMessage
    );

    /* ===============================================================
       👥 Gestion des membres (utilisateurs et rôles)
       =============================================================== */
    fastify.post(
        '/conversations/:conversationId/members',
        { preHandler: [authenticate, checkPermission(PERMISSIONS.ADMIN_COMPANY_MANAGE, HIERARCHY)] },
        controller.addMember
    );

    fastify.delete(
        '/conversations/:conversationId/members',
        { preHandler: [authenticate, checkPermission(PERMISSIONS.ADMIN_COMPANY_MANAGE, HIERARCHY)] },
        controller.removeMember
    );

    /* ===============================================================
       💵 Factures d’un employé (pagination)
       =============================================================== */
    fastify.get(
        '/employees/:employeeId/bills',
        { preHandler: [authenticate, checkPermission(PERMISSIONS.ADMIN_COMPANY_VIEW_DETAILS, HIERARCHY)] },
        controller.listEmployeeBills
    );

    /* ===============================================================
       📢 Annonces admin
       =============================================================== */

    // Endpoint public (authentifié) — tous les users peuvent récupérer l'annonce active
    fastify.get('/announcements/active', { preHandler: [authenticate] }, controller.getActiveAnnouncement);

    fastify.get(
        '/announcements',
        { preHandler: [authenticate, checkPermission(PERMISSIONS.ADMIN_ANNOUNCEMENT_VIEW, HIERARCHY)] },
        controller.listAnnouncements
    );

    fastify.post(
        '/announcements',
        { preHandler: [authenticate, checkPermission(PERMISSIONS.ADMIN_ANNOUNCEMENT_MANAGE, HIERARCHY)] },
        controller.createAnnouncement
    );

    fastify.patch(
        '/announcements/:id',
        { preHandler: [authenticate, checkPermission(PERMISSIONS.ADMIN_ANNOUNCEMENT_MANAGE, HIERARCHY)] },
        controller.updateAnnouncement
    );

    fastify.delete(
        '/announcements/:id',
        { preHandler: [authenticate, checkPermission(PERMISSIONS.ADMIN_ANNOUNCEMENT_MANAGE, HIERARCHY)] },
        controller.deleteAnnouncement
    );

    // Images (ADMIN.IMAGE.MANAGE)
    const imgPre = [checkPermission(PERMISSIONS.ADMIN_PANEL_ACCESS), checkPermission(PERMISSIONS.ADMIN_IMAGE_MANAGE)];
    fastify.get('/images', { preHandler: imgPre }, imageController.listImages);
    fastify.post('/images/upload', { preHandler: imgPre }, imageController.uploadImage);
    fastify.get('/images/:imageId', { preHandler: imgPre }, imageController.getImage);
    fastify.patch('/images/:imageId/replace', { preHandler: imgPre }, imageController.replaceImage);
    fastify.post('/images/:imageId/convert-webp', { preHandler: imgPre }, imageController.convertToWebP);
    fastify.delete('/images/:imageId', { preHandler: imgPre }, imageController.deleteImage);

}

module.exports = { name: 'admin', routes: adminRoutes };