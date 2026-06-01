// frontend/src/services/logService.js

import apiClient from './api';

/**
 * Récupère une liste paginée et filtrée de logs.
 * @param {object} params - Un objet de filtres (ex: { status: 'error', companyId: 1, page: 1 }).
 * @returns {Promise<object>} Un objet contenant la liste des logs et les informations de pagination.
 */
export const getLogs = async (params) => {
    try {
        const response = await apiClient.get('/logs', { params });
        return response.data;
    } catch (error) {
        throw error.response.data;
    }
};

/**
 * Demande au backend de relancer le traitement d'un log spécifique.
 * @param {number} logId - L'ID du log à relancer.
 * @returns {Promise<object>} L'objet du log mis à jour.
 */
export const reprocessLog = async (logId) => {
    try {
        const response = await apiClient.post(`/logs/${logId}/reprocess`);
        return response.data;
    } catch (error) {
        throw error.response.data;
    }
};