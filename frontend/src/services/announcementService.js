// /frontend/src/services/announcementService.js
import apiClient from './api';

export const getActiveAnnouncement = async () => {
    const { data } = await apiClient.get('/admin/announcements/active');
    return data;
};

export const listAnnouncements = async () => {
    const { data } = await apiClient.get('/admin/announcements');
    return data;
};

export const createAnnouncement = async (payload) => {
    const { data } = await apiClient.post('/admin/announcements', payload);
    return data;
};

export const updateAnnouncement = async (id, payload) => {
    const { data } = await apiClient.patch(`/admin/announcements/${id}`, payload);
    return data;
};

export const deleteAnnouncement = async (id) => {
    await apiClient.delete(`/admin/announcements/${id}`);
};
