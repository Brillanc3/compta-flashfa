// /frontend/src/services/adminImageService.js

import apiClient from './api';

export async function listImages(params = {}) {
    const query = new URLSearchParams();
    if (params.ownerType) query.set('ownerType', params.ownerType);
    if (params.ownerId) query.set('ownerId', params.ownerId);
    if (params.search) query.set('search', params.search);
    if (params.page) query.set('page', params.page);
    if (params.limit) query.set('limit', params.limit);
    const { data } = await apiClient.get(`/admin/images?${query.toString()}`);
    return data;
}

export async function uploadImage(file) {
    const form = new FormData();
    form.append('file', file);
    const { data } = await apiClient.post('/admin/images/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
}

export async function getImage(imageId) {
    const { data } = await apiClient.get(`/admin/images/${imageId}`);
    return data;
}

export async function replaceImage(imageId, file) {
    const form = new FormData();
    form.append('file', file);
    const { data } = await apiClient.patch(`/admin/images/${imageId}/replace`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
}

export async function deleteImage(imageId) {
    const { data } = await apiClient.delete(`/admin/images/${imageId}`);
    return data;
}

export async function convertToWebP(imageId) {
    const { data } = await apiClient.post(`/admin/images/${imageId}/convert-webp`);
    return data;
}
