// /frontend/src/services/calendarService.js
import apiClient from './api';

// --- API pour les Événements ---

// CORRECTION: Utilise une seule route /calendar/events et passe companyId en query param
export const getEvents = (companyId, params) => {
    // companyId peut être null
    const queryParams = { ...params };
    if (companyId) {
        queryParams.companyId = companyId;
    }
    // L'appel se fait toujours vers /calendar/events
    return apiClient.get(`/calendar/events`, { params: queryParams });
};

// companyId est maintenant dans data
export const createEvent = (data) => {
    return apiClient.post(`/calendar/events`, data);
};

// eventId suffit
export const updateEvent = (eventId, data) => {
    return apiClient.put(`/calendar/events/${eventId}`, data);
};

export const finishEvent = (eventId) => {
    return apiClient.put(`/calendar/events/${eventId}/finish`);
};

export const deleteEvent = (eventId) => {
    return apiClient.delete(`/calendar/events/${eventId}`);
};

// --- API pour les Catégories ---

// Les catégories nécessitent toujours companyId dans l'URL
export const getCategories = (companyId) => {
    if (!companyId) return Promise.resolve({ data: [] });
    return apiClient.get(`/calendar/categories`);
};
export const createCategory = (companyId, data) => {
    return apiClient.post(`/calendar/categories`, data);
};
export const updateCategory = (companyId, categoryId, data) => {
    return apiClient.put(`/calendar/categories/${categoryId}`, data);
};
export const deleteCategory = (companyId, categoryId) => {
    return apiClient.delete(`/calendar/categories/${categoryId}`);
};