// frontend/src/services/expenseReportService.js

import api from './api'; // On importe l'instance Axios pré-configurée

/**
 * Soumet une nouvelle note de frais.
 * @param {number} companyId - L'ID de l'entreprise.
 * @param {object} reportData - Les données de la note de frais.
 * @param {number} reportData.amount - Le montant.
 * @param {string} reportData.comment - Le commentaire.
 * @param {string} reportData.date - La date au format ISO.
 * @returns {Promise<Object>} La nouvelle note de frais créée.
 */
export const submitExpenseReport = async (companyId, reportData) => {
    try {
        const { data } = await api.post(`/comptabilite/expense-reports`, reportData);
        return data;
    } catch (error) {
        console.error("Erreur lors de la soumission de la note de frais:", error);
        throw error;
    }
};

/**
 * Met à jour le statut d'une note de frais (remboursée ou refusée).
 * @param {number} companyId - L'ID de l'entreprise.
 * @param {number} reportId - L'ID de la note de frais à mettre à jour.
 * @param {'REIMBURSED' | 'REJECTED'} status - Le nouveau statut.
 * @returns {Promise<Object>} La note de frais mise à jour.
 */
export const reviewExpenseReport = async (companyId, reportId, status) => {
    try {
        const { data } = await api.patch(`/comptabilite/expense-reports/${reportId}/status`, { status });
        return data;
    } catch (error) {
        console.error(`Erreur lors de la mise à jour de la note de frais ${reportId}:`, error);
        throw error;
    }
};

export const getExpenseReports = async (_companyId) => {
    try {
        const { data } = await api.get(`/comptabilite/expense-reports`);
        return data;
    } catch (error) {
        console.error("Erreur lors de la récupération des notes de frais:", error);
        throw error;
    }
};