// frontend/src/services/rankService.js

import apiClient from './api';

/**
 * Récupère tous les rangs pour une entreprise donnée.
 * @param {number} companyId - L'ID de l'entreprise.
 */
export const getCompanyRanks = async (_companyId) => {
    try {
        const response = await apiClient.get(`/companies/ranks`);
        return response.data;
    } catch (error) {
        throw error.response.data;
    }
};

/**
 * Crée un nouveau rang pour une entreprise.
 * @param {number} companyId - L'ID de l'entreprise.
 * @param {object} rankData - { name, position, commissionRate, permissionTemplateIds }.
 */
export const createRank = async (companyId, rankData) => {
    try {
        const response = await apiClient.post(`/companies/ranks`, rankData);
        return response.data;
    } catch (error) {
        throw error.response.data;
    }
};

/**
 * Met à jour un rang spécifique.
 * @param {number} companyId - L'ID de l'entreprise.
 * @param {number} rankId - L'ID du rang à modifier.
 * @param {object} rankData - Les données du rang à mettre à jour.
 */
export const updateRank = async (companyId, rankId, rankData) => {
    try {
        const response = await apiClient.put(`/companies/ranks/${rankId}`, rankData);
        return response.data;
    } catch (error) {
        throw error.response.data;
    }
};

/**
 * Supprime un rang.
 * @param {number} companyId - L'ID de l'entreprise.
 * @param {number} rankId - L'ID du rang à supprimer.
 */
export const deleteRank = async (companyId, rankId) => {
    try {
        const response = await apiClient.delete(`/companies/ranks/${rankId}`);
        return response.data;
    } catch (error) {
        throw error.response.data;
    }
};