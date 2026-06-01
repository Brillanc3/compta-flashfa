// frontend/src/services/dashboardService.js

import apiClient from './api';

/**
 * Récupère la liste de toutes les définitions de widgets qu'un utilisateur
 * a le droit d'ajouter à son dashboard pour un contexte donné.
 * @param {number} contextId - L'ID du contexte (Company ID, User ID, etc.).
 * @param {string} contextType - Le type de contexte ('COMPANY', 'ADMIN_USER').
 * @returns {Promise<Array>} La liste des widgets disponibles.
 */
export const getAvailableWidgets = async (contextId, contextType) => {
    try {
        const response = await apiClient.get('/dashboard/available-widgets', {
            params: {
                contextType,
                contextId,
            }
        });
        return response.data;
    } catch (error) {
        console.error(`Erreur GET available-widgets:`, error.response?.data || error);
        throw error.response?.data || error;
    }
};

/**
 * Récupère la disposition de widgets sauvegardée par l'utilisateur.
 * @param {number} contextId - L'ID de l'entreprise/utilisateur.
 * @param {string} contextType - Le type de contexte ('COMPANY', 'ADMIN_USER').
 * @returns {Promise<Array>} La liste des widgets de l'utilisateur avec leur layout.
 */
export const getUserDashboardLayout = async (contextId, contextType) => {
    try {
        const response = await apiClient.get('/dashboard/layout', {
            params: {
                contextType,
                contextId,
            }
        });
        return response.data;
    } catch (error) {
        console.error(`Erreur GET layout:`, error.response?.data || error);
        throw error.response?.data || error;
    }
};

/**
 * Sauvegarde la disposition actuelle des widgets.
 * @param {number} contextId - L'ID de l'entreprise/utilisateur.
 * @param {string} contextType - Le type de contexte ('COMPANY', 'ADMIN_USER').
 * @param {Array<object>} widgets - Le tableau des widgets et de leur nouvelle disposition.
 * @returns {Promise<object>} La réponse de succès du serveur.
 */
export const saveUserDashboardLayout = async (contextId, contextType, widgets) => {
    try {
        const response = await apiClient.post('/dashboard/layout', { widgets }, {
            params: {
                contextType,
                contextId,
            }
        });
        return response.data;
    } catch (error) {
        console.error(`Erreur SAVE layout:`, error.response?.data || error);
        throw error.response?.data || error;
    }
};


// --- Fonctions de récupération de données pour widgets spécifiques ---

/**
 * Récupère les données pour le widget "Journal de Transaction".
 * @param {number} companyId - L'ID de l'entreprise.
 * @param {object} config - L'objet de configuration du widget (ex: { transactionCount: 5 }).
 * @returns {Promise<Array>} La liste des transactions.
 */
export const getWidgetData_TransactionLog = async (companyId, config) => {
    try {
        // MODIFIÉ: L'URL correspond à la nouvelle route "comptabilite" pour ce widget.
        const response = await apiClient.get('/comptabilite/widgets/transaction_log', {
            params: {
                contextId: companyId, // L'ID de la compagnie est le contextId pour ce widget
                config: JSON.stringify(config || {}),
            },
        });
        return response.data;
    } catch (error) {
        throw error.response.data;
    }
};

/**
 * Utilise la nouvelle route centralisée.
 */
export const getWidgetData_UserBillsByStatus = async (companyId, config) => {
    try {
        const response = await apiClient.get(`/comptabilite/widgets/user_bills_by_status`, {
            params: { contextId: companyId, config: JSON.stringify(config || {}) },
        });
        return response.data;
    } catch (error) { throw error.response.data; }
};

/**
 * Fonction pour les statistiques des notes de frais.
 */
export const getWidgetData_ExpenseReportStats = async (companyId) => {
    try {
        const response = await apiClient.get('/comptabilite/widgets/expense_report_stats', {
            params: { contextId: companyId },
        });
        return response.data;
    } catch (error) { throw error.response.data; }
};

/**
 * Fonction pour les notes de frais récentes de l'utilisateur.
 */
export const getWidgetData_MyRecentExpenseReports = async (companyId) => {
    try {
        const response = await apiClient.get('/comptabilite/widgets/my_recent_expense_reports', {
            params: { contextId: companyId },
        });
        return response.data;
    } catch (error) { throw error.response.data; }
};

/**
 * Récupère les données pour le widget "Mon Salaire".
 * @param {number} companyId - L'ID de l'entreprise.
 * @param {object} config - Configuration, ex: { year, week }.
 */
export const getWidgetData_MySalary = async (companyId, config) => {
    try {
        const response = await apiClient.get('/employees/widgets/my_salary', {
            params: { contextId: companyId, config: JSON.stringify(config || {}) },
        });
        return response.data;
    } catch (error) { throw error.response.data; }
};