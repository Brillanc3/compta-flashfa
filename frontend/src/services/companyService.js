// frontend/src/services/companyService.js

import apiClient from './api';

/**
 * Récupère les paramètres de l'entreprise (nom, clés API et Onboarding).
 * @param {number} companyId
 */
export const getCompanySettings = async (_companyId) => {
    try {
        const response = await apiClient.get(`/comptabilite/settings`);
        return response.data;
    } catch (error) {
        throw error.response.data;
    }
};

/**
 * Met à jour le nom de l'entreprise.
 */
export const updateCompanyName = async (_companyId, name) => {
    try {
        const response = await apiClient.patch(`/comptabilite/settings/update-name`, { name });
        return response.data;
    } catch (error) {
        throw error.response.data;
    }
};

export async function updateCompanySettingsJson(settings) {
    const res = await apiClient.patch('/comptabilite/settings/update-settings', { settings });
    return res.data;
}

/**
 * Régénère la clé API.
 */
export const regenerateApiKey = async (_companyId) => {
    try {
        const response = await apiClient.post(`/comptabilite/settings/regenerate-api-key`);
        return response.data;
    } catch (error) {
        throw error.response.data;
    }
};

/**
 * Régénère la clé d’onboarding.
 */
export const regenerateOnboardingKey = async (_companyId) => {
    try {
        const response = await apiClient.post(`/comptabilite/settings/regenerate-onboarding-key`);
        return response.data;
    } catch (error) {
        throw error.response.data;
    }
};

export const getOnboardingCodes = async (_companyId) => {
    try {
        const response = await apiClient.get(`/comptabilite/onboarding-codes`);
        return response.data;
    } catch (error) {
        throw error.response.data;
    }
};

export const createOnboardingCode = async (_companyId, codeData) => {
    try {
        const response = await apiClient.post(`/comptabilite/onboarding-codes`, codeData);
        return response.data;
    } catch (error) {
        throw error.response.data;
    }
};

export const deleteOnboardingCode = async (_companyId, codeId) => {
    try {
        const response = await apiClient.delete(`/comptabilite/onboarding-codes/${codeId}`);
        return response.data;
    } catch (error) {
        throw error.response.data;
    }
};

export const getCompanyEmployees = async (_companyId) => {
    try {
        const response = await apiClient.get(`/comptabilite/employees`);
        return response.data;
    } catch (error) {
        throw error.response.data;
    }
};

export const getUsersAndRanksForChat = async () => {
    try {
        const res = await apiClient.get(`/employees/users-for-chat`);
        const data = res?.data || {};
        return data;
    } catch (error) {
        throw error.response.data;
    }
}

/**
 * Récupère les CompanyEmployee "présents" selon paramètres backend.
 * Endpoint: GET /employees/data
 *
 * params possibles:
 * - activeAt: ISO string (date facture)
 * - includeInactive: true/false
 * - search: string
 * - statuses: "ACTIVE,PENDING_LINK" (ou array selon ton apiClient)
 * - rankIds: "1,2,3"
 */
export async function getCompanyEmployeesData(params = {}) {
    const { data } = await apiClient.get("/employees/data", { params });
    return data;
}