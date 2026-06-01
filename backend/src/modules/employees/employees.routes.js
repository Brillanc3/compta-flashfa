    // backend/src/modules/employees/employees.routes.js

'use strict';

const controller = require('./employees.controller');
const { PERMISSIONS, HIERARCHY } = require('./employees.permissions');

/**
 * Toutes les routes de ce module n’embarquent PLUS :companyId dans l’URL.
 * Le périmètre d’entreprise est désormais déterminé côté contrôleur via l’en-tête:
 *    headers['x-company-id'] (numérique requis)
 *
 * Les guards/checkPermission restent inchangés. Si votre middleware de permissions
 * lit déjà le header, rien à modifier. Sinon, adaptez-le pour récupérer l’ID
 * d’entreprise depuis request.headers['x-company-id'].
 */
async function employeeRoutes(fastify, options) {
    const { authenticate, checkPermission } = options.authMiddleware;

    // Auth globale
    fastify.addHook('preHandler', authenticate);

    // Gates permissions (inchangées)
    const viewOpts = { preHandler: [checkPermission(PERMISSIONS.RANKS_VIEW, HIERARCHY)] };
    const manageOpts = { preHandler: [checkPermission(PERMISSIONS.RANKS_MANAGE, HIERARCHY)] };
    const employeesViewOpts = { preHandler: [checkPermission(PERMISSIONS.EMPLOYEES_VIEW, HIERARCHY)] };
    const employeesManageOpts = { preHandler: [checkPermission(PERMISSIONS.EMPLOYEES_MANAGE, HIERARCHY)] };
    const employeesResetAccountOpts = { preHandler: [checkPermission(PERMISSIONS.EMPLOYEES_RESET_ACCOUNT, HIERARCHY)] };

    // ===== Meta / Settings (headers['x-company-id'])
    fastify.get('/available-columns', controller.getAvailableColumns);
    fastify.get('/available-permissions', manageOpts, controller.getAvailablePermissionTemplates);
    fastify.get('/remuneration-schema', controller.getRemunerationSchema);
    fastify.get('/rank-form-settings', controller.getRankFormSettings);

    // ===== Rangs
    fastify.get('/ranks', viewOpts, controller.getRanks);
    fastify.post('/ranks', manageOpts, controller.createRank);
    fastify.patch('/rank/:rankId', manageOpts, controller.updateRank);
    fastify.delete('/rank/:rankId', manageOpts, controller.deleteRank);
    fastify.patch('/ranks/order', manageOpts, controller.updateRankOrder);

    // ===== Employés
    fastify.get('', employeesViewOpts, controller.getEmployees);
    fastify.get('/employee/:employeeId', employeesViewOpts, controller.getEmployeeDetails);
    fastify.patch('/employee/:employeeId/status', employeesManageOpts, controller.changeEmployeeStatus);
    fastify.patch('/employee/:employeeId/rank', employeesManageOpts, controller.changeEmployeeRank);
    fastify.post('/employee/:employeeId/reminders/profile-update', employeesManageOpts, controller.sendProfileUpdateRequest);
    fastify.get('/employee/:employeeId/salary-breakdown', employeesViewOpts, controller.getSalaryBreakdown);
    fastify.patch('/employee/:employeeId/salary-override', employeesManageOpts, controller.setSalaryOverride);
    fastify.post(
        '/employee/:employeeId/reset-account',
        employeesResetAccountOpts,
        controller.resetEmployeeAccountController
    );

    // ===== Code de Liaison
    // Dirigeant : génère/régénère un code pour un employé PENDING_LINK
    fastify.post('/employee/:employeeId/link-code', employeesManageOpts, controller.generateLinkCodeController);
    // Employé : consomme le code (auth only, pas de permission company requise)
    fastify.post('/use-link-code', controller.useLinkCodeController);
    // ===== Liste compacte pour le chat (utilisateurs + rangs)
    fastify.get('/users-for-chat', controller.getUsersForChat);
    fastify.get('/data', controller.getCompanyEmployee);

    fastify.get('/widgets/my_salary', controller.getWidgetData_MySalary);
    fastify.get('/widgets/my_turnover', controller.getWidgetData_MyTurnover);

}

module.exports = {
    name: 'employees',
    isDefault: true,
    routes: employeeRoutes,
};
