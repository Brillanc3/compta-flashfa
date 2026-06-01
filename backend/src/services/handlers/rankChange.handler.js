// /backend/src/services/handlers/rankChange.handler.js

const prisma = require('../../db');
const { changeEmployeeRankFromHandler } = require('../../modules/employees/employees.service');

function supports(logType) {
    return ['upRank', 'downRank'].includes(logType);
}

/**
 * 
 * {"properName":"Carrillo Fuentes Vicente",
 * "discord":"957333614184501298","newGroupRankId":22518,
 * "source":1431,"oldGroupRankId":22625,"characterId":26097,
 * "name":"MeroGhost","targetCharacterId":53574}
 */

async function handle(log) {
    let logData;
    try {
        logData = JSON.parse(log.data);
    } catch (error) {
        throw new Error("JSON invalide dans le log.");
    }

    const targetCharacterId = Number(logData.targetCharacterId);
    const newGroupRankId = Number(logData.newGroupRankId);

    if (!targetCharacterId || !newGroupRankId) {
        throw new Error(`Log ID ${log.id}: valeurs manquantes`);
    }

    // --- DEBUG ---
    console.log(`[RankChangeHandler] Log ${log.id}, characterId ${targetCharacterId}, groupRankId ${newGroupRankId}`);

    // 1. Trouver l'employé
    const employee = await prisma.companyEmployee.findFirst({
        where: {
            companyId: log.companyId,
            user: { characterId: targetCharacterId },
        },
        select: { id: true, userId: true },
    });

    if (!employee) {
        console.warn(`[RankChangeHandler] Aucun employé trouvé avec characterId ${targetCharacterId} dans company ${log.companyId}`);
        return;
    }

    // 2. Trouver le rang via groupRankId
    const newRank = await prisma.rank.findFirst({
        where: {
            groupRankId: newGroupRankId,
            companyId: log.companyId,
        },
    });

    if (!newRank) {
        console.warn(`[RankChangeHandler] Aucun rang trouvé pour groupRankId ${newGroupRankId} dans company ${log.companyId}`);
        return;
    }

    // 3. Exécuter le changement consolidé
    await changeEmployeeRankFromHandler({
        companyId: log.companyId,
        employeeId: employee.id,
        rankId: newRank.id,
    });

    console.log(`[RankChangeHandler] Rank changé : employé ${employee.id} -> rang "${newRank.name}".`);

    // Sync le rôle managed dans la guilde company
    const guild = await prisma.v2Guild.findFirst({
        where:  { companyId: log.companyId },
        select: { id: true },
    });
    if (guild) {
        const { syncManagedRoles } = require('../../modules/tchatv2/guild/guild.service');
        await syncManagedRoles(guild.id, employee.userId, log.companyId).catch((e) => {
            console.warn('[RankChangeHandler] syncManagedRoles error:', e?.message);
        });
    }
}

module.exports = {
    supports,
    handle,
};
