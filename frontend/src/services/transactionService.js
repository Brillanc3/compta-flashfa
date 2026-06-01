// frontend/src/services/transactionService.js
import api from './api';

/**
 * Récupère les transactions paginées et filtrées du journal.
 */
export const getJournalTransactions = async (_companyId, weekParams, filters, page, pageSize) => {
    const payload = {
        weekParams: weekParams,
        filters: filters,
        page: page,
        pageSize: pageSize
    };
    const { data } = await api.post(`/companies/transactions/journal/search`, payload);
    return data;
};

/**
 * Récupère le résumé des transactions pour les graphiques.
 */
export const getJournalSummary = async (_companyId, weekParams, filters) => {
    const payload = {
        weekParams: weekParams,
        filters: filters
    };
    const { data } = await api.post(`/companies/transactions/journal/summary/search`, payload);
    return data;
};

/**
 * Met à jour la catégorie d'une transaction.
 */
export const updateTransactionCategory = async (_companyId, transactionId, categoryId) => {
    const { data } = await api.patch(`/companies/transactions/${transactionId}`, { categoryId });
    return data;
};

/**
 * Récupère la liste de toutes les catégories de transaction.
 * @returns {Promise<Array>}
 */
export const getTransactionCategories = async () => {
    try {
        const { data } = await api.get('/transaction-categories');
        return data;
    } catch (error) {
        console.error("Erreur lors de la récupération des catégories:", error);
        throw error;
    }
};