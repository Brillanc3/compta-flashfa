// backend/src/routes/employeeRoutes.js
const { authenticate, checkPermission} = require('../middleware/auth');
const {changeEmployeeRank} = require("../controllers/employeeController");

async function employeeRoutes(fastify, options) {
    // Applique l'authentification à toutes les routes de ce fichier
    fastify.addHook('preHandler', authenticate);

    fastify.patch(
        '/:employeeId/rank',
        {
            preHandler: [authenticate, checkPermission('COMPANY.{companyId}.EMPLOYEES.VIEW')]
        },
        changeEmployeeRank
    );


}

module.exports = employeeRoutes;