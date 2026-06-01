// backend/src/routes/companyRoutes.js

const {
    // Fonctions existantes
    getAllCompanies, createCompany, getCompanyById,
    updateCompany, deleteCompany, assignUserToCompany,
    removeUserFromCompany, generateApiKey, setApiStatus,
    updateCompanyModules, getCompanySettings,
    regenerateOnboardingKey,
    getOnboardingCodes,
    createOnboardingCode,
    deleteOnboardingCode,
    getCompanyEmployees,
    updateEmployeeStatus,
    getAllCompaniesForAdmin,
    getCompaniesByIds,
    getCompanyBills
} = require('../controllers/companyController');

const { authenticate, checkPermission } = require('../middleware/auth');

async function companyRoutes(fastify, options) {

    // --- Routes Générales (Panel Admin) ---
    fastify.get('/', { preHandler: [authenticate, checkPermission('ADMIN.PANEL.COMPANY.VIEW')] }, getAllCompanies);
    fastify.post('/', { preHandler: [authenticate, checkPermission('ADMIN.PANEL.COMPANY.CREATE')] }, createCompany);
    fastify.get('/:id', { preHandler: [authenticate, checkPermission('ADMIN.PANEL.COMPANY.VIEW')] }, getCompanyById);
    fastify.delete('/:id', { preHandler: [authenticate, checkPermission('ADMIN.PANEL.COMPANY.DELETE')] }, deleteCompany);
    fastify.post('/:id/assign-user', { preHandler: [authenticate, checkPermission('ADMIN.PANEL.COMPANY.ASSIGN_USER')] }, assignUserToCompany);
    fastify.post('/:id/remove-user', { preHandler: [authenticate, checkPermission('ADMIN.PANEL.COMPANY.ASSIGN_USER')] }, removeUserFromCompany);
    fastify.put('/:id/api-status', { preHandler: [authenticate, checkPermission('ADMIN.PANEL.COMPANY.EDIT')] }, setApiStatus);
    fastify.put('/:id/modules', { preHandler: [authenticate, checkPermission('ADMIN.PANEL.COMPANY.EDIT')] }, updateCompanyModules);

    // --- Routes pour la Page "Paramètres de l'Entreprise" ---
    fastify.get('/:id/settings', { preHandler: [authenticate, checkPermission('COMPANY.{id}.SETTINGS.VIEW')] }, getCompanySettings);
    fastify.patch('/:id/update-name', { preHandler: [authenticate, checkPermission('COMPANY.{id}.SETTINGS.EDIT')] }, updateCompany);
    fastify.post('/:id/regenerate-api-key', { preHandler: [authenticate, checkPermission('COMPANY.{id}.SETTINGS.EDIT')] }, generateApiKey);
    fastify.post('/:id/regenerate-onboarding-key', { preHandler: [authenticate, checkPermission('COMPANY.{id}.SETTINGS.EDIT')] }, regenerateOnboardingKey);

    // --- Routes pour la Gestion des Codes d'Onboarding (Permissions Mises à Jour) ---
    fastify.get('/:id/onboarding-codes', {
        preHandler: [authenticate, checkPermission('COMPANY.{id}.ONBOARDING_CODE.VIEW')] // MODIFIÉ
    }, getOnboardingCodes);

    fastify.post('/:id/onboarding-codes', {
        preHandler: [authenticate, checkPermission('COMPANY.{id}.ONBOARDING_CODE.MANAGE')] // MODIFIÉ
    }, createOnboardingCode);

    fastify.delete('/:id/onboarding-codes/:codeId', {
        preHandler: [authenticate, checkPermission('COMPANY.{id}.ONBOARDING_CODE.MANAGE')] // MODIFIÉ
    }, deleteOnboardingCode);

    fastify.get('/:id/bills', {
        preHandler: [authenticate, checkPermission('COMPANY.{id}.BILLS.VIEW')]
    }, getCompanyBills);

    fastify.get('/:id/employees', {
        preHandler: [authenticate, checkPermission('COMPANY.{id}.EMPLOYEE.VIEW')]
    }, getCompanyEmployees);

    fastify.patch('/:id/employees/:employeeId/status', {
        preHandler: [authenticate, checkPermission('COMPANY.{id}.EMPLOYEE.MANAGE')]
    }, updateEmployeeStatus);

    // Elle est spécifiquement pour les admins et protégée par le middleware de permission.
    fastify.get('/admin/all-companies', {
        preHandler: [authenticate, checkPermission('ADMIN.PANEL.COMPANY.VIEW')]
    }, getAllCompaniesForAdmin);

}

module.exports = companyRoutes;