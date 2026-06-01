import apiClient from '@/services/api';

export async function listApiKeys() {
  const { data } = await apiClient.get('/api/');
  return data;
}

export async function createApiKey(payload) {
  const { data } = await apiClient.post('/api/', payload);
  return data;
}

export async function setApiKeyStatus(keyId, isActive) {
  const { data } = await apiClient.patch(`/api/${keyId}/status`, { isActive });
  return data;
}

export async function deleteApiKey(keyId) {
  await apiClient.delete(`/api/${keyId}`);
}
