// backend/src/services/userService.js

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { UserStatus } = require('@prisma/client');

/**
 * Trouve un utilisateur par son characterId ou le crée s'il n'existe pas.
 * Cette fonction est conçue pour être utilisée à l'intérieur d'une transaction Prisma.
 * @param {object} userData - Données extraites du log (ex: { characterId, properName, discordId, usernameBase }).
 * @param {object} tx - Le client de transaction Prisma.
 * @returns {Promise<object>} L'utilisateur trouvé ou créé.
 */
const findOrCreateUserFromLog = async (userData, tx) => {
    const { characterId, properName, discordId, usernameBase } = userData;

    if (!characterId || !properName) {
        throw new Error("characterId et properName sont requis pour trouver ou créer un utilisateur.");
    }

    // 1. On cherche l'utilisateur
    const existingUser = await tx.user.findUnique({
        where: { characterId: characterId },
    });

    if (existingUser) {
        return existingUser; // On l'a trouvé, on le retourne
    }

    // 2. S'il n'existe pas, on le crée
    console.log(`Utilisateur avec characterId ${characterId} non trouvé. Création...`);

    // On s'assure que le nom d'utilisateur est unique
    let finalUsername = usernameBase || properName.toLowerCase().replace(/\s/g, '.');
    const usernameExists = await tx.user.findUnique({ where: { username: finalUsername } });
    if (usernameExists) {
        finalUsername = `${finalUsername}${characterId}`;
    }

    // On crée un mot de passe temporaire et inutilisable
    const randomPassword = crypto.randomBytes(20).toString('hex');
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    const newUser = await tx.user.create({
        data: {
            name: properName,
            username: finalUsername,
            password: hashedPassword,
            characterId: characterId,
            discordId: discordId,
            status: UserStatus.PENDING_FINALIZATION, // L'utilisateur devra finaliser son compte
        },
    });

    return newUser;
};

/**
 * Récupère les 5 derniers changements de rang pour un utilisateur donné.
 * @param {number} userId - L'ID de l'utilisateur connecté.
 * @returns {Promise<Array>} Un tableau contenant l'historique des rangs.
 */
const findUserRankHistory = async (userId) => {
    try {
        // 1. On récupère d'abord tous les enregistrements CompanyEmployee de l'utilisateur
        const employments = await prisma.companyEmployee.findMany({
            where: {
                userId: userId,
            },
            select: {
                id: true, // On a juste besoin de l'ID pour la prochaine requête
            },
        });

        if (employments.length === 0) {
            return []; // L'utilisateur n'a aucun emploi, on retourne un tableau vide
        }

        const employmentIds = employments.map(e => e.id);

        // 2. On cherche dans l'historique des rangs pour tous ces emplois
        const rankHistory = await prisma.rankHistory.findMany({
            where: {
                companyEmployeeId: {
                    in: employmentIds,
                },
            },
            orderBy: {
                assignedAt: 'desc',
            },
            take: 5,
            // On sélectionne explicitement les champs nécessaires
            select: {
                assignedAt: true,
                leaveAt: true, // On ajoute le champ leaveAt
                rankName: true,
                companyEmployee: {
                    select: {
                        company: {
                            select: {
                                name: true,
                            },
                        },
                    },
                },
            },
        });

        // 3. On formate les données pour le frontend
        return rankHistory.map(history => ({
            rankName: history.rankName,
            companyName: history.companyEmployee.company.name,
            assignedAt: history.assignedAt,
            leaveAt: history.leaveAt, // On ajoute le champ leaveAt
        }));

    } catch (error) {
        console.error("Erreur lors de la récupération de l'historique des rangs:", error);
        // On propage l'erreur pour qu'elle soit gérée par le contrôleur
        throw new Error("Impossible de récupérer l'historique des rangs.");
    }
};

module.exports = {
    findOrCreateUserFromLog,
    findUserRankHistory
};