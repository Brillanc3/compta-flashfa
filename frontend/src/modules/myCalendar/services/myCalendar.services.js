// /frontend/src/modules/myCalendar/services/myCalendar.services.js
import api from '@/services/api';

const API_URL = '/mycalendar';

export const myCalendarService = {
    async getEvents(companyId = null) {
        const headers = companyId ? { 'x-company-id': companyId } : {};
        const response = await api.get(`${API_URL}/events`, { headers });
        return response.data;
    },

    async getInvitations() {
        const response = await api.get(`${API_URL}/invitations`);
        return response.data;
    },

    async createEvent(data, companyId = null) {
        const headers = companyId ? { 'x-company-id': companyId } : {};
        const response = await api.post(`${API_URL}/events`, data, { headers });
        return response.data;
    },

    async updateEvent(id, data, companyId = null) {
        const headers = companyId ? { 'x-company-id': companyId } : {};
        const response = await api.put(`${API_URL}/events/${id}`, data, { headers });
        return response.data;
    },

    async deleteEvent(id, companyId = null) {
        const headers = companyId ? { 'x-company-id': companyId } : {};
        const response = await api.delete(`${API_URL}/events/${id}`, { headers });
        return response.data;
    },

    async uploadImage(id, file) {
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.post(`${API_URL}/events/${id}/image`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    async respondToInvitation(id, status) {
        const response = await api.post(`${API_URL}/invitations/${id}/respond`, { status });
        return response.data;
    },

    async shareEvent(id, username) {
        const response = await api.post(`${API_URL}/events/${id}/share`, { username });
        return response.data;
    },

    async getCategories(companyId = null) {
        const headers = companyId ? { 'x-company-id': companyId } : {};
        const response = await api.get(`${API_URL}/categories`, { headers });
        return response.data;
    },

    async createCategory(data, companyId = null) {
        const headers = companyId ? { 'x-company-id': companyId } : {};
        const response = await api.post(`${API_URL}/categories`, data, { headers });
        return response.data;
    },

    async deleteCategory(id, companyId = null) {
        const headers = companyId ? { 'x-company-id': companyId } : {};
        const response = await api.delete(`${API_URL}/categories/${id}`, { headers });
        return response.data;
    }
};
