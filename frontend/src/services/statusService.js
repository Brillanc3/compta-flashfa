// /frontend/src/services/statusService.js

import api from './api'; // On importe l'instance Axios pré-configurée

/**
 * Récupère le statut des modules depuis l'API publique.
 * @returns {Promise<Array<{name: string, status: string}>>}
 */
export const getSystemStatus = async () => {
    try {
        const { data } = await api.get('/status');
        return data;
    } catch (error) {
        console.error("Erreur lors de la récupération du statut du système:", error);
        // On relance l'erreur pour que le composant puisse la gérer
        throw error;
    }
};