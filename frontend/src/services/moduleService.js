// frontend/src/services/moduleService.js
import apiClient from './api';

/**
 * Récupère la liste de tous les modules disponibles.
 * @returns {Promise<Array>}
 */
export const getModules = async () => {
    try {
        const { data } = await apiClient.get('/modules');
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};