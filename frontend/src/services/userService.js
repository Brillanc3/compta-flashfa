// frontend/src/services/userService.js

import apiClient from './api';

// --- Fonctions existantes pour l'administration ---

/**
 * Récupère la liste des utilisateurs à qui un contrat peut être assigné.
 * @returns {Promise<Array>}
 */
export const getAssignableUsers = async () => {
    try {
        const { data } = await apiClient.get('/user/assignable');
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Récupère la liste de tous les utilisateurs.
 * @returns {Promise<Array>} La liste des utilisateurs.
 */
export const getUsers = async () => {
    try {
        const response = await apiClient.get('/users');
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Crée un nouvel utilisateur.
 * @param {object} userData - { name, username, password, roleIds }.
 * @returns {Promise<object>} L'objet de l'utilisateur créé.
 */
export const createUser = async (userData) => {
    try {
        const response = await apiClient.post('/users', userData);
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Assigne des rôles à un utilisateur spécifique.
 * @param {number} userId - L'ID de l'utilisateur.
 * @param {Array<number>} roleIds - Un tableau contenant les IDs des rôles à assigner.
 * @returns {Promise<object>} L'objet de l'utilisateur mis à jour.
 */
export const assignRolesToUser = async (userId, roleIds) => {
    try {
        const response = await apiClient.put(`/user/${userId}/roles`, { roleIds });
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Récupère la liste de tous les rôles disponibles.
 * Utile pour les formulaires d'administration.
 * @returns {Promise<Array>} La liste des rôles.
 */
export const getRoles = async () => {
    try {
        const response = await apiClient.get('/roles');
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

// --- Fonctions pour la page de profil utilisateur ---

/**
 * Récupère les données du profil de l'utilisateur actuellement connecté.
 * Fait appel à l'endpoint GET /me.
 * @returns {object} userData - Les données utilisateur
 */
export const getMe = async () => {
    try {
        const response = await apiClient.get('/me');
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Met à jour les données du profil de l'utilisateur connecté.
 * Fait appel à un endpoint PATCH /user/me.
 * @param {object} userData - Les données utilisateur à mettre à jour.
 */
export const updateMe = async (userData) => {
    try {
        const response = await apiClient.patch('/user/me', userData);
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Envoie un fichier image pour mettre à jour l'avatar de l'utilisateur.
 * @param {File} file - Le fichier image sélectionné par l'utilisateur.
 * @returns {Promise<object>} La réponse du serveur.
 */
export const uploadProfilePicture = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await apiClient.post('/images/user/profile-picture', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Met à jour les préférences de l'utilisateur connecté.
 * @param {object} preferences - Le nouvel objet de préférences.
 * @returns {Promise<Object>} L'objet utilisateur mis à jour.
 */
export const updateUserPreferences = async (preferences) => {
    try {
        const { data } = await apiClient.patch('/user/me/preferences', preferences);
        return data;
    } catch (error) {
        console.error('Erreur lors de la mise à jour des préférences:', error);
        throw error.response?.data || error;
    }
};

/**
 * Récupère la date d'arrivée de l'utilisateur connecté dans une entreprise.
 * @param {number} companyId - L'ID de l'entreprise.
 * @returns {Promise<string>} La date d'arrivée au format ISO string.
 */
export const getMyStartDate = async (companyId) => {
    try {
        const { data } = await apiClient.get(`/user/me/companies/${companyId}/start-date`);
        return data.startDate;
    } catch (error) {
        console.error("Erreur lors de la récupération de la date d'arrivée:", error);
        throw error.response?.data || error;
    }
};

/**
 * Récupère l'historique des 5 derniers rangs pour l'utilisateur connecté.
 * Fait appel à l'endpoint GET /user/me/rank-history.
 * @returns {Promise<Array>} La liste de l'historique des rangs.
 */
export const getUserRankHistory = async () => {
    try {
        const { data } = await apiClient.get('/user/me/rank-history');
        return data;
    } catch (error) {
        console.error("Erreur lors de la récupération de l'historique des rangs:", error);
        throw error.response?.data || error;
    }
};

/**
 * Récupère les préférences de l'utilisateur pour une page donnée.
 * @param {string} pageKey - La clé identifiant la page (ex: 'employees_view').
 * @returns {Promise<object>}
 */
export const getUserPreferences = async (pageKey) => {
    try {
        const { data } = await apiClient.get(`/user/preferences/${pageKey}`);
        return data;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return {};
        }
        throw error.response?.data || error;
    }
};

/**
 * Sauvegarde les préférences de l'utilisateur pour une page donnée.
 * @param {string} pageKey - La clé identifiant la page.
 * @param {object} preferences - L'objet de préférences à sauvegarder.
 * @returns {Promise<object>}
 */
export const saveUserPreferences = async (pageKey, preferences) => {
    try {
        const { data } = await apiClient.post(`/user/preferences/${pageKey}`, preferences);
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Récupère la signature électronique du profil connecté.
 * @returns {Promise<object>}
 */
export const getMyElectronicSignature = async () => {
    try {
        const { data } = await apiClient.get('/user/me/electronic-signature');
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Crée une nouvelle version de signature électronique pour l'utilisateur connecté.
 * @param {{ svg: string }} payload
 * @returns {Promise<object>}
 */
export const updateMyElectronicSignature = async (payload) => {
    try {
        const { data } = await apiClient.put('/user/me/electronic-signature', payload);
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

export async function changePassword(oldPassword, newPassword) {
    const response = await apiClient.post('/user/me/change-password', {
        oldPassword,
        newPassword,
    });
    return response.data;
}

/**
 * Récupère les factures de l'utilisateur connecté (toutes entreprises confondues)
 * @param {object} params - Paramètres de filtre (page, limit, companyId, status, billId, startDate, endDate, reason)
 * @returns {Promise<object>} La réponse contenant { data, pagination }
 */
export const getMyBills = async (params = {}) => {
    try {
        const { data } = await apiClient.get('/user/me/bills', { params });
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};
