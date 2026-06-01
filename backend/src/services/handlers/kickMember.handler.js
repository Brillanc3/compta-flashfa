// backend/src/services/handlers/kickMember.handler.js

const prisma = require('../../db');
const { createNotification } = require('../notificationService');

function supports(logType) {
    return logType === 'kickMember';
}

async function handle(log) {
    let logData;
    try {
        logData = JSON.parse(log.data);
    } catch (error) {
        throw new Error("Impossible de parser les données du log, le format JSON est invalide.");
    }

    const targetProperName = (logData.targetProperName || '').toString().trim() || null;
    const kickerName = (logData.properName || '').toString().trim() || 'un administrateur';
    const targetCharacterId = logData.targetCharacterId ? Number(logData.targetCharacterId) : null;
    const kickerCharacterId = logData.characterId ? Number(logData.characterId) : null;
    const kickerDiscordId = logData.discord ? String(logData.discord) : null;

    if (!targetCharacterId) {
        throw new Error(`Log ID ${log.id}: 'targetCharacterId' manquant.`);
    }

    const employee = await prisma.companyEmployee.findFirst({
        where: {
            companyId: log.companyId,
            user: { characterId: targetCharacterId },
            status: 'ACTIVE'
        },
        include: { user: true },
    });

    if (!employee) {
        console.log(`[KickMemberHandler] Employé actif (characterId: ${targetCharacterId}) non trouvé. Skipping.`);
        return;
    }

    // Mise à jour du nom de la cible si changé
    if (targetProperName && targetProperName !== (employee.user.name || '').trim()) {
        try {
            await prisma.user.update({ where: { id: employee.userId }, data: { name: targetProperName } });
        } catch (_) {}
    }

    // Mise à jour du nom du kicker si résolvable
    if (kickerCharacterId || kickerDiscordId) {
        try {
            let kickerUser = null;
            if (kickerCharacterId && kickerDiscordId) {
                kickerUser = await prisma.user.findFirst({ where: { characterId: kickerCharacterId, discordId: kickerDiscordId } });
            } else if (kickerCharacterId) {
                kickerUser = await prisma.user.findFirst({ where: { characterId: kickerCharacterId } });
            } else {
                kickerUser = await prisma.user.findFirst({ where: { discordId: kickerDiscordId } });
            }
            if (kickerUser && kickerName !== 'un administrateur' && kickerName !== (kickerUser.name || '').trim()) {
                await prisma.user.update({ where: { id: kickerUser.id }, data: { name: kickerName } });
            }
        } catch (_) {}
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
        // 1. Mise à jour de l'historique avec la date de départ
        const lastRankHistory = await tx.rankHistory.findFirst({
            where: {
                companyEmployeeId: employee.id,
                leaveAt: null,
            },
            orderBy: {
                assignedAt: 'desc',
            },
        });

        if (lastRankHistory) {
            await tx.rankHistory.update({
                where: { id: lastRankHistory.id },
                data: { leaveAt: now },
            });
        }

        // 2. "SOFT DELETE" : On met à jour le statut de l'employé au lieu de le supprimer.
        await tx.companyEmployee.update({
            where: { id: employee.id },
            data: {
                status: 'FIRE',
                statusUpdatedAt: now
            },
        });

        // 3. On supprime son statut de "contact facturable" car il n'est plus actif.
        await tx.billableContact.deleteMany({
            where: {
                userId: employee.userId,
                companyId: log.companyId,
            },
        });

        console.log(`[KickMemberHandler] Le statut de l'employé ${employee.userId} est passé à FIRE.`);
    });

    // Remove from company TchatV2 guild
    const { removeCompanyGuildMember } = require('../../modules/tchatv2/guild/guild.service');
    removeCompanyGuildMember(employee.userId, log.companyId).catch(() => {});

    // 4. Notification à l'utilisateur
    await createNotification({
        recipientUserIds: [employee.userId],
        content: {
            title: "Fin de contrat",
            body: `Votre emploi a été terminé par ${kickerName}.`,
            companyId: log.companyId,
        },
        type: 'SYSTEM',
        behavior: 'BLOCKING',
    });
}

module.exports = {
    supports,
    handle,
};