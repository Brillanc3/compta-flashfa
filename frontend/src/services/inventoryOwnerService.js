// /frontend/src/services/inventoryOwnerService.js

import apiClient from './api';

/**
 * Service pour la gestion des noms personnalisés d'emplacements d'inventaire.
 */
export const getInventoryOwners = async () => {
    const response = await apiClient.get('/inventory/owners');
    return response.data.inventories;
};

export const upsertInventoryOwner = async (data) => {
    // data: { owner: string, name: string }
    const response = await apiClient.post('/inventory/owners', data);
    return response.data;
};

export const deleteInventoryOwner = async (id) => {
    const response = await apiClient.delete(`/inventory/owners/${id}`);
    return response.data;
};
