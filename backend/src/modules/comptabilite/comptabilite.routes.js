// /backend/src/modules/comptabilite/comptabilite.routes.js

const controller = require('./comptabilite.controller');
const { PERMISSIONS, HIERARCHY } = require('./comptabilite.permissions');
const prisma = require('../../db');
const { hasPermission, buildEffectiveCompanyPermissions } = require('../../middleware/auth');

function parseCompanyId(request) {
    const rawCompanyId = request.headers['x-company-id'];
    const companyId = Number(rawCompanyId);
    return rawCompanyId && Number.isFinite(companyId) && companyId > 0 ? companyId : null;
}

/**
 * Ajout de logs de débogage pour tracer la vérification de permission.
 */
const canViewBills = async (request, reply) => {
    const companyId = parseCompanyId(request);

    if (!companyId) {
        return reply.code(400).send({ message: "Header 'x-company-id' manquant ou invalide." });
    }

    request.companyId = companyId;

    const userId = request.user?.userId;
    if (!userId) {
        return reply.code(401).send({ message: 'Non authentifié.' });
    }

    // Permissions effectives (user + rôles + rang d’entreprise)
    const userPermissions = await buildEffectiveCompanyPermissions(userId, companyId);

    // Optionnel: si tu veux respecter le bypass "COMPANY.{id}.*" / "ADMIN.*" comme checkPermission
    if (userPermissions.has(`COMPANY.${companyId}.*`) || userPermissions.has('ADMIN.*')) {
        request.billViewMode = 'ALL';
        return;
    }

    const permViewAll = PERMISSIONS.BILLS_VIEW_ALL.replace('{companyId}', String(companyId));
    const permViewSelf = PERMISSIONS.BILLS_VIEW_SELF.replace('{companyId}', String(companyId));

    // 1) ALL
    if (hasPermission(userPermissions, permViewAll, HIERARCHY)) {
        request.billViewMode = 'ALL';
        return;
    }

    // 2) SELF
    if (hasPermission(userPermissions, permViewSelf, HIERARCHY)) {
        request.billViewMode = 'SELF';
        return;
    }

    // 3) Rien -> 403 final
    return reply.code(403).send({
        message: "Accès interdit : Vous n'avez pas la permission de voir les factures."
    });
};

async function comptabiliteRoutes(fastify, options) {
    const { authenticate, checkModuleAccess, checkPermission } = options.authMiddleware;
    fastify.addHook('preHandler', authenticate);

    // --- Routes existantes ---
    fastify.get('/balance/solde', { preHandler: [checkModuleAccess('Comptabilite'), checkPermission(PERMISSIONS.VIEW_BALANCE)] }, controller.getSolde);
    fastify.get('/transaction-categories', controller.getTransactionCategories);
    fastify.get('/declaration', { preHandler: [checkModuleAccess('Comptabilite'), checkPermission(PERMISSIONS.DECLARATION_VIEW, HIERARCHY)] }, controller.getTaxDeclaration);
    fastify.get('/bills', { preHandler: [checkModuleAccess('Comptabilite'), canViewBills] }, controller.getBills);
    fastify.get('/bills/:billId', { preHandler: [checkModuleAccess('Comptabilite'), canViewBills] }, controller.getBillDetails);
    fastify.patch(
        '/bills/:billId/shares',
        { preHandler: [checkModuleAccess('Comptabilite'), canViewBills] },
        controller.updateBillShares
    );

    // --- NOUVELLES ROUTES POUR LES COMMENTAIRES DE FACTURES ---
    fastify.get('/bills/:billId/comments', { preHandler: [checkModuleAccess('Comptabilite'), checkPermission(PERMISSIONS.BILLS_COMMENT_VIEW, HIERARCHY)] }, controller.getBillComments);
    fastify.post('/bills/:billId/comments', { preHandler: [checkModuleAccess('Comptabilite'), checkPermission(PERMISSIONS.BILLS_COMMENT_ADD, HIERARCHY)] }, controller.addBillComment);
    fastify.patch('/bills/comments/:commentId', { preHandler: [checkModuleAccess('Comptabilite')] }, controller.editBillComment);
    fastify.delete('/bills/comments/:commentId', { preHandler: [checkModuleAccess('Comptabilite')] }, controller.deleteBillComment);

    fastify.post('/transactions/journal', { preHandler: [checkModuleAccess('Comptabilite'), checkPermission(PERMISSIONS.TRANSACTIONS_VIEW, HIERARCHY)] }, controller.getJournal);
    fastify.post('/transactions/summary', { preHandler: [checkModuleAccess('Comptabilite'), checkPermission(PERMISSIONS.TRANSACTIONS_VIEW, HIERARCHY)] }, controller.getSummary);
    fastify.patch('/transactions/:transactionId', { preHandler: [checkModuleAccess('Comptabilite'), checkPermission(PERMISSIONS.TRANSACTIONS_EDIT, HIERARCHY)] }, controller.updateCategory);

    // --- NOUVELLES ROUTES POUR LES NOTES DE FRAIS ---
    const expenseReportManageOpts = { preHandler: [checkModuleAccess('Comptabilite'), checkPermission(PERMISSIONS.EXPENSE_REPORTS_MANAGE, HIERARCHY)] };
    const expenseCategoryManageOpts = { preHandler: [checkModuleAccess('Comptabilite'), checkPermission(PERMISSIONS.EXPENSE_CATEGORIES_MANAGE, HIERARCHY)] };
    const moduleAccessOnly = { preHandler: [checkModuleAccess('Comptabilite')] };

    fastify.post('/expense-reports', moduleAccessOnly, controller.createExpenseReport);
    fastify.get('/expense-reports', expenseReportManageOpts, controller.getExpenseReports);
    fastify.patch('/expense-reports/:reportId/status', expenseReportManageOpts, controller.updateExpenseReportStatus);
    fastify.patch('/expense-reports/:reportId', expenseReportManageOpts, controller.updateExpenseReport);
    fastify.delete('/expense-reports/:reportId', expenseReportManageOpts, controller.deleteExpenseReport);
    fastify.get('/expense-categories', moduleAccessOnly, controller.getExpenseReportCategories);
    fastify.post('/expense-categories', expenseCategoryManageOpts, controller.createExpenseReportCategory);
    fastify.patch('/expense-categories/:categoryId', expenseCategoryManageOpts, controller.updateExpenseReportCategory);
    fastify.delete('/expense-categories/:categoryId', expenseCategoryManageOpts, controller.deleteExpenseReportCategory);

    fastify.get('/widgets/user_bills_by_status', moduleAccessOnly, controller.getWidgetData_UserBillsByStatus);
    fastify.get('/widgets/expense_report_stats', moduleAccessOnly, controller.getWidgetData_ExpenseReportStats);
    fastify.get('/widgets/my_recent_expense_reports', moduleAccessOnly, controller.getWidgetData_MyRecentExpenseReports);
    fastify.get('/widgets/user_duty_counter', moduleAccessOnly, controller.getWidgetData_UserDutyCounter);
    fastify.get(
        '/widgets/users_duty_counter',
        {
            preHandler: [
                checkModuleAccess('Comptabilite'),
                checkPermission(PERMISSIONS.USERS_DUTY, HIERARCHY),
            ],
        },
        controller.getWidgetData_UsersDutyCounter
    );
    // GET /comptabilite/settings
    fastify.get('/settings', {
        preHandler: [
            checkModuleAccess('Comptabilite'),
            checkPermission('COMPANY.{companyId}.SETTINGS.VIEW', HIERARCHY)
        ]
    }, controller.getCompanySettings);

    fastify.patch('/settings/update-settings', {
        preHandler: [
            checkModuleAccess('Comptabilite'),
            checkPermission('COMPANY.{companyId}.SETTINGS.EDIT', HIERARCHY)
        ]
    }, controller.updateCompanySettings);

    // PATCH /comptabilite/settings/update-name
    fastify.patch('/settings/update-name', {
        preHandler: [
            checkModuleAccess('Comptabilite'),
            checkPermission('COMPANY.{companyId}.SETTINGS.EDIT', HIERARCHY)
        ]
    }, controller.updateCompany);

    // POST /comptabilite/settings/regenerate-api-key
    fastify.post('/settings/regenerate-api-key', {
        preHandler: [
            checkModuleAccess('Comptabilite'),
            checkPermission('COMPANY.{companyId}.SETTINGS.EDIT', HIERARCHY)
        ]
    }, controller.generateApiKey);

    // POST /comptabilite/settings/regenerate-onboarding-key
    fastify.post('/settings/regenerate-onboarding-key', {
        preHandler: [
            checkModuleAccess('Comptabilite'),
            checkPermission('COMPANY.{companyId}.SETTINGS.EDIT', HIERARCHY)
        ]
    }, controller.regenerateOnboardingKey);

    fastify.get('/widgets/transaction_log', { preHandler: [checkModuleAccess('Comptabilite'), checkPermission(PERMISSIONS.TRANSACTIONS_VIEW, HIERARCHY)] }, controller.getWidgetData_TransactionLog);
}

module.exports = {
    name: 'comptabilite',
    isDefault: true,
    routes: comptabiliteRoutes,
    payments: [
        { key: 'salaryFixed', label: 'Salaire fixe', type: 'currency', min: 0, max: 60000, step: 1, default: 0 },
        { key: 'commissionRate', label: 'Commission sur factures (%)', type: 'percent', min: 0, max: 100, step: 0.01, default: 0 },
        { key: 'serviceSalaryPerMinute', label: 'Salaire de service ($/minute)', type: 'currency', min: 0, max: 50, step: 0.01, default: 0 }
    ],
    salaryCalculators: [
        { key: 'salaryFixed', serviceFunction: 'calculateFixedSalary', drawingDetails: { label: 'Salaire fixe', template: '{salaryFixed} $ (fixe)' } },
        { key: 'commissionRate', serviceFunction: 'calculateCommissionSalary', drawingDetails: { label: 'Commission sur factures', template: '{totalBilled} $ * {commissionRate} % = {calculatedValue} $' } },
        { key: 'serviceSalaryPerMinute', serviceFunction: 'calculateServiceTimeSalary', drawingDetails: { label: 'Salaire de service', template: '{totalMinutes} minutes * {serviceSalaryPerMinute} $/minute = {calculatedValue} $' } }
    ],
    employeeListPageColumns: [
        { key: 'salary', label: 'Salaire (semaine)', serviceFunction: 'getSalariesForEmployeeList' },
        { key: "ca", label: 'Chiffre d\'affaire', serviceFunction: 'getCaForEmployeeList' },
        { key: 'billCount', label: 'Nombre de factures', serviceFunction: 'getBillCountsForEmployeeList' },

        { key: 'expenseReportTotal', label: 'Total NDF ($)', serviceFunction: 'getExpenseReportStatsForEmployeeList' },
        { key: 'expenseReportPending', label: 'NDF attente ($)', serviceFunction: 'getExpenseReportStatsForEmployeeList' },
        { key: 'expenseReportReimbursed', label: 'NDF Remb. ($)', serviceFunction: 'getExpenseReportStatsForEmployeeList' },
        { key: 'expenseReportRejected', label: 'NDF Rej. ($)', serviceFunction: 'getExpenseReportStatsForEmployeeList' },

        { key: 'serviceTime', label: 'Temps Service', serviceFunction: 'getServiceTimesForEmployeeList' }
    ],
    chatCommands: [
        { command: '/mySalary', description: 'Affiche votre détail de salaire.', serviceFunction: 'getSalaryChatResponse', context: 'ANY' }
    ]
};