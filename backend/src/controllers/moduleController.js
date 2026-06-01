// backend/src/controllers/moduleController.js

const prisma = require('../db');

/**
 * Récupère la liste de tous les modules disponibles dans le système.
 */
const getAllModules = async (request, reply) => {
    try {
        const modules = await prisma.module.findMany({
            orderBy: {
                name: 'asc',
            },
            // On demande à Prisma d'inclure la relation avec les templates de permissions.
            include: {
                permissionTemplates: true,
            },
        });
        reply.send(modules);
    } catch (error) {
        reply.code(500).send({ message: 'Erreur lors de la récupération des modules', error: error.message });
    }
};

module.exports = {
    getAllModules,
};