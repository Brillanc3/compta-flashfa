// frontend/src/services/customPagesService.js
import apiClient from "@/services/api";

/**
 * Endpoints backend:
 * - GET    /custom-pages
 * - GET    /custom-pages/:id
 * - GET    /custom-pages/slug/:slug
 * - POST   /custom-pages
 * - PATCH  /custom-pages/:id/settings
 * - PATCH  /custom-pages/:id/draft
 * - PATCH  /custom-pages/:id/access
 * - POST   /custom-pages/:id/publish
 * - DELETE /custom-pages/:id
 */

export async function listCustomPages({ version = "published" } = {}) {
    const { data } = await apiClient.get("/custom-pages", { params: { version } });
    return data; // { data: [...] }
}

export async function getCustomPageById(id, { version = "both" } = {}) {
    const { data } = await apiClient.get(`/custom-pages/${id}`, { params: { version } });
    return data;
}

export async function getCustomPagesNav() {
    const res = await apiClient.get("/custom-pages/nav");
    return res.data;
}


export async function getCustomPageBySlug(slug, { version = "published" } = {}) {
    const { data } = await apiClient.get(`/custom-pages/slug/${encodeURIComponent(slug)}`, {
        params: { version },
    });
    return data;
}

export async function createCustomPage(payload) {
    const { data } = await apiClient.post("/custom-pages", payload);
    return data;
}

export async function updateCustomPageSettings(id, payload) {
    const { data } = await apiClient.patch(`/custom-pages/${id}/settings`, payload);
    return data;
}

export async function updateCustomPageDraft(id, payload) {
    const { data } = await apiClient.patch(`/custom-pages/${id}/draft`, payload);
    return data;
}

export async function updateCustomPageAccess(id, payload) {
    const { data } = await apiClient.patch(`/custom-pages/${id}/access`, payload);
    return data;
}

export async function publishCustomPage(id) {
    const { data } = await apiClient.post(`/custom-pages/${id}/publish`);
    return data;
}

export async function deleteCustomPage(id) {
    await apiClient.delete(`/custom-pages/${id}`);
    return true;
}
