// /backend/src/services/employeeService.js

const prisma = require('../db');

/**
 * Change le rang d'un employé et met à jour son historique de manière atomique.
 * C'est la fonction centrale utilisée par le contrôleur et les handlers.
 * @param {number} companyEmployeeId - L'ID de l'enregistrement CompanyEmployee.
 * @param {number} newRankId - L'ID du nouveau rang à assigner.
 */
async function changeEmployeeRank(companyEmployeeId, newRankId) {
    const newRank = await prisma.rank.findUnique({ where: { id: newRankId } });
    if (!newRank) {
        throw new Error("Le nouveau rang est introuvable.");
    }

    const now = new Date();

    return prisma.$transaction(async (tx) => {
        // 1. On trouve et clôture l'entrée d'historique actuelle
        const currentRankHistory = await tx.rankHistory.findFirst({
            where: {
                companyEmployeeId: companyEmployeeId,
                leaveAt: null,
            },
            orderBy: {
                assignedAt: 'desc',
            },
        });

        if (currentRankHistory) {
            await tx.rankHistory.update({
                where: { id: currentRankHistory.id },
                data: { leaveAt: now },
            });
        }

        // 2. On met à jour l'employé avec son nouveau rang
        await tx.companyEmployee.update({
            where: { id: companyEmployeeId },
            data: { rankId: newRankId },
        });

        // 3. On crée la nouvelle entrée d'historique
        return tx.rankHistory.create({
            data: {
                assignedAt: now,
                rankName: newRank.name,
                companyEmployee: { connect: { id: companyEmployeeId } },
                rank: { connect: { id: newRankId } },
            },
        });
    });
}

module.exports = {
    changeEmployeeRank,
};