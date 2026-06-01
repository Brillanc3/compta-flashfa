// backend/src/services/handlers/leaveGroup.handler.js

const prisma = require('../../db');
const { createNotification } = require('../notificationService');

/**
 * Indicates if this handler can process logs for employee resignations.
 * @param {string} logType
 * @returns {boolean}
 */
function supports(logType) {
    return logType === 'leaveGroup';
}

/**
 * Processes a log to handle an employee's resignation and clean up their related active data.
 * @param {object} log - The full log object from the database.
 */
async function handle(log) {
    let logData;
    try {
        logData = JSON.parse(log.data);
    } catch (error) {
        throw new Error("Impossible de parser les données du log, le format JSON est invalide.");
    }

    const properName = (logData.properName || '').toString().trim() || null;

    // {"properName":"Harry Finch","discord":"587873821915086868","characterId":53574,"name":"Brillance","source":706}

    const discordId = logData.discord ?? logData.discordId ?? null;
    const characterId = Number.isFinite(logData.characterId) ? logData.characterId : parseInt(logData.characterId, 10);

    if (!discordId || !Number.isFinite(characterId)) {
        throw new Error(
            `Log ID ${log.id}: 'discord'/'discordId' et/ou 'characterId' manquant ou invalide pour un log de type 'leaveGroup'.`
        );
    }

    const employee = await prisma.companyEmployee.findFirst({
        where: {
            companyId: log.companyId,
            status: 'ACTIVE',
            user: {
                discordId: String(discordId),
                characterId: characterId,
            },
        },
    });

    if (!employee) {
        console.log(`[LeaveGroupHandler] Employé actif (characterId: ${characterId}) non trouvé. Skipping.`);
        return;
    }

    // Mise à jour du nom si changé
    if (properName) {
        try {
            const u = await prisma.user.findUnique({ where: { id: employee.userId }, select: { id: true, name: true } });
            if (u && properName !== (u.name || '').trim()) {
                await prisma.user.update({ where: { id: u.id }, data: { name: properName } });
            }
        } catch (_) {}
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
        // 1. Find the latest rank history record for this employment
        const lastRankHistory = await tx.rankHistory.findFirst({
            where: {
                companyEmployeeId: employee.id,
                leaveAt: null,
            },
            orderBy: {
                assignedAt: 'desc',
            },
        });

        // 2. Update it with the departure date
        if (lastRankHistory) {
            await tx.rankHistory.update({
                where: { id: lastRankHistory.id },
                data: { leaveAt: now },
            });
        }

        // 3. "SOFT DELETE": Update the employee's status to 'RESIGNED'
        await tx.companyEmployee.update({
            where: { id: employee.id },
            data: {
                status: 'RESIGNED',
                statusUpdatedAt: now
            },
        });

        // 4. Remove the user from the company's billable contacts
        await tx.billableContact.deleteMany({
            where: {
                userId: employee.userId,
                companyId: log.companyId,
            },
        });

        console.log(`[LeaveGroupHandler] Le statut de l'employé ${employee.userId} est passé à RESIGNED.`);
    });

    // Remove from company TchatV2 guild
    const { removeCompanyGuildMember } = require('../../modules/tchatv2/guild/guild.service');
    removeCompanyGuildMember(employee.userId, log.companyId).catch(() => {});

    // 5. Notify the user
    await createNotification({
        recipientUserIds: [employee.userId],
        content: {
            title: "Démission enregistrée",
            body: `Votre démission de l'entreprise a bien été enregistrée.`,
            companyId: log.companyId,
        },
        type: 'SYSTEM',
        behavior: 'BLOCKING',
    });

    const companyId = log.companyId;
    const managerPermission = `COMPANY.${companyId}.*`;
    const managers = await prisma.user.findMany({
        where: {
            // Ils doivent être des employés actifs de l'entreprise
            employments: {
                some: {
                    companyId: companyId,
                    status: 'ACTIVE',
                },
            },
            // Et avoir la permission de gérant (soit directement, soit via un rôle)
            OR: [
                { permissions: { some: { action: managerPermission } } },
                { roles: { some: { permissions: { some: { action: managerPermission } } } } },
            ],
        },
        select: {
            id: true, // On a juste besoin de leur ID
        },
    });

    const managerIds = managers.map(manager => manager.id);
    if (managerIds.length > 0) {
        await createNotification({
            recipientUserIds: managerIds,
            content: {
                title: "Départ d'un employé",
                body: `L'employé ${properName || `#${employee.userId}`} a démissionné de l'entreprise. (${log.companyId})`,
                companyId: companyId,
            },
            type: 'SYSTEM',
            behavior: 'PERMANENT', // Non bloquant pour les gérants
        });
        console.log(`[LeaveGroupHandler] Notification de démission envoyée à ${managerIds.length} gérant(s).`);
    }
}

module.exports = {
    supports,
    handle,
};