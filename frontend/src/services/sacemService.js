// frontend/src/services/sacemService.js
import api from './api';

const sacemService = {
  getPosts: async (params) => {
    const response = await api.get('/sacem', { params });
    return response.data;
  },

  getPost: async (postId) => {
    const response = await api.get(`/sacem/${postId}`);
    return response.data;
  },

  previewImport: async (text) => {
    const response = await api.post('/sacem/preview', { text });
    return response.data;
  },

  importData: async (entries) => {
    const response = await api.post('/sacem/import', { entries });
    return response.data;
  },

  updatePost: async (postId, data) => {
    const response = await api.put(`/sacem/${postId}`, data);
    return response.data;
  },

  getStats: async (from, to) => {
    const response = await api.get('/sacem/stats', { params: { from, to } });
    return response.data;
  },

  getCategories: async () => {
    const response = await api.get('/sacem/categories');
    return response.data;
  }
};

export default sacemService;
