// backend/src/controllers/roleController.js

const prisma = require('../db');

/**
 * Récupère la liste de tous les rôles disponibles dans la base de données.
 * Utile pour l'interface d'administration afin d'afficher les options d'assignation.
 */
const getAllRoles = async (request, reply) => {
    try {
        const roles = await prisma.role.findMany();
        reply.send(roles);
    } catch (error) {
        reply.code(500).send({ message: 'Erreur lors de la récupération des rôles', error: error.message });
    }
};

module.exports = {
    getAllRoles,
};