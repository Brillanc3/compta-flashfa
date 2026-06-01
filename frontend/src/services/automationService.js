// frontend/src/services/automationService.js
import api from "./api";

const automationService = {
  /**
   * Récupère la configuration des blocs et de la toolbox depuis le backend.
   */
  async getConfig() {
    try {
      const response = await api.get("/automation/config");
      return response.data;
    } catch (error) {
      console.error("[AutomationService] Error fetching config:", error);
      throw error;
    }
  },

  /**
   * Récupère le catalogue de modèles prêts à l'emploi depuis le backend.
   */
  async getTemplates() {
    try {
      const response = await api.get("/automation/templates");
      return response.data.templates || [];
    } catch (error) {
      console.error("[AutomationService] Error fetching templates:", error);
      throw error;
    }
  },

  async getWorkflows() {
    try {
      const response = await api.get("/automation/workflows");
      return response.data.workflows || [];
    } catch (error) {
      console.error("[AutomationService] Error fetching workflows:", error);
      throw error;
    }
  },

  async saveWorkflows(workflows) {
    try {
      const response = await api.post("/automation/workflows", { workflows });
      return response.data;
    } catch (error) {
      console.error("[AutomationService] Error saving workflows:", error);
      throw error;
    }
  }
};

export default automationService;
