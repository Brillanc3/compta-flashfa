// /frontend/src/services/clientsService.js

import apiClient from './api';

/* -----------------------------------------------------------
 *   CLIENTS
 * ----------------------------------------------------------- */

/**
 * Récupère une liste paginée de clients.
 */
export const listClients = async (companyId, params = {}) => {
    try {
        const { data } = await apiClient.get(`/clients`, { params });
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Récupère les détails d'un client.
 */
export const getClientDetails = async (companyId, clientId) => {
    try {
        const { data } = await apiClient.get(`/clients/${clientId}`);
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Met à jour un client.
 */
export const updateClient = async (companyId, clientId, clientData) => {
    try {
        const { data } = await apiClient.patch(`/clients/${clientId}`, clientData);
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/* -----------------------------------------------------------
 *   FIDÉLITÉ — TEMPLATES
 * ----------------------------------------------------------- */

/**
 * Récupère le template actif (ancienne API).
 */
export const getFidelityTemplate = async (_companyId) => {
    try {
        const { data } = await apiClient.get(`/clients/template`);
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Récupère *tous* les templates disponibles pour l’entreprise.
 */
export const getAllFidelityTemplates = async (_companyId) => {
    try {
        const { data } = await apiClient.get(`/clients/template-all`);
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Crée ou met à jour un template de fidélité.
 */
export const setupFidelityTemplate = async (companyId, formData) => {
    try {
        const { data } = await apiClient.post(`/clients/template/setup`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/* -----------------------------------------------------------
 *   FIDÉLITÉ — CARTES
 * ----------------------------------------------------------- */

/**
 * Crée une nouvelle carte pour un client en choisissant le modèle.
 */
export const createCardForClient = async (companyId, clientId, templateId) => {
    try {
        const { data } = await apiClient.post(
            `/clients/${clientId}/card/create`,
            { templateId }
        );
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Ajoute un tampon à une carte par son publicLink.
 * Retourne : { isFull, stampCount, maxStamps, status }
 */
export const addStampToCard = async (companyId, publicLink) => {
    try {
        const { data } = await apiClient.post(
            `/clients/card/${publicLink}/add-stamp`
        );
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Change le statut d'une carte (ACTIVE / DISABLED / COMPLETED).
 */
export const updateFidelityCardStatus = async (companyId, cardId, newStatus, comment = "") => {
    try {
        const { data } = await apiClient.patch(`/clients/card/${cardId}/status`, { newStatus, comment });
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Ajuste le nombre de tampons d'une carte.
 */
export const setFidelityCardStampCount = async (companyId, cardId, newStampCount, comment) => {
    try {
        const { data } = await apiClient.post(`/clients/card/${cardId}/set-stamps`, {
            newStampCount,
            comment,
        });
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};
/**
 * Supprime une carte de fidélité.
 */
export const deleteFidelityCard = async (companyId, cardId) => {
    try {
        const { data } = await apiClient.delete(`/clients/card/${cardId}`);
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};
/**
 * Active ou désactive un modèle de carte de fidélité.
 */
export const toggleFidelityTemplateActive = async (companyId, templateId, isActive) => {
    try {
        const { data } = await apiClient.patch(`/clients/template/${templateId}/active`, { isActive });
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Récupère le dernier historique d'une carte.
 */
export const getCardLastHistory = async (companyId, cardId) => {
    try {
        const { data } = await apiClient.get(`/clients/card/${cardId}/history/last`);
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Renouvelle une carte (remise à 0).
 */
export const renewFidelityCard = async (companyId, cardId) => {
    try {
        const { data } = await apiClient.patch(`/clients/card/${cardId}/renew`);
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/* -----------------------------------------------------------
 *   VARIABLES CLIENTS
 * ----------------------------------------------------------- */

/**
 * Liste toutes les variables d'affichage de la company.
 */
export const listClientVariables = async () => {
    try {
        const { data } = await apiClient.get('/clients/variables');
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Crée une nouvelle variable.
 */
export const createClientVariable = async (payload) => {
    try {
        const { data } = await apiClient.post('/clients/variables', payload);
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Met à jour la configuration d'une variable.
 */
export const updateClientVariable = async (variableId, payload) => {
    try {
        const { data } = await apiClient.patch(`/clients/variables/${variableId}`, payload);
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Upload une icône pour une variable existante.
 */
export const uploadClientVariableIcon = async (variableId, file) => {
    try {
        const formData = new FormData();
        formData.append('file', file);
        
        const { data } = await apiClient.post(`/clients/variables/${variableId}/icon`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Supprime une variable.
 */
export const deleteClientVariable = async (variableId) => {
    try {
        const { data } = await apiClient.delete(`/clients/variables/${variableId}`);
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Met à jour l'ACL (qui peut modifier) d'une variable.
 */
export const updateClientVariableAccess = async (variableId, { userIds, rankIds }) => {
    try {
        const { data } = await apiClient.patch(`/clients/variables/${variableId}/access`, { userIds, rankIds });
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Récupère les valeurs de toutes les variables pour un client.
 */
export const getClientVariableValues = async (clientId) => {
    try {
        const { data } = await apiClient.get(`/clients/${clientId}/variables`);
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Modifie la valeur d'une variable pour un client.
 */
export const setClientVariableValue = async (clientId, variableId, value) => {
    try {
        const { data } = await apiClient.patch(`/clients/${clientId}/variables/${variableId}`, { value });
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Récupère les rangs de la company pour configurer l'ACL des variables.
 */
export const getVariableRanks = async () => {
    try {
        const { data } = await apiClient.get('/clients/variables/ranks');
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Récupère les avantages (perks) du user connecté (cross-company).
 */
export const getMyPerks = async () => {
    try {
        const { data } = await apiClient.get('/clients/me/perks');
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

/**
 * Récupère le catalogue complet des avantages (cross-company).
 */
export const getPerksCatalog = async () => {
    try {
        const { data } = await apiClient.get('/clients/perks-catalog');
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

