// backend/src/routes/billRoutes.js

const { getBills, getBillDetails } = require('../controllers/billController');
const { authenticate, checkPermission } = require('../middleware/auth');
const prisma = require('../db'); // On a besoin de prisma ici
const { hasWildcardPermission } = require('../middleware/auth');


/**
 * Handler de permission personnalisé pour la route des factures.
 * Vérifie si l'utilisateur a la permission de voir TOUTES les factures OU SEULEMENT les siennes.
 */
const canViewBills = async (request, reply) => {
    const companyId = parseInt(request.params.id, 10);
    const userId = request.user.userId;

    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: { include: { permissions: true } }, permissions: true }
    });

    const userPermissions = new Set();
    user.roles.forEach(r => r.permissions.forEach(p => userPermissions.add(p.action)));
    user.permissions.forEach(p => userPermissions.add(p.action));

    const canViewAll = hasWildcardPermission(userPermissions, `COMPANY.${companyId}.BILLS.VIEW`);
    const canViewSelf = hasWildcardPermission(userPermissions, `COMPANY.${companyId}.BILLS.SELF_VIEW`);

    if (!canViewAll && !canViewSelf) {
        return reply.code(403).send({ message: "Accès interdit: Permission de voir les factures requise." });
    }
    // Si l'une des deux permissions est présente, on laisse la requête passer.
};

/**
 * Définit les routes pour la gestion des factures.
 * @param {object} fastify - L'instance de Fastify.
 */
async function billRoutes(fastify, options) {

    fastify.addHook('preHandler', authenticate);

    fastify.get('/:id', getBillDetails);

    fastify.get('/:id/bills', {
        preHandler: [
            canViewBills
        ]
    }, getBills);

}

module.exports = billRoutes;