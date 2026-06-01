// backend/src/routes/rankRoutes.js

const {
    getRanksForCompany,
    createRank,
    updateRank,
    deleteRank,
} = require('../controllers/rankController');

const { authenticate, checkPermission } = require('../middleware/auth');

/**
 * Définit les routes pour la gestion des rangs d'une entreprise.
 * Ces routes seront préfixées par /companies/:id/ranks
 * @param {import('fastify').FastifyInstance} fastify
 */
async function rankRoutes(fastify, options) {

    // Lister tous les rangs d'une entreprise
    fastify.get('/', {
        preHandler: [authenticate, checkPermission('COMPANY.{id}.GRADES.VIEW')]
    }, getRanksForCompany);

    // Créer un nouveau rang
    fastify.post('/', {
        preHandler: [authenticate, checkPermission('COMPANY.{id}.GRADES.MANAGE')]
    }, createRank);

    // Mettre à jour un rang spécifique
    // Note: :rankId est un paramètre imbriqué
    fastify.put('/:rankId', {
        preHandler: [authenticate, checkPermission('COMPANY.{id}.GRADES.MANAGE')]
    }, updateRank);

    // Supprimer un rang
    fastify.delete('/:rankId', {
        preHandler: [authenticate, checkPermission('COMPANY.{id}.GRADES.MANAGE')]
    }, deleteRank);

}

module.exports = rankRoutes;