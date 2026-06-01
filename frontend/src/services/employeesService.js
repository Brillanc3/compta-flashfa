// /frontend/src/services/employeesService.js

import apiClient from './api';

// --- Fonctions pour la Gestion des Rangs ---

export const getRanks = async (companyId) => {
    try {
        const headers = companyId ? { 'x-company-id': String(companyId) } : {};
        const { data } = await apiClient.get(`/employees/ranks`, { headers });
        return data;
    } catch (error) { throw error.response?.data || error; }
};

/**
 * Crée un nouveau rang en utilisant la configuration de rémunération flexible.
 */
export const createRank = async (companyId, rankData) => {
    try {
        const response = await apiClient.post(`/employees/ranks`, rankData);
        return response.data;
    } catch (error) {
        throw error.response.data;
    }
};

/**
 * Met à jour un rang en utilisant la configuration de rémunération flexible.
 */
export const updateRank = async (companyId, rankId, rankData) => {
    try {
        const response = await apiClient.patch(`/employees/rank/${rankId}`, rankData);
        return response.data;
    } catch (error) {
        throw error.response.data;
    }
};

export const deleteRank = async (companyId, rankId) => {
    try {
        await apiClient.delete(`/employees/rank/${rankId}`);
    } catch (error) { throw error.response?.data || error; }
};

export const updateRankOrder = async (companyId, rankIds) => {
    try {
        const { data } = await apiClient.patch(`/employees/ranks/order`, rankIds);
        return data;
    } catch (error) { throw error.response?.data || error; }
};

/**
 * Récupère la liste de tous les modèles de permission disponibles.
 * @returns {Promise<Array>}
 */
export const getAvailablePermissionTemplates = async (_companyId) => {
    try {
        const { data } = await apiClient.get(`/employees/available-permissions`);
        return data;
    } catch (error) { throw error.response?.data || error; }
};

/**
 * Récupère le schéma de rémunération dynamique pour une entreprise.
 */
export const getRemunerationSchemaForCompany = async (_companyId) => {
    try {
        const response = await apiClient.get(`/employees/remuneration-schema`);
        return response.data;
    } catch (error) { throw error.response?.data || error; }
};

/**
 * Récupère la liste des employés d'une entreprise.
 */
export const getCompanyEmployees = async (companyId, options = {}) => {
    try {
        const headers = companyId ? { 'x-company-id': String(companyId) } : {};
        const { data } = await apiClient.get(`/employees`, {
            params: {
                fields: options.fields,
                year: options.year,
                week: options.week
            },
            headers
        });
        return data;
    } catch (error) { throw error.response?.data || error; }
};

/**
 * Récupère les détails complets d'un employé, y compris son historique de rangs.
 */
export const getEmployeeDetails = async (companyId, employeeId, page = 1) => {
    try {
        const { data } = await apiClient.get(`/employees/employee/${employeeId}`, {
            params: { page } // Pour la pagination de l'historique
        });
        return data;
    } catch (error) { throw error.response?.data || error; }
};

/**
 * Récupère le détail du calcul de salaire pour un employé sur une période donnée.
 */
export const getEmployeeSalary = async (companyId, employeeId, dateRange) => {
    try {
        const { data } = await apiClient.get(`/employees/employee/${employeeId}/salary-breakdown`, {
            params: {
                from: dateRange.from, // ex: '2025-10-13T00:00:00.000Z'
                to: dateRange.to,
            }
        });
        return data;
    } catch (error) { throw error.response?.data || error; }
};

/**
 * Met à jour le rang d'un employé.
 */
export const changeEmployeeRank = async (companyId, employeeId, newRankId) => {
    try {
        const { data } = await apiClient.patch(`/employees/employee/${employeeId}/rank`, { newRankId });
        return data;
    } catch (error) { throw error.response?.data || error; }
};

export const changeEmployeeStatus = async (companyId, employeeId, newStatus) => {
    try {
        const { data } = await apiClient.patch(`/employees/employee/${employeeId}/status`, { status: newStatus });
        return data;
    } catch (error) { throw error.response?.data || error; }
};

/**
 * Récupère toutes les colonnes possibles pour la liste des employés d'une entreprise.
 */
export const getAvailableColumns = async (_companyId) => {
    try {
        const { data } = await apiClient.get(`/employees/available-columns`);
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Récupère les paramètres dynamiques pour le formulaire de rang.
 */
export const getRankFormSettings = async (companyId, rankNameToEdit) => {
    try {
        const { data } = await apiClient.get(`/employees/rank-form-settings`, {
            params: { rankName: rankNameToEdit } // On envoie le nom du rang pour les règles spécifiques
        });
        return data;
    } catch (error) { throw error.response?.data || error; }
};

export const getUserForChat = async () => {
    try {
        const { data } = await apiClient.get('/employees/users-for-chat');
        return data;
    } catch (e) { throw e.response?.data || e; }
}

/**
 * ======================= RESET ACCOUNT ============================
 *
 * Appelle le backend pour générer ou récupérer un token temporaire.
 *
 * Retourne par exemple :
 * {
 *   success: true,
 *   data: {
 *      alreadyActive: false,
 *      userId: 12,
 *      username: "john",
 *      tempPasswordToken: "482193",
 *      tempPasswordExpiresAt: "2025-01-20T..."
 *   }
 * }
 */
export async function resetEmployeeAccount(companyId, employeeId) {
    try {
        const { data } = await apiClient.post(`/employees/employee/${employeeId}/reset-account`);
        return data;
    } catch (error) {
        throw error?.response?.data || error;
    }
}

/**
 * Dirigeant : génère ou régénère un code de liaison pour un employé PENDING_LINK.
 */
export async function generateLinkCode(companyId, employeeId) {
    try {
        const { data } = await apiClient.post(`/employees/employee/${employeeId}/link-code`);
        return data;
    } catch (error) {
        throw error?.response?.data || error;
    }
}

/**
 * Définit ou supprime un override de salaire pour un employé sur une semaine ISO.
 * amount=null pour supprimer l'override.
 */
export async function setEmployeeSalaryOverride(companyId, employeeId, { year, week, amount }) {
    try {
        const { data } = await apiClient.patch(`/employees/employee/${employeeId}/salary-override`, { year, week, amount });
        return data;
    } catch (error) {
        throw error?.response?.data || error;
    }
}

/**
 * Employé : consomme un code de liaison pour fusionner son compte avec le profil temp.
 */
export async function useLinkCode(code) {
    try {
        const { data } = await apiClient.post(`/employees/use-link-code`, { code });
        return data;
    } catch (error) {
        throw error?.response?.data || error;
    }
}