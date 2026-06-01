// frontend/src/services/billService.js

import apiClient from './api';

/**
 * Récupère une liste paginée et filtrée de factures pour une entreprise.
 * @param {number} companyId - L'ID de l'entreprise.
 * @param {object} filters - Un objet contenant les filtres, la pagination et la configuration du widget.
 * @returns {Promise<object>} Un objet contenant les données et la pagination.
 */
export const getBills = async (companyId, filters = {}) => {
    try {
        const { config, ...otherFilters } = filters;
        const paramsToSend = { ...otherFilters };
        if (config) {
            paramsToSend.config = JSON.stringify(config);
        }

        const response = await apiClient.get(`/comptabilite/bills`, {
            params: paramsToSend,
        });
        return response.data;
    } catch (error) {
        throw error.response.data;
    }
};

export const updateBillShares = async (billId, shares) => {
    const { data } = await apiClient.patch(`/comptabilite/bills/${billId}/shares`, { shares });
    return data;
};

/**
 * Récupère les détails d'une facture spécifique.
 * @param {number} companyId - L'ID de l'entreprise à laquelle la facture appartient.
 * @param {number} billId - L'ID de la facture.
 * @returns {Promise<Object>}
 */
export const getBillDetails = async (companyId, billId) => {
    try {
        const { data } = await apiClient.get(`/comptabilite/bills/${billId}`);
        return data;
    } catch (error) {
        console.error(`Erreur lors de la récupération de la facture ${billId}:`, error);
        throw error;
    }
};