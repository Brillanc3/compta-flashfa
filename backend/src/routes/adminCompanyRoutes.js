// backend/src/routes/adminCompanyRoutes.js
const {
    getCompanies,
    getCompanyDetails, // MODIFIÉ
    createCompany,     // NOUVEAU
    updateCompany,
    regenerateKey,     // NOUVEAU
    addBillableContact,
    removeBillableContact,
    addManager,
    removeManager
} = require('../controllers/adminCompanyController');
const { authenticate, checkPermission } = require('../middleware/auth');

async function adminCompanyRoutes(fastify, options) {
    fastify.addHook('preHandler', authenticate);

    fastify.get('/', { preHandler: checkPermission('ADMIN.PANEL.COMPANY.COMPANY.VIEW.ALL') }, getCompanies);
    fastify.post('/', { preHandler: checkPermission('ADMIN.PANEL.COMPANY.COMPANY.MANAGE') }, createCompany);

    // Route principale pour obtenir toutes les données de la page de détail
    fastify.get('/:id', { preHandler: checkPermission('ADMIN.PANEL.COMPANY.COMPANY.VIEW.ALL.DETAILS') }, getCompanyDetails);

    fastify.put('/:id', { preHandler: checkPermission('ADMIN.PANEL.COMPANY.COMPANY.MANAGE') }, updateCompany);
    fastify.post('/:id/regenerate-key', { preHandler: checkPermission('ADMIN.PANEL.COMPANY.COMPANY.MANAGE') }, regenerateKey);

    fastify.post('/:id/billable-contacts', { preHandler: checkPermission('ADMIN.PANEL.COMPANY.COMPANY.MANAGE') }, addBillableContact);
    fastify.delete('/:id/billable-contacts/:userId', { preHandler: checkPermission('ADMIN.PANEL.COMPANY.COMPANY.MANAGE') }, removeBillableContact);
    fastify.post('/:id/managers', addManager);
    fastify.delete('/:id/managers/:userId', removeManager);
}

module.exports = adminCompanyRoutes;