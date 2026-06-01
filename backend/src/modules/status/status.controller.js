// /backend/src/modules/status/status.controller.js

const service = require('./status.service');

/**
 * Gère la requête pour obtenir le statut du système.
 * @param {import('fastify').FastifyRequest} request
 * @param {import('fastify').FastifyReply} reply
 */
const getStatus = async (request, reply) => {
    try {
        const systemStatus = await service.getSystemStatus();
        reply.send(systemStatus);
    } catch (error) {
        console.error("[StatusController] Erreur lors de la récupération du statut:", error);
        reply.code(500).send({ message: "Erreur interne lors de la récupération du statut du système." });
    }
};

module.exports = {
    getStatus,
};