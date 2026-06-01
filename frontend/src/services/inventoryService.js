// frontend/src/services/inventoryService.js

import apiClient from './api';

/**
 * Récupère les mouvements d'inventaire selon les filtres.
 *
 * @param {number} companyId
 * @param {object} params - filtres et pagination
 * @returns {Promise<object>}
 */
export const getInventory = async (companyId, params = {}) => {
    try {
        const response = await apiClient.get(`/inventory`, {
            params
        });

        return response.data;
    } catch (error) {
        // Gestion standardisée comme analyticsService
        throw error.response?.data || error;
    }
};
