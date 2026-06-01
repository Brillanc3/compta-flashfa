// frontend/src/services/analyticsService.js

import apiClient from './api';

/**
 * Récupère les données analytiques globales pour une entreprise.
 * @param {number} companyId - L'ID de l'entreprise.
 * @param {string} period - La période souhaitée (ex: 'week').
 * @returns {Promise<object>} Les données analytiques de l'entreprise.
 */
export const getCompanyAnalytics = async (companyId, period = 'week') => {
    try {
        const response = await apiClient.get(`/companies/analytics`, {
            params: { period }
        });
        return response.data;
    } catch (error) {
        throw error.response.data;
    }
};

/**
 * Récupère les données analytiques personnelles de l'utilisateur connecté.
 * @param {number} companyId - L'ID de l'entreprise.
 * @param {string} period - La période souhaitée (ex: 'week').
 * @returns {Promise<object>} Les KPIs personnels de l'utilisateur (CA généré, etc.).
 */
export const getUserAnalytics = async (companyId, period = 'week') => {
    try {
        const response = await apiClient.get(`/companies/analytics/me`, {
            params: { period }
        });
        return response.data;
    } catch (error) {
        throw error.response.data;
    }
};