// frontend/src/services/partnershipService.js
// Service API complet du module Partenariat
// Utilise apiClient (Axios + headers automatiques)

import apiClient from './api';

/* ============================================================================
   🧩 PARTENAIRES
============================================================================ */

export async function getPartners({ includeInactive = false } = {}) {
    const response = await apiClient.get('/partenariat', {
        params: { includeInactive },
    });
    return response.data;
}

export async function getPartner(partnerId) {
    const response = await apiClient.get(`/partenariat/${partnerId}`);
    return response.data;
}

export async function createPartner(data) {
    const response = await apiClient.post('/partenariat', data);
    return response.data;
}

export async function updatePartner(partnerId, data) {
    const response = await apiClient.put(`/partenariat/${partnerId}`, data);
    return response.data;
}

export async function deactivatePartner(partnerId) {
    const response = await apiClient.post(`/partenariat/${partnerId}/deactivate`);
    return response.data;
}

export async function activatePartner(partnerId) {
    const response = await apiClient.post(`/partenariat/${partnerId}/activate`);
    return response.data;
}

/* ============================================================================
   🧩 SERVICES PAR PARTENAIRE
============================================================================ */

export async function getPartnerServices(partnerId, { includeInactive = false } = {}) {
    const response = await apiClient.get(`/partenariat/${partnerId}/services`, {
        params: { includeInactive },
    });
    return response.data;
}

export async function createPartnerService(partnerId, data) {
    const response = await apiClient.post(`/partenariat/${partnerId}/services`, data);
    return response.data;
}

export async function updatePartnerService(partnerId, serviceTypeId, data) {
    const response = await apiClient.put(
        `/partenariat/${partnerId}/services/${serviceTypeId}`,
        data
    );
    return response.data;
}

export async function deactivatePartnerService(partnerId, serviceTypeId) {
    const response = await apiClient.post(
        `/partenariat/${partnerId}/services/${serviceTypeId}/deactivate`
    );
    return response.data;
}

/* ============================================================================
   🧾 SERVICES RENDUS (prestations)
============================================================================ */

export async function getRenderedServices({
                                              partnerId,
                                              employeeId,
                                              from,
                                              to
                                          } = {}) {
    const response = await apiClient.get('/partenariat/services-rendered', {
        params: {
            partnerId,
            employeeId,
            from,
            to
        }
    });
    return response.data;
}

export async function getFullRenderedServices({
                                              partnerId,
                                              employeeId,
                                              from,
                                              to
                                          } = {}) {
    const response = await apiClient.get('/partenariat/full-services-rendered', {
        params: {
            partnerId,
            employeeId,
            from,
            to
        }
    });
    return response.data;
}

export async function createServiceRendered(data) {
    const response = await apiClient.post('/partenariat/services-rendered', data);
    return response.data;
}

export async function updateServiceRendered(serviceRenderedId, data) {
    const response = await apiClient.put(
        `/partenariat/services-rendered/${serviceRenderedId}`,
        data
    );
    return response.data;
}

/* ============================================================================
   🧮 RÉCAPITULATIF (weekly summary)
============================================================================ */

export async function getWeeklySummary({
                                           partnerId,
                                           from,
                                           to,
                                           includeEmployees = false
                                       } = {}) {
    const response = await apiClient.get('/partenariat/summary/weekly', {
        params: {
            partnerId,
            from,
            to,
            includeEmployees
        }
    });
    return response.data;
}

