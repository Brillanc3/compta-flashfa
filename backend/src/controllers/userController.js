// backend/src/controllers/userController.js

const prisma = require('../db');
const bcrypt = require('bcrypt');

const { findUserRankHistory } = require("../services/userService");


/**
 * Récupère une liste d'utilisateurs simplifiée pour les assignations.
 */
const getAssignableUsers = async (request, reply) => {
    try {
        // Pour l'instant, on retourne tous les utilisateurs.
        // On pourrait ajouter une logique pour exclure les admins ou autres.
        const users = await prisma.user.findMany({
            where: {
                status: 'ACTIVE' // On ne veut assigner des contrats qu'aux utilisateurs actifs
            },
            select: {
                id: true,
                name: true,
                username: true
            },
            orderBy: {
                name: 'asc'
            }
        });
        reply.send(users);
    } catch (error) {
        request.log.error("Erreur dans getAssignableUsers:", error);
        reply.code(500).send({ message: "Erreur lors de la récupération des utilisateurs." });
    }
};

/**
 * Récupère la liste de tous les utilisateurs avec leurs rôles.
 */
const getAllUsers = async (request, reply) => {
    try {
        const users = await prisma.user.findMany({
            include: {
                roles: true,
                companies: true,
            },
        });
        // On retire les mots de passe avant d'envoyer la réponse
        const usersWithoutPasswords = users.map(user => {
            const { password, ...rest } = user;
            return rest;
        });
        reply.send(usersWithoutPasswords);
    } catch (error) {
        reply.code(500).send({ message: 'Erreur serveur', error: error.message });
    }
};

/**
 * Crée un nouvel utilisateur.
 */
const createUser = async (request, reply) => {
    try {
        const { name, username, password, roleIds } = request.body;

        // Hachage du mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                name,
                username,
                password: hashedPassword,
                roles: {
                    connect: roleIds.map(id => ({ id: id })), // Assigne les rôles par leur ID
                },
            },
            include: { roles: true },
        });

        const { password: _, ...userWithoutPassword } = newUser;
        reply.code(201).send(userWithoutPassword);
    } catch (error) {
        if (error.code === 'P2002') { // Erreur de contrainte unique (ex: username déjà pris)
            reply.code(409).send({ message: 'Ce nom d\'utilisateur est déjà utilisé.' });
        } else {
            reply.code(500).send({ message: 'Erreur lors de la création de l\'utilisateur', error: error.message });
        }
    }
};

/**
 * Assigne ou met à jour les rôles d'un utilisateur.
 */
const assignRolesToUser = async (request, reply) => {
    try {
        const userId = parseInt(request.params.id, 10);
        const { roleIds } = request.body; // Un tableau d'IDs de rôles

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                roles: {
                    // `set` remplace toutes les relations existantes par les nouvelles
                    set: roleIds.map(id => ({ id: id })),
                },
            },
            include: { roles: true },
        });

        const { password, ...userWithoutPassword } = updatedUser;
        reply.send(userWithoutPassword);
    } catch (error) {
        reply.code(500).send({ message: 'Erreur lors de l\'assignation des rôles', error: error.message });
    }
};

/**
 * Met à jour le profil de l'utilisateur actuellement authentifié ET gère la levée de suspension.
 * SÉCURISÉ : Empêche la modification de discordId et characterId s'ils existent déjà.
 */
const updateMe = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const dataFromClient = request.body;

        // 1. Récupérer l'état actuel de l'utilisateur depuis la BDD
        const currentUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!currentUser) {
            return reply.code(404).send({ message: 'Utilisateur non trouvé.' });
        }

        const dataToUpdate = { ...dataFromClient };

        // 2. Logique de sécurité : on retire les champs critiques s'ils existent déjà
        if (currentUser.discordId) {
            delete dataToUpdate.discordId;
        }
        if (currentUser.characterId) {
            delete dataToUpdate.characterId;
        }

        // 3. Logique de levée de suspension (si les champs sont fournis pour la première fois)
        const finalDiscordId = dataToUpdate.discordId || currentUser.discordId;
        const finalCharacterId = dataToUpdate.characterId ? parseInt(dataToUpdate.characterId, 10) : currentUser.characterId;

        if (currentUser.status === 'SUSPENDED' && finalDiscordId && finalCharacterId) {
            dataToUpdate.status = 'ACTIVE';
        }

        // S'assure que characterId est bien un nombre
        if (dataToUpdate.characterId) {
            dataToUpdate.characterId = parseInt(dataToUpdate.characterId, 10);
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: dataToUpdate,
        });

        const { password, ...userWithoutPassword } = updatedUser;
        reply.send(userWithoutPassword);
    } catch (error) {
        reply.code(500).send({ message: 'Erreur lors de la mise à jour du profil', error: error.message });
    }
};

/**
 * Met à jour les préférences de l'utilisateur actuellement authentifié.
 */
const updateMyPreferences = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const preferences = request.body;

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                notificationPreferences: preferences,
            },
            // On sélectionne les champs à retourner pour éviter de renvoyer le mot de passe
            select: {
                id: true,
                name: true,
                username: true,
                notificationPreferences: true,
                // Incluez d'autres champs nécessaires pour votre AuthContext
            }
        });

        reply.send(updatedUser);
    } catch (error) {
        console.error("[UserController] Erreur dans updateMyPreferences:", error);
        reply.code(500).send({ message: "Erreur lors de la mise à jour des préférences." });
    }
};

/**
 * Récupère la date d'arrivée de l'utilisateur connecté dans une entreprise spécifique.
 * La date d'arrivée est définie par la date de sa première assignation de rang.
 */
const getMyStartDateInCompany = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const { companyId } = request.params;

        const employeeRecord = await prisma.companyEmployee.findUnique({
            where: {
                companyId_userId: {
                    companyId: parseInt(companyId, 10),
                    userId: userId
                }
            }
        });

        if (!employeeRecord) {
            return reply.code(404).send({ message: "Employé non trouvé dans cette entreprise." });
        }

        const firstRankRecord = await prisma.rankHistory.findFirst({
            where: { companyEmployeeId: employeeRecord.id },
            orderBy: { assignedAt: 'asc' },
        });

        if (!firstRankRecord) {
            // S'il n'y a pas d'historique, on peut prendre la date de création de l'enregistrement employé comme fallback
            return reply.send({ startDate: employeeRecord.createdAt });
        }

        reply.send({ startDate: firstRankRecord.assignedAt });

    } catch (error) {
        console.error("[UserController] Erreur dans getMyStartDateInCompany:", error);
        reply.code(500).send({ message: "Erreur lors de la récupération de la date d'arrivée." });
    }
};

/**
 * Gère la requête pour obtenir l'historique des rangs de l'utilisateur connecté.
 */
const getUserRankHistory = async (req, reply) => {
    try {
        // L'ID de l'utilisateur est extrait du token JWT par le middleware d'authentification
        // et est disponible dans req.user.id
        const userId = req.user.id;

        const history = await findUserRankHistory(userId);

        reply.code(200).send(history);
    } catch (error) {
        console.error("Erreur du contrôleur lors de la récupération de l'historique des rangs:", error);
        reply.code(500).send({ message: "Erreur interne du serveur." });
    }
};

module.exports = {
    getAllUsers,
    createUser,
    assignRolesToUser,
    updateMe,
    updateMyPreferences,
    getMyStartDateInCompany,
    getAssignableUsers,
    getUserRankHistory
};