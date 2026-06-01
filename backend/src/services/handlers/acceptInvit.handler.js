// backend/src/services/handlers/acceptInvit.handler.js
const prisma = require('../../db');
const { CompanyEmployeeStatus, UserStatus } = require('@prisma/client');

function supports(logType) {
    return logType === 'acceptInvit';
}

async function handle(log) {
    let logData;
    try {
        logData = JSON.parse(log.data);
    } catch (error) {
        throw new Error("Impossible de parser les données du log, le format JSON est invalide.");
    }

    const properName = (logData.properName || '').toString().trim() || null;
    const discordId = logData.discord ?? logData.discordId ?? null;
    const characterId = logData.characterId;
    const companyId = log.companyId;

    if (!characterId) {
        throw new Error(`Données (characterId) manquantes pour créer ou lier l'employé (Log ID: ${log.id})`);
    }

    // Cherche le rang par défaut
    let defaultRank = await prisma.rank.findFirst({
        where: { companyId },
        orderBy: { position: 'asc' },
    });

    if (!defaultRank) {
        console.log(`[acceptInvit] Aucun rang trouvé pour l’entreprise ${companyId}. Création du rang "Recrue".`);
        defaultRank = await prisma.rank.create({
            data: { name: 'Recrue', position: 1, companyId, remunerationConfig: { commissionRate: 0, serviceSalaryPerMinute: 0 } },
        });
    }
    const discordIdStr = discordId?.toString() ?? null;
    const characterIdInt = Number.parseInt(characterId, 10);
    const existingUser = await prisma.user.findFirst({
        where: {
            discordId: discordIdStr,
            characterId: characterIdInt,
        },
    });

    // --- CAS 1 : UTILISATEUR EXISTANT ---
    if (existingUser) {
        console.log(`[acceptInvit] L'utilisateur ${existingUser.name || properName} existe déjà.`);

        // Mise à jour du nom si changé
        if (properName && properName !== (existingUser.name || '').trim()) {
            try {
                await prisma.user.update({ where: { id: existingUser.id }, data: { name: properName } });
            } catch (_) {}
        }

        const existingEmployment = await prisma.companyEmployee.findFirst({
            where: { companyId, userId: existingUser.id },
        });

        // --- CAS 1A : déjà employé mais INACTIF → le réactiver ---
        if (existingEmployment) {

            // Si déjà actif → rien à faire
            if (existingEmployment.status === CompanyEmployeeStatus.ACTIVE) {
                console.warn(`[acceptInvit] L'utilisateur ${existingUser.id} est déjà actif dans l'entreprise ${companyId}.`);
                return;
            }

            // Sinon : réactivation
            console.log(`[acceptInvit] Réactivation de ${existingUser.id} dans l'entreprise ${companyId}.`);

            await prisma.$transaction(async (tx) => {
                await tx.companyEmployee.update({
                    where: { id: existingEmployment.id },
                    data: {
                        status: CompanyEmployeeStatus.ACTIVE,
                        rankId: defaultRank.id
                    }
                });

                await tx.rankHistory.create({
                    data: {
                        companyEmployeeId: existingEmployment.id,
                        rankId: defaultRank.id,
                        rankName: defaultRank.name,
                    },
                });
            });

            // Auto-sync guilde company
            const { ensureCompanyMember } = require('../../modules/tchatv2/guild/guild.service');
            await ensureCompanyMember(existingUser.id, companyId).catch(() => {});

            return;
        }

        // --- CAS 1B : utilisateur existe mais pas encore dans cette entreprise ---
        await prisma.$transaction(async (tx) => {
            const employee = await tx.companyEmployee.create({
                data: {
                    user: { connect: { id: existingUser.id } },
                    company: { connect: { id: companyId } },
                    rank: { connect: { id: defaultRank.id } },
                    status: CompanyEmployeeStatus.ACTIVE,
                },
            });

            await tx.rankHistory.create({
                data: {
                    companyEmployeeId: employee.id,
                    rankId: defaultRank.id,
                    rankName: defaultRank.name,
                },
            });
        });

        console.log(`[acceptInvit] L'utilisateur existant (ID ${existingUser.id}) rejoint l'entreprise ${companyId}.`);

        // Auto-sync guilde company
        const { ensureCompanyMember } = require('../../modules/tchatv2/guild/guild.service');
        await ensureCompanyMember(existingUser.id, companyId).catch(() => {});
        return;
    }

    // --- CAS 2 : UTILISATEUR INEXISTANT (nouvelle création) ---
    await prisma.$transaction(async (tx) => {
        const newEmployee = await tx.companyEmployee.create({
            data: {
                status: CompanyEmployeeStatus.PENDING_LINK,
                company: { connect: { id: companyId } },
                rank: { connect: { id: defaultRank.id } },
                user: {
                    create: {
                        name: properName || 'Employé inconnu',
                        username: `pending_${characterIdInt}_${Date.now()}`,
                        password: '',
                        characterId: characterIdInt,
                        discordId: discordId ? discordId.toString() : null,
                        status: UserStatus.PENDING_FINALIZATION,
                    },
                },
            },
        });

        await tx.rankHistory.create({
            data: {
                companyEmployeeId: newEmployee.id,
                rankId: defaultRank.id,
                rankName: defaultRank.name,
            },
        });

        console.log(`[acceptInvit] Nouvel utilisateur ${properName} (charId: ${characterId}) créé + lié à l’entreprise ${companyId}.`);
    });
}

module.exports = {
    supports,
    handle,
};
