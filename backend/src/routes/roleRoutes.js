// backend/src/routes/roleRoutes.js

const { getAllRoles } = require('../controllers/roleController');
const { authenticate, checkPermission } = require('../middleware/auth');

async function roleRoutes(fastify, options) {

    // Route pour lister tous les rôles
    // Pour voir la liste des rôles, l'utilisateur doit avoir la permission d'assigner un rôle.
    fastify.get('/', {
        preHandler: [authenticate, checkPermission('USER.ASSIGN_ROLE')]
    }, getAllRoles);

}

module.exports = roleRoutes;