// /backend/src/modules/user/user.controller.js

const service = require('./user.service');

const getPreferences = async (request, reply) => {
    try {
        const { pageKey } = request.params;
        const preferences = await service.getPreferences(request.user.userId, pageKey);
        reply.send(preferences || {}); // Renvoyer un objet vide si null
    } catch (error) {
        reply.code(500).send({ message: "Erreur lors de la récupération des préférences." });
    }
};

const getRankHistory = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const history = await service.getRankHistory(userId);
        reply.send(history);
    } catch (error) {
        console.error('[UserController] getRankHistory:', error);
        reply.code(400).send({ message: error.message || 'Erreur lors de la récupération de l’historique de rang.' });
    }
};

/**
 * PATCH /users/me
 * Met à jour le profil de l'utilisateur connecté
 */
const updateSelf = async (request, reply) => {
    try {
        const userId = request.user.userId; // récupéré depuis le token JWT
        const updated = await service.updateUserProfile(userId, request.body);
        reply.send(updated);
    } catch (error) {
        console.error('[UserController] updateSelf:', error);
        reply.code(400).send({ message: error.message || "Erreur lors de la mise à jour du profil." });
    }
};

const savePreferences = async (request, reply) => {
    try {
        const { pageKey } = request.params;
        const newPreferences = await service.savePreferences(request.user.userId, pageKey, request.body);
        reply.send(newPreferences);
    } catch (error) {
        reply.code(500).send({ message: "Erreur lors de la sauvegarde des préférences." });
    }
};

const changePassword = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const { oldPassword, newPassword } = request.body;

        await service.changePassword(userId, oldPassword, newPassword);
        reply.send({ message: 'Mot de passe mis à jour avec succès.' });
    } catch (error) {
        console.error('[UserController] changePassword:', error);
        reply.code(error.statusCode || 400).send({ message: error.message || 'Erreur lors du changement de mot de passe.' });
    }
};

const getMyElectronicSignature = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const payload = await service.getElectronicSignatureProfile(userId);
        reply.send(payload);
    } catch (error) {
        console.error('[UserController] getMyElectronicSignature:', error);
        reply.code(error.statusCode || 400).send({
            message: error.message || 'Erreur lors de la récupération de la signature électronique.',
            ...(error.details ? { details: error.details } : {}),
        });
    }
};

const updateMyElectronicSignature = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const payload = await service.updateElectronicSignature(userId, request.body || {});
        reply.send(payload);
    } catch (error) {
        console.error('[UserController] updateMyElectronicSignature:', error);
        reply.code(error.statusCode || 400).send({
            message: error.message || 'Erreur lors de la mise à jour de la signature électronique.',
            ...(error.details ? { details: error.details } : {}),
        });
    }
};

module.exports = {
    getPreferences,
    savePreferences,
    updateSelf,
    getRankHistory,
    changePassword,
    getMyElectronicSignature,
    updateMyElectronicSignature,
};
