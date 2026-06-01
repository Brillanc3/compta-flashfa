// /frontend/src/services/comptabiliteService.js
import apiClient from './api';

// --- Fonctions pour les Factures (Bills) ---

/**
 * Récupère une liste paginée et filtrée de factures pour une entreprise.
 * @param {number} companyId - L'ID de l'entreprise.
 * @param {object} filters - Un objet contenant les filtres et la pagination.
 * @returns {Promise<object>} Un objet contenant les données et la pagination.
 */
export const getBills = async (companyId, filters = {}) => {
    try {
        // La nouvelle route est préfixée par /comptabilite
        const response = await apiClient.get(`/comptabilite/bills`, {
            params: filters,
        });
        return response.data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

// Route backend proposée: GET /comptabilite/balance/solde
export async function getCompanySolde(companyId) {
    // companyId peut être ignoré côté backend si x-company-id est obligatoire,
    // mais on le garde pour cohérence d’appel.
    const { data } = await apiClient.get('/comptabilite/balance/solde', {
        params: { companyId },
    });
    return data; // { companyId, balance }
}

/**
 * Récupère les détails d'une facture spécifique.
 * NOTE : La signature a été modifiée pour inclure companyId pour la sécurité.
 * @param {number} companyId
 * @param {number} billId
 * @returns {Promise<Object>}
 */
export const getBillDetails = async (companyId, billId) => {
    try {
        // La nouvelle route est plus sécurisée et cohérente
        const { data } = await apiClient.get(`/comptabilite/bills/${billId}`);
        return data;
    } catch (error) {
        console.error(`Erreur lors de la récupération de la facture ${billId}:`, error);
        throw error;
    }
};

/**
 * Met à jour la liste des partages d'une facture.
 * Payload attendu (exemple) :
 * {
 *   shares: [
 *     { companyEmployeeId: 12, percentage: 50 },
 *     { companyEmployeeId: 18, percentage: 50 },
 *   ]
 * }
 */
export const updateBillShares = async (companyId, billId, payload) => {
    try {
        const { data } = await apiClient.patch(`/comptabilite/bills/${billId}/shares`, payload);
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

// --- Fonctions pour les Transactions ---

/**
 * Récupère les transactions paginées et filtrées du journal.
 */
export const getJournalTransactions = async (_companyId, weekParams, filters, page, pageSize) => {
    const payload = { weekParams, filters, page, pageSize };
    const { data } = await apiClient.post(`/comptabilite/transactions/journal`, payload);
    return data;
};

/**
 * Récupère le résumé des transactions pour les graphiques.
 */
export const getJournalSummary = async (_companyId, weekParams, filters) => {
    const payload = { weekParams, filters };
    const { data } = await apiClient.post(`/comptabilite/transactions/summary`, payload);
    return data;
};

/**
 * Met à jour la catégorie d'une transaction.
 */
export const updateTransactionCategory = async (_companyId, transactionId, categoryId) => {
    const { data } = await apiClient.patch(`/comptabilite/transactions/${transactionId}`, { categoryId });
    return data;
};

/**
 * Récupère la liste de toutes les catégories de transaction.
 * @returns {Promise<Array>}
 */
export const getTransactionCategories = async () => {
    try {
        // Note: Cette route n'a pas encore été migrée au backend, j'anticipe son nouvel emplacement.
        const { data } = await apiClient.get('/comptabilite/transaction-categories');
        return data;
    } catch (error) {
        console.error("Erreur lors de la récupération des catégories:", error);
        throw error;
    }
};

/**
 * Récupère le rapport de déclaration fiscale pour une semaine donnée.
 * @param {number} companyId
 * @param {number} year
 * @param {number} week
 * @returns {Promise<object>}
 */
export const getTaxDeclaration = async (companyId, year, week) => {
    try {
        const { data } = await apiClient.get(`/comptabilite/declaration`, {
            params: { year, week }
        });
        return data;
    } catch (error) {
        throw error.response?.data || error;
    }
};

export const createExpenseReport = async (companyId, reportData) => {
    const { data } = await apiClient.post(`/comptabilite/expense-reports`, reportData);
    return data;
};

export const getExpenseReports = async (_companyId) => {
    const { data } = await apiClient.get(`/comptabilite/expense-reports`);
    return data;
};

export const updateExpenseReportStatus = async (companyId, reportId, status) => {
    const { data } = await apiClient.patch(`/comptabilite/expense-reports/${reportId}/status`, { status });
    return data;
};

export const getExpenseReportCategories = async (_companyId) => {
    const { data } = await apiClient.get(`/comptabilite/expense-categories`);
    return data;
};

export const createExpenseReportCategory = async (companyId, name) => {
    const { data } = await apiClient.post(`/comptabilite/expense-categories`, { name });
    return data;
};

export const updateExpenseReportCategory = async (companyId, categoryId, name) => {
    const { data } = await apiClient.patch(`/comptabilite/expense-categories/${categoryId}`, { name });
    return data;
};

export const deleteExpenseReportCategory = async (companyId, categoryId) => {
    const { data } = await apiClient.delete(`/comptabilite/expense-categories/${categoryId}`);
    return data;
};

export const updateExpenseReport = async (companyId, reportId, payload) => {
    const { data } = await apiClient.patch(`/comptabilite/expense-reports/${reportId}`, payload);
    return data;
};

export const deleteExpenseReport = async (companyId, reportId) => {
    const { data } = await apiClient.delete(`/comptabilite/expense-reports/${reportId}`);
    return data;
};

// --- Fonctions pour les Commentaires de Factures ---

export const getBillComments = async (billId, page = 1, limit = 5) => {
    const { data } = await apiClient.get(`/comptabilite/bills/${billId}/comments`, { params: { page, limit } });
    return data;
};

export const addBillComment = async (billId, content) => {
    const { data } = await apiClient.post(`/comptabilite/bills/${billId}/comments`, { content });
    return data;
};

export const editBillComment = async (commentId, content) => {
    const { data } = await apiClient.patch(`/comptabilite/bills/comments/${commentId}`, { content });
    return data;
};

export const deleteBillComment = async (commentId) => {
    const { data } = await apiClient.delete(`/comptabilite/bills/comments/${commentId}`);
    return data;
};
