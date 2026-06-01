// frontend/src/services/adminCompanyService.js
import apiClient from './api';

/**
 * Récupère la liste de toutes les entreprises.
 */
export const getAdminCompanies = async () => {
    try {
        const { data } = await apiClient.get('/admin/companies');
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Récupère les détails d'une entreprise spécifique.
 * @param {number} companyId
 */
export const getAdminCompanyDetails = async (companyId) => {
    try {
        const { data } = await apiClient.get(`/admin/companies/${companyId}`);
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Met à jour une entreprise.
 * @param {number} companyId
 * @param {object} companyData - { name, accountingPrice, moduleIds }
 */
export const updateAdminCompany = async (companyId, companyData) => {
    try {
        const { data } = await apiClient.put(`/admin/companies/${companyId}`, companyData);
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Ajoute un contact facturable à une entreprise.
 * @param {number} companyId
 * @param {number} userId
 */
export const addBillableContact = async (companyId, userId) => {
    try {
        const { data } = await apiClient.post(`/admin/companies/${companyId}/billable-contacts`, { userId });
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Supprime un contact facturable d'une entreprise.
 * @param {number} companyId
 * @param {number} userId
 */
export const removeBillableContact = async (companyId, userId) => {
    try {
        const { data } = await apiClient.delete(`/admin/companies/${companyId}/billable-contacts/${userId}`);
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Crée une nouvelle entreprise.
 * @param {object} companyData - { name }
 */
export const createAdminCompany = async (companyData) => {
    try {
        const { data } = await apiClient.post('/admin/companies', companyData);
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

export const regenerateAdminCompanyKey = async (companyId, keyType) => {
    try {
        const { data } = await apiClient.post(`/admin/companies/${companyId}/regenerate-key`, { keyType });
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Ajoute un utilisateur comme gérant principal.
 * @param {number} companyId
 * @param {number} userId
 */
export const addCompanyManager = async (companyId, userId) => {
    try {
        const { data } = await apiClient.post(`/admin/companies/${companyId}/managers`, { userId });
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Retire un utilisateur du rôle de gérant principal.
 * @param {number} companyId
 * @param {number} userId
 */
export const removeCompanyManager = async (companyId, userId) => {
    try {
        const { data } = await apiClient.delete(`/admin/companies/${companyId}/managers/${userId}`);
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

// --- NOUVELLE FONCTION ---
/**
 * Récupère la liste de tous les utilisateurs.
 */
export const getAllUsers = async () => {
    try {
        const { data } = await apiClient.get('/admin/users');
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
}