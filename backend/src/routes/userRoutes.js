// backend/src/routes/userRoutes.js

const {
    getAllUsers,
    createUser,
    assignRolesToUser,
    updateMe,
    updateMyPreferences,
    getMyStartDateInCompany,
    getAssignableUsers, getUserRankHistory
} = require('../controllers/userController');


const { authenticate, checkPermission } = require('../middleware/auth');

async function userRoutes(fastify, options) {

    fastify.addHook('preHandler', authenticate);

    // Route pour que l'utilisateur connecté mette à jour son propre profil
    fastify.patch('/me', {
        preHandler: [authenticate]
    }, updateMe);

    const { getMyBills } = require('../controllers/userBills.controller');
    fastify.get('/me/bills', {
        preHandler: [authenticate]
    }, getMyBills);

    /**
     * Récupère l'historique des 5 derniers rangs de l'utilisateur connecté.
     * La route est protégée par le middleware `checkAuth` pour s'assurer que l'utilisateur est bien connecté.
     */
    fastify.get(
        '/me/rank-history',
        { preHandler: [authenticate] }, // Protection de la route
        getUserRankHistory
    );

    // On utilise la nouvelle permission
    fastify.get('/', {
        preHandler: [authenticate, checkPermission('ADMIN.PANEL.USER.VIEW')]
    }, getAllUsers);

    fastify.get('/assignable', getAssignableUsers);

    // On utilise la nouvelle permission
    fastify.post('/', {
        preHandler: [authenticate, checkPermission('ADMIN.PANEL.USER.CREATE')]
    }, createUser);

    // On utilise la nouvelle permission
    fastify.put('/:id/roles', {
        preHandler: [authenticate, checkPermission('ADMIN.PANEL.USER.ASSIGN_ROLE')]
    }, assignRolesToUser);

    // Met à jour les préférences de l'utilisateur connecté
    fastify.patch('/me/preferences', updateMyPreferences);

    // Récupère la date d'arrivée de l'utilisateur connecté dans une entreprise
    fastify.get('/me/companies/:companyId/start-date', getMyStartDateInCompany);

}

module.exports = userRoutes;