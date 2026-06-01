// frontend/src/services/pawnshopService.js

import apiClient from "./api";

// Purchases
export async function listPurchases(params = {}) {
    const { data } = await apiClient.get(`/pawnshop/purchases`, { params });
    return data;
}

export async function createPurchase(payload) {
    const { data } = await apiClient.post(`/pawnshop/purchases`, payload);
    return data;
}

export async function getPurchase(id) {
    const { data } = await apiClient.get(`/pawnshop/purchases/${id}`);
    return data;
}

export async function updatePurchase(id, patch) {
    const { data } = await apiClient.patch(`/pawnshop/purchases/${id}`, patch);
    return data;
}

export async function deletePurchase(id) {
    const { data } = await apiClient.delete(`/pawnshop/purchases/${id}`);
    return data;
}

// Items
export async function addPurchaseItem(purchaseId, payload) {
    const { data } = await apiClient.post(`/pawnshop/purchases/${purchaseId}/items`, payload);
    return data;
}

export async function updatePurchaseItem(purchaseId, itemId, patch) {
    const { data } = await apiClient.patch(`/pawnshop/purchases/${purchaseId}/items/${itemId}`, patch);
    return data;
}

export async function deletePurchaseItem(purchaseId, itemId) {
    const { data } = await apiClient.delete(`/pawnshop/purchases/${purchaseId}/items/${itemId}`);
    return data;
}

export async function validatePurchase(id) {
    const { data } = await apiClient.post(`/pawnshop/purchases/${id}/validate`, {});
    return data;
}

export async function cancelPurchase(id, payload = {}) {
    const { data } = await apiClient.post(`/pawnshop/purchases/${id}/cancel`, payload);
    return data;
}

export async function markPurchasePaid(id) {
    const { data } = await apiClient.post(`/pawnshop/purchases/${id}/mark-paid`, {});
    return data;
}

export async function changePurchaseOwner(id, employeeId) {
    const { data } = await apiClient.post(`/pawnshop/purchases/${id}/change-owner`, { employeeId });
    return data;
}

export async function deleteCanceledPurchase(id) {
    const { data } = await apiClient.delete(`/pawnshop/purchases/${id}/canceled`);
    return data;
}

export async function getPurchaseStatsByEmployee(params = {}) {
    const { data } = await apiClient.get(`/pawnshop/purchases/stats/by-employee`, { params });
    return data;
}

// Products
export async function listProducts(params = {}) {
    const { data } = await apiClient.get(`/pawnshop/products`, { params });
    return data;
}

export async function createProduct(payload) {
    const { data } = await apiClient.post(`/pawnshop/products`, payload);
    return data;
}

export async function updateProduct(id, patch) {
    const { data } = await apiClient.patch(`/pawnshop/products/${id}`, patch);
    return data;
}

export async function deleteProduct(id) {
    const { data } = await apiClient.delete(`/pawnshop/products/${id}`);
    return data;
}

// Partners
export async function listPartners(params = {}) {
    const { data } = await apiClient.get(`/pawnshop/partners`, { params });
    return data;
}

export async function createPartner(payload) {
    const { data } = await apiClient.post(`/pawnshop/partners`, payload);
    return data;
}

export async function updatePartner(id, patch) {
    const { data } = await apiClient.patch(`/pawnshop/partners/${id}`, patch);
    return data;
}

export async function deletePartner(id) {
    const { data } = await apiClient.delete(`/pawnshop/partners/${id}`);
    return data;
}

// Partner buy prices
export async function getPartnerPrices(partnerId) {
    const { data } = await apiClient.get(`/pawnshop/partners/${partnerId}/prices`);
    return data;
}

export async function putPartnerPrices(partnerId, items) {
    const { data } = await apiClient.put(`/pawnshop/partners/${partnerId}/prices`, { items });
    return data;
}

// Purchase catalog
export async function listPurchaseCatalog(params = {}) {
    const { data } = await apiClient.get(`/pawnshop/products/purchase-catalog`, { params });
    return data;
}

// Pawnshop clients
export async function listPawnshopClients(params = {}) {
    const { data } = await apiClient.get(`/pawnshop/clients`, { params });
    return data;
}

export async function getPawnshopClient(id) {
    const { data } = await apiClient.get(`/pawnshop/clients/${id}`);
    return data;
}

export async function createPawnshopClient(payload) {
    const { data } = await apiClient.post(`/pawnshop/clients`, payload);
    return data;
}

export async function updatePawnshopClient(id, patch) {
    const { data } = await apiClient.patch(`/pawnshop/clients/${id}`, patch);
    return data;
}

export async function uploadClientCni(clientId, file) {
    const form = new FormData();
    form.append("file", file);
    const { data } = await apiClient.post(`/pawnshop/clients/${clientId}/cni`, form, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
}

export async function deleteClientCni(clientId) {
    const { data } = await apiClient.delete(`/pawnshop/clients/${clientId}/cni`);
    return data;
}

export function getClientCniUrl(publicId) {
    return `/api/images/${publicId}`;
}

// Estimations
export async function listEstimations(params = {}) {
    const { data } = await apiClient.get(`/pawnshop/estimations`, { params });
    return data;
}

export async function createEstimation(payload) {
    const { data } = await apiClient.post(`/pawnshop/estimations`, payload);
    return data;
}

export async function getEstimation(id) {
    const { data } = await apiClient.get(`/pawnshop/estimations/${id}`);
    return data;
}

export async function updateEstimation(id, patch) {
    const { data } = await apiClient.patch(`/pawnshop/estimations/${id}`, patch);
    return data;
}

export async function addEstimationItem(estimationId, payload) {
    const { data } = await apiClient.post(`/pawnshop/estimations/${estimationId}/items`, payload);
    return data;
}

export async function deleteEstimationItem(estimationId, itemId) {
    const { data } = await apiClient.delete(`/pawnshop/estimations/${estimationId}/items/${itemId}`);
    return data;
}

export async function rejectEstimation(id) {
    const { data } = await apiClient.post(`/pawnshop/estimations/${id}/reject`, {});
    return data;
}

export async function convertEstimation(id) {
    const { data } = await apiClient.post(`/pawnshop/estimations/${id}/convert`, {});
    return data;
}

export async function getPublicPageConfig() {
    const { data } = await apiClient.get("/pawnshop/public-page");
    return data;
}

export async function updatePublicPageConfig(payload) {
    const { data } = await apiClient.put("/pawnshop/public-page", payload);
    return data;
}
