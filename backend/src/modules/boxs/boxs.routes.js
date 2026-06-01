// /backend/src/modules/boxs/boxs.routes.js

const controller = require('./boxs.controller');
const { PERMISSIONS, HIERARCHY } = require('./boxs.permissions');

async function boxsRoutes(fastify, options) {
    const { authenticate, checkModuleAccess, checkPermission } = options.authMiddleware;
    fastify.addHook('preHandler', authenticate);

    // Journal ventes cartons
    fastify.get('/carton-sales', {
        preHandler: [
            checkModuleAccess('Boxs'),
            checkPermission(PERMISSIONS.CARTON_SALES_VIEW, HIERARCHY),
        ],
    }, controller.getCartonSales);

    // Stats agrégées
    fastify.get('/carton-sales/summary', {
        preHandler: [
            checkModuleAccess('Boxs'),
            checkPermission(PERMISSIONS.CARTON_SALES_VIEW, HIERARCHY),
        ],
    }, controller.getCartonSalesSummary);

    // Correction manuelle
    fastify.patch('/carton-sales/:cartonSaleId', {
        preHandler: [
            checkModuleAccess('Boxs'),
            checkPermission(PERMISSIONS.CARTON_SALES_EDIT, HIERARCHY),
        ],
    }, controller.updateCartonSale);
}

module.exports = {
    name: 'boxs',
    routes: boxsRoutes,
    payments: [
        { key: 'boxsSalaryPerCarton', label: 'Commission par carton ($)', type: 'currency', min: 0, max: 1000, step: 0.01, default: 0 },
    ],
    salaryCalculators: [
        {
            key: 'boxsSalaryPerCarton',
            serviceFunction: 'calculateBoxsSalary',
            drawingDetails: {
                label: 'Ventes cartons',
                template: '{cartonCount} cartons * {boxsSalaryPerCarton} $ = {calculatedValue} $',
            },
        },
    ],
    employeeListPageColumns: [
        { key: 'boxsCartonCount', label: 'Cartons vendus', serviceFunction: 'getCartonCountsForEmployeeList' },
        { key: 'boxsCartonSales', label: 'Ventes cartons ($)', serviceFunction: 'getCartonSalesTotalsForEmployeeList' },
    ],
};
