import apiClient from '@/services/api';

// ─── Sites ───────────────────────────────────────────────

export async function listSites() {
  const { data } = await apiClient.get('/hosting');
  return data;
}

export async function getSite(siteId) {
  const { data } = await apiClient.get(`/hosting/${siteId}`);
  return data;
}

export async function createSite(payload) {
  const { data } = await apiClient.post('/hosting', payload);
  return data;
}

export async function updateSite(siteId, payload) {
  const { data } = await apiClient.patch(`/hosting/${siteId}`, payload);
  return data;
}

export async function publishSite(siteId) {
  const { data } = await apiClient.post(`/hosting/${siteId}/publish`);
  return data;
}

export async function unpublishSite(siteId) {
  const { data } = await apiClient.post(`/hosting/${siteId}/unpublish`);
  return data;
}

export async function deleteSite(siteId) {
  await apiClient.delete(`/hosting/${siteId}`);
}

export async function linkBill(siteId, billId) {
  const { data } = await apiClient.patch(`/hosting/${siteId}/bill`, { billId });
  return data;
}

// ─── Pages ───────────────────────────────────────────────

export async function listPages(siteId) {
  const { data } = await apiClient.get(`/hosting/${siteId}/pages`);
  return data;
}

export async function getPage(siteId, pageId) {
  const { data } = await apiClient.get(`/hosting/${siteId}/pages/${pageId}`);
  return data;
}

export async function createPage(siteId, payload) {
  const { data } = await apiClient.post(`/hosting/${siteId}/pages`, payload);
  return data;
}

export async function updatePage(siteId, pageId, payload) {
  const { data } = await apiClient.patch(`/hosting/${siteId}/pages/${pageId}`, payload);
  return data;
}

export async function deletePage(siteId, pageId) {
  await apiClient.delete(`/hosting/${siteId}/pages/${pageId}`);
}

// ─── Assets ──────────────────────────────────────────────

export async function listAssets(siteId) {
  const { data } = await apiClient.get(`/hosting/${siteId}/assets`);
  return data;
}

export async function getAsset(siteId, assetId) {
  const { data } = await apiClient.get(`/hosting/${siteId}/assets/${assetId}`);
  return data;
}

export async function upsertAsset(siteId, payload) {
  const { data } = await apiClient.put(`/hosting/${siteId}/assets`, payload);
  return data;
}

export async function deleteAsset(siteId, assetId) {
  await apiClient.delete(`/hosting/${siteId}/assets/${assetId}`);
}

// ─── Formulaires ─────────────────────────────────────────

export async function listForms(siteId) {
  const { data } = await apiClient.get(`/hosting/${siteId}/forms`);
  return data;
}

export async function getForm(siteId, formId) {
  const { data } = await apiClient.get(`/hosting/${siteId}/forms/${formId}`);
  return data;
}

export async function createForm(siteId, payload) {
  const { data } = await apiClient.post(`/hosting/${siteId}/forms`, payload);
  return data;
}

export async function updateForm(siteId, formId, payload) {
  const { data } = await apiClient.patch(`/hosting/${siteId}/forms/${formId}`, payload);
  return data;
}

export async function deleteForm(siteId, formId) {
  await apiClient.delete(`/hosting/${siteId}/forms/${formId}`);
}

export async function addField(siteId, formId, payload) {
  const { data } = await apiClient.post(`/hosting/${siteId}/forms/${formId}/fields`, payload);
  return data;
}

export async function updateField(siteId, formId, fieldId, payload) {
  const { data } = await apiClient.patch(`/hosting/${siteId}/forms/${formId}/fields/${fieldId}`, payload);
  return data;
}

export async function deleteField(siteId, formId, fieldId) {
  await apiClient.delete(`/hosting/${siteId}/forms/${formId}/fields/${fieldId}`);
}

export async function reorderFields(siteId, formId, orderedIds) {
  const { data } = await apiClient.post(`/hosting/${siteId}/forms/${formId}/fields/reorder`, { orderedIds });
  return data;
}

export async function listResponses(siteId, formId, unreadOnly = false) {
  const { data } = await apiClient.get(`/hosting/${siteId}/forms/${formId}/responses`, {
    params: unreadOnly ? { unread: 'true' } : undefined,
  });
  return data;
}

export async function markResponseRead(siteId, formId, responseId, isRead = true) {
  const { data } = await apiClient.patch(
    `/hosting/${siteId}/forms/${formId}/responses/${responseId}`,
    { isRead }
  );
  return data;
}

export async function deleteResponse(siteId, formId, responseId) {
  await apiClient.delete(`/hosting/${siteId}/forms/${formId}/responses/${responseId}`);
}

// ─── Variables ───────────────────────────────────────────

export async function listVariables(siteId) {
  const { data } = await apiClient.get(`/hosting/${siteId}/variables`);
  return data;
}

export async function upsertVariable(siteId, key, payload) {
  const { data } = await apiClient.put(`/hosting/${siteId}/variables/${encodeURIComponent(key)}`, payload);
  return data;
}

export async function deleteVariable(siteId, key) {
  await apiClient.delete(`/hosting/${siteId}/variables/${encodeURIComponent(key)}`);
}

// ─── Routes custom ───────────────────────────────────────

export async function listCustomRoutes(siteId) {
  const { data } = await apiClient.get(`/hosting/${siteId}/custom-routes`);
  return data;
}

export async function upsertCustomRoute(siteId, key, payload) {
  const { data } = await apiClient.put(`/hosting/${siteId}/custom-routes/${encodeURIComponent(key)}`, payload);
  return data;
}

export async function deleteCustomRoute(siteId, key) {
  await apiClient.delete(`/hosting/${siteId}/custom-routes/${encodeURIComponent(key)}`);
}

// ─── Public (pas de x-company-id requis) ─────────────────

export async function getPublicPage(slug, route = '') {
  const path = route
    ? `/hosting/public/${encodeURIComponent(slug)}/${route}`
    : `/hosting/public/${encodeURIComponent(slug)}`;
  const { data } = await apiClient.get(path);
  return data;
}
