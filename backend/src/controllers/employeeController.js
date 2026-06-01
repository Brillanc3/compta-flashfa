// backend/src/controllers/employeeController.js
const prisma = require('../db');
const { changeEmployeeRank: changeEmployeeRankService } = require('../services/employeeService.js');


// Note : Bien que nommé "employee", ce contrôleur gère des logiques liées aux utilisateurs dans un contexte admin.
const getAllUsers = async (request, reply) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                username: true,
            },
            orderBy: {
                name: 'asc'
            }
        });
        reply.send(users);
    } catch (error) {
        reply.code(500).send({ message: "Erreur lors de la récupération des utilisateurs." });
    }
};

/**
 * NOUVELLE FONCTION : Change le rang d'un employé et met à jour l'historique.
 */
const changeEmployeeRank = async (request, reply) => {
    try {
        const { employeeId } = request.params;
        const { newRankId } = request.body;

        if (!newRankId) {
            return reply.code(400).send({ message: "Le 'newRankId' est requis." });
        }

        await changeEmployeeRankService(parseInt(employeeId, 10), parseInt(newRankId, 10));

        reply.code(200).send({ message: "Le rang de l'employé a été mis à jour avec succès." });

    } catch (error) {
        if (error.code === 'P2025' || error.message.includes("introuvable")) {
            return reply.code(404).send({ message: "Employé ou rang non trouvé." });
        }
        console.error("Erreur lors du changement de rang:", error);
        reply.code(500).send({ message: "Erreur interne du serveur." });
    }
};


module.exports = { getAllUsers, changeEmployeeRank };