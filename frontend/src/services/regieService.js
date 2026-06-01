// /frontend/src/services/regieService.js
import api from './api';

const regieService = {
  /**
   * État du serveur RTMP
   */
  getStatus: async (companyId) => {
    const response = await api.get(`/regie/${companyId}/status`);
    return response.data;
  },

  /**
   * Démarrer le serveur
   */
  startServer: async (companyId) => {
    const response = await api.post(`/regie/${companyId}/start`);
    return response.data;
  },

  /**
   * Arrêter le serveur
   */
  stopServer: async (companyId) => {
    const response = await api.post(`/regie/${companyId}/stop`);
    return response.data;
  },

  /**
   * Liste des clés de streaming pour une entreprise
   */
  getKeys: async (companyId) => {
    const response = await api.get(`/regie/${companyId}/keys`);
    return response.data;
  },

  /**
   * Générer une nouvelle clé
   */
  generateKey: async (companyId, data) => {
    const response = await api.post(`/regie/${companyId}/keys`, data);
    return response.data;
  },

  /**
   * Supprimer une clé
   */
  deleteKey: async (companyId, keyId) => {
    const response = await api.delete(`/regie/${companyId}/keys/${keyId}`);
    return response.data;
  },

  /**
   * Basculer l'état d'urgence d'une clé (Coupure TV)
   */
  toggleEmergency: async (companyId, keyId, status) => {
    const response = await api.put(`/regie/${companyId}/keys/${keyId}/emergency`, { status });
    return response.data;
  },

  /**
   * Récupérer le statut d'une clé (Public - pour OBS)
   */
  getKeyStatusPublic: async (key) => {
    const response = await api.get(`/regie/key-status/${key}`);
    return response.data;
  }
};

export default regieService;
