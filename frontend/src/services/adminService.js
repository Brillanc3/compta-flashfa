// /frontend/src/services/adminService.js

import apiClient from './api';

/* -------------------------------------------------------------------------------------------------
 * Admin Service (frontend)
 * Aligne les appels avec les routes backend du module Admin.
 *
 * Endpoints principaux détectés dans admin.routes.js :
 *  - GET    /admin/billing-support-dashboard
 *  - GET    /admin/companies
 *  - POST   /admin/companies
 *  - POST   /admin/companies/:companyId/shard/known
 *  - PATCH  /admin/companies/:companyId
 *  - GET    /admin/companies/:companyId/billable-contacts
 *  - POST   /admin/companies/:companyId/billable-contacts
 *  - DELETE /admin/companies/:companyId/billable-contacts/:userId
 *  - POST   /admin/companies/:companyId/notify-incomplete
 *  - GET    /admin/users
 *  - GET    /admin/companies/:companyId/details (avec filtres)
 *  - GET    /admin/modules
 *  - POST   /admin/companies/:companyId/modules/assign
 *  - POST   /admin/companies/:companyId/modules/remove
 *  - PATCH  /admin/companies/:companyId/onboarding-key
 *  - PATCH  /admin/companies/:companyId/api-key
 *  - GET    /admin/companies/:companyId/permissions/full
 *  - POST   /admin/companies/:companyId/permissions/full/assign
 *  - POST   /admin/companies/:companyId/permissions/full/revoke
 *
 * Endpoints employés (ajoutés précédemment pour la page Admin):
 *  - GET    /admin/companies/:companyId/employees/:employeeId/admin-profile
 *  - PATCH  /admin/companies/:companyId/employees/:employeeId/status
 *  - POST   /admin/companies/:companyId/employees/:employeeId/rank
 *  - DELETE /admin/companies/:companyId/employees/:employeeId/rank/:rankId
 *  - POST   /admin/companies/:companyId/employees/:employeeId/rank-history
 *  - POST   /admin/companies/:companyId/users/:userId/avatar (multipart)
 * ------------------------------------------------------------------------------------------------- */

/* ----------------------------- Helpers internes ----------------------------- */

const handleError = (label, error) => {
    // Uniformise les erreurs
    console.error(`${label}:`, error?.response?.data || error);
    throw error?.response?.data || error;
};

const truthy = (v) => v !== undefined && v !== null && v !== '';

/* ------------------------------ Dashboard facturation ------------------------------ */

/**
 * Récupère les données pour le tableau de bord du support facturation.
 * @param {number} [week] - Numéro de semaine.
 * @param {number} [year] - Année.
 */
export const getBillingSupportDashboard = async (week, year) => {
    try {
        const params = {};
        if (truthy(week)) params.week = week;
        if (truthy(year)) params.year = year;

        const { data } = await apiClient.get('/admin/billing-support-dashboard', { params });
        return Array.isArray(data) ? data : (data?.items || []);
    } catch (error) {
        handleError('Erreur getBillingSupportDashboard', error);
    }
};

/* -------------------------------- Entreprises -------------------------------- */

/** Liste des entreprises (paginée, côté serveur). */
export const listCompanies = async ({ q, page = 1, pageSize = 25 } = {}) => {
    try {
        const params = {};
        if (truthy(q)) params.q = q;
        if (truthy(page)) params.page = page;
        if (truthy(pageSize)) params.pageSize = pageSize;

        const { data } = await apiClient.get('/admin/companies', { params });

        // Backend renvoie { items, total, page, pageSize, totalPages }
        // Tolère aussi un tableau (fallback).
        if (Array.isArray(data)) {
            const items = data;
            const safePageSize = items.length || pageSize || 25;
            return {
                items,
                total: items.length,
                page: 1,
                pageSize: safePageSize,
                totalPages: 1,
            };
        }

        const items = Array.isArray(data?.items) ? data.items : [];

        const total = Number.isFinite(+data?.total) ? +data.total : items.length;
        const safePage = Number.isFinite(+data?.page) ? +data.page : (truthy(page) ? +page : 1);
        const safePageSize = Number.isFinite(+data?.pageSize) ? +data.pageSize : (truthy(pageSize) ? +pageSize : 25);
        const totalPages = Number.isFinite(+data?.totalPages) ? +data.totalPages : Math.max(1, Math.ceil(total / (safePageSize || 25)));

        return { items, total, page: safePage, pageSize: safePageSize, totalPages };
    } catch (error) {
        handleError('Erreur listCompanies', error);
    }
};


/** Crée une entreprise. */
export const createCompany = async (payload) => {
    try {
        const { data } = await apiClient.post('/admin/companies', payload);
        return data;
    } catch (error) {
        handleError('Erreur createCompany', error);
    }
};

/** Marque la company comme connue par un shard (ou autre signal). */
export const setCompanyKnown = async (companyId, payload = {}) => {
    try {
        const { data } = await apiClient.post(`/admin/companies/${companyId}/shard/known`, payload);
        return data;
    } catch (error) {
        handleError('Erreur setCompanyKnown', error);
    }
};

/** Met à jour le nom d'une entreprise (ou autres champs pris en charge). */
export const updateCompanyName = async (companyId, name) => {
    try {
        const { data } = await apiClient.patch(`/admin/companies/${companyId}`, { name });
        return data;
    } catch (error) {
        handleError('Erreur updateCompanyName', error);
    }
};

/** Supprime une entreprise (admin). */
export const deleteCompany = async (companyId) => {
    try {
        const { data } = await apiClient.delete(`/admin/companies/${companyId}`);
        return data;
    } catch (error) {
        handleError('Erreur deleteCompany', error);
    }
};


/** Contacts facturables — liste. */
export const listBillableContacts = async (companyId) => {
    try {
        const { data } = await apiClient.get(`/admin/companies/${companyId}/billable-contacts`);
        return Array.isArray(data) ? data : (data?.items || []);
    } catch (error) {
        handleError('Erreur listBillableContacts', error);
    }
};

/** Contacts facturables — assignation. */
export const assignBillableContact = async (companyId, userId, opts = {}) => {
    try {
        const payload = { userId };
        if (opts && typeof opts === 'object' && Object.prototype.hasOwnProperty.call(opts, 'isPrio')) {
            payload.isPrio = !!opts.isPrio;
        }
        const { data } = await apiClient.post(`/admin/companies/${companyId}/billable-contacts`, payload);
        return data;
    } catch (error) {
        handleError('Erreur assignBillableContact', error);
    }
};

/** Contacts facturables — suppression. */
export const removeBillableContact = async (companyId, userId) => {
    try {
        const { data } = await apiClient.delete(`/admin/companies/${companyId}/billable-contacts/${userId}`);
        return data;
    } catch (error) {
        handleError('Erreur removeBillableContact', error);
    }
};

/** Met à jour le prix compta (USD) d'une entreprise. */
export const updateCompanyAccountingPrice = async (companyId, accountingPrice) => {
    try {
        const { data } = await apiClient.patch(`/admin/companies/${companyId}/accounting-price`, { accountingPrice });
        return data;
    } catch (error) {
        handleError('Erreur updateCompanyAccountingPrice', error);
    }
};

export const setAccountingSuspension = async (companyId, suspendedAt) => {
    try {
        const { data } = await apiClient.patch(`/admin/companies/${companyId}/accounting-suspension`, { suspendedAt: suspendedAt ?? null });
        return data;
    } catch (error) {
        handleError('Erreur setAccountingSuspension', error);
    }
};

/** Routage manuel d'une facture compta (billId = externalBillId). */
export const setBillAccountingRouting = async (billId, { accountingTargetCompanyId, accountingNotifyUserId }) => {
    try {
        const { data } = await apiClient.patch(`/admin/bills/${billId}/accounting-routing`, {
            accountingTargetCompanyId,
            accountingNotifyUserId,
        });
        return data;
    } catch (error) {
        handleError('Erreur setBillAccountingRouting', error);
    }
};

/** Envoi de la notification BLOCKING “facture émise” (billId = externalBillId). */
export const issueAccountingBill = async (billId) => {
    try {
        const { data } = await apiClient.post(`/admin/bills/${billId}/accounting/issue`);
        return data;
    } catch (error) {
        handleError('Erreur issueAccountingBill', error);
    }
};

/** Notifier qu'une company est incomplète (envoi d'une notification). */
export const notifyIncompleteCompany = async (companyId, payload = {}) => {
    try {
        const { data } = await apiClient.post(`/admin/companies/${companyId}/notify-incomplete`, payload);
        return data;
    } catch (error) {
        handleError('Erreur notifyIncompleteCompany', error);
    }
};

/** Détails d'une company (avec filtres). */
export const getCompanyDetails = async (companyId, filters = {}) => {
    try {
        const params = {};
        if (truthy(filters.startDate)) params.startDate = filters.startDate;
        if (truthy(filters.endDate)) params.endDate = filters.endDate;
        if (truthy(filters.reason)) params.reason = filters.reason;
        if (truthy(filters.user)) params.user = filters.user;
        if (truthy(filters.minAmount)) params.minAmount = filters.minAmount;
        if (truthy(filters.maxAmount)) params.maxAmount = filters.maxAmount;

        const { data } = await apiClient.get(`/admin/companies/${companyId}/details`, { params });
        return data;
    } catch (error) {
        handleError('Erreur getCompanyDetails', error);
    }
};

/* --------------------------------- Modules --------------------------------- */

/** Catalogue des modules. */
export const getAllModules = async () => {
    try {
        const { data } = await apiClient.get('/admin/modules');
        return Array.isArray(data) ? data : (data?.items || []);
    } catch (error) {
        handleError('Erreur getAllModules', error);
    }
};

/** Assigner plusieurs modules à une company. */
export const assignCompanyModules = async (companyId, moduleIds = []) => {
    try {
        const { data } = await apiClient.post(`/admin/companies/${companyId}/modules/assign`, { moduleIds });
        return data; // idéalement { activeModules: [...] }
    } catch (error) {
        handleError('Erreur assignCompanyModules', error);
    }
};

/** Retirer un module d'une company. */
export const removeCompanyModule = async (companyId, moduleId) => {
    try {
        const { data } = await apiClient.post(`/admin/companies/${companyId}/modules/remove`, { moduleId });
        return data; // idéalement { activeModules: [...] }
    } catch (error) {
        handleError('Erreur removeCompanyModule', error);
    }
};

/* ------------------------------ Clés & tokens ------------------------------ */

/** Régénère la clé d'onboarding et retourne la nouvelle valeur. */
export const regenerateOnboardingKey = async (companyId) => {
    try {
        const { data } = await apiClient.patch(`/admin/companies/${companyId}/onboarding-key`);
        return data; // { onboardingKey }
    } catch (error) {
        handleError('Erreur regenerateOnboardingKey', error);
    }
};

/** Régénère l'API Key et retourne la nouvelle valeur. */
export const regenerateApiKey = async (companyId) => {
    try {
        const { data } = await apiClient.patch(`/admin/companies/${companyId}/api-key`);
        return data; // { apiKey }
    } catch (error) {
        handleError('Erreur regenerateApiKey', error);
    }
};

/* ------------------------------ FULL Permissions ------------------------------ */

/**
 * Récupère les informations liées à la FULL permission pour une company.
 * (Selon ton backend, peut retourner un agrégat ou la liste ; on harmonise côté front.)
 */
export const getCompanyFullPermission = async (companyId) => {
    try {
        const { data } = await apiClient.get(`/admin/companies/${companyId}/permissions/full`);
        return data;
    } catch (error) {
        handleError('Erreur getCompanyFullPermission', error);
    }
};

/**
 * (Si présent côté backend) Recherche des utilisateurs qui possèdent COMPANY.{id}.*
 * et/ou filtrer par q=name/username.
 * NOTE: si l'endpoint n'existe pas, tu peux brancher sur `getCompanyFullPermission` et filtrer côté front.
 */
export const listCompanyFullUsers = async (companyId, q = '') => {
    try {
        // Tentative endpoint dédié
        try {
            const { data } = await apiClient.get(`/admin/companies/${companyId}/permissions/full-users`, { params: { q } });
            return Array.isArray(data) ? data : (data?.items || []);
        } catch {
            // Fallback: agrégat basique
            const agg = await getCompanyFullPermission(companyId);
            const rows = Array.isArray(agg) ? agg : (agg?.users || []);
            if (!q) return rows;
            const Q = q.toLowerCase();
            return rows.filter(u =>
                String(u?.name || '').toLowerCase().includes(Q) ||
                String(u?.username || '').toLowerCase().includes(Q)
            );
        }
    } catch (error) {
        handleError('Erreur listCompanyFullUsers', error);
    }
};

/** Donne la FULL permission COMPANY.{companyId}.* à un utilisateur. */
export const assignCompanyFullPermission = async (companyId, userId) => {
    try {
        const { data } = await apiClient.post(
            `/admin/companies/${companyId}/permissions/full/assign`,
            { userId }
        );
        return data;
    } catch (error) {
        handleError('Erreur assignCompanyFullPermission', error);
    }
};

/** Retire la FULL permission COMPANY.{companyId}.* d'un utilisateur. */
export const revokeCompanyFullPermission = async (companyId, userId) => {
    try {
        const { data } = await apiClient.post(
            `/admin/companies/${companyId}/permissions/full/revoke`,
            { userId }
        );
        return data;
    } catch (error) {
        handleError('Erreur revokeCompanyFullPermission', error);
    }
};

/* --------------------------------- Utilisateurs --------------------------------- */

/** Recherche d'utilisateurs côté admin (autocomplete, etc.). */
export const listUsers = async (params = {}) => {
    try {
        const { data } = await apiClient.get('/admin/users', { params });
        return Array.isArray(data) ? data : (data?.items || []);
    } catch (error) {
        handleError('Erreur listUsers', error);
    }
};

/* --------------------------------- Employés (Admin) --------------------------------- */

/** Profil enrichi admin d'un employé. */
export const getEmployeeAdminProfile = async (companyId, employeeId) => {
    try {
        const { data } = await apiClient.get(`/admin/companies/${companyId}/employees/${employeeId}/admin-profile`);
        return data;
    } catch (error) {
        handleError('Erreur getEmployeeAdminProfile', error);
    }
};

/** Upload avatar d'un user (via route Admin + vérif d'appartenance à la company). */
export const uploadUserAvatar = async (companyId, userId, file) => {
    const fd = new FormData();
    fd.append('file', file); // lu avec request.file()

    const { data } = await apiClient.post(
        `/admin/companies/${companyId}/users/${userId}/avatar`,
        fd // NE PAS fixer Content-Type (Axios le gère avec boundary)
    );
    return data; // { imageUrl, message }
};

/** Met à jour le statut d'un employé (ACTIVE | RESIGNED | FIRED). */
export const updateEmployeeStatus = async (companyId, employeeId, status) => {
    try {
        const { data } = await apiClient.patch(`/admin/companies/${companyId}/employees/${employeeId}/status`, { status });
        return data;
    } catch (error) {
        handleError('Erreur updateEmployeeStatus', error);
    }
};

/** Assigner un rang à un employé. */
export const assignEmployeeRank = async (companyId, employeeId, rankId) => {
    try {
        const { data } = await apiClient.post(`/admin/companies/${companyId}/employees/${employeeId}/rank`, { rankId });
        return data;
    } catch (error) {
        handleError('Erreur assignEmployeeRank', error);
    }
};

/** Retirer le rang courant d'un employé (si égal à :rankId). */
export const removeEmployeeRank = async (companyId, employeeId, rankId) => {
    try {
        const { data } = await apiClient.delete(`/admin/companies/${companyId}/employees/${employeeId}/rank/${rankId}`);
        return data;
    } catch (error) {
        handleError('Erreur removeEmployeeRank', error);
    }
};

/** Ajouter une entrée d'historique de rang. */
export const addEmployeeRankHistory = async (companyId, employeeId, rankId, note = '') => {
    try {
        const { data } = await apiClient.post(`/admin/companies/${companyId}/employees/${employeeId}/rank-history`, { rankId, note });
        return data;
    } catch (error) {
        handleError('Erreur addEmployeeRankHistory', error);
    }
};

export const createBillingSupportTicket = async (company, participantIds = []) => {
    try {
        const { data } = await apiClient.post('/chat/conversations', {
            type: 'TICKET',
            category: 'BILLING',
            subject: `Support Facturation - ${company.name}`,
            participantIds,
        });
        return data;
    } catch (error) {
        console.error('Erreur lors de la création du ticket facturation:', error);
        throw error.response?.data || error;
    }
};

export const listUsersForAdmin = async (params = {}) => {
    try {
        // Backend attend `search` (pas `q`). On accepte les deux pour compat.
        const { q, search, ...rest } = (params && typeof params === 'object') ? params : {};
        const finalParams = { ...rest };
        const s = (typeof search === 'string' ? search : (typeof q === 'string' ? q : '')).trim();
        if (s) finalParams.search = s;

        const { data } = await apiClient.get('/admin/users', { params: finalParams });
        return Array.isArray(data) ? data : (data?.items || []);
    } catch (error) {
        console.error('Erreur listUsersForAdmin:', error?.response?.data || error);
        throw (error?.response?.data || error);
    }
};

/* =====================================================================================
 * 🚀 Nouvelles routes Admin (ajoutées au fichier existant)
 * ===================================================================================== */

/* --------------------------- Conversations / Messages --------------------------- */
export const listCompanyConversations = async (companyId, { page = 1, pageSize = 10, search = '' } = {}) => {
    try {
        const params = { page, pageSize };
        if (search) params.search = search;
        const { data } = await apiClient.get(`/admin/companies/${companyId}/conversations`, { params });
        return data;
    } catch (error) {
        console.error('Erreur listCompanyConversations:', error);
        throw error?.response?.data || error;
    }
};

export const listConversationMessages = async (conversationId, { page = 1, pageSize = 30 } = {}) => {
    try {
        const params = { page, pageSize };
        const { data } = await apiClient.get(`/admin/conversations/${conversationId}/messages`, { params });
        return data;
    } catch (error) {
        console.error('Erreur listConversationMessages:', error);
        throw error?.response?.data || error;
    }
};

export const editMessage = async (messageId, content) => {
    try {
        const { data } = await apiClient.put(`/admin/messages/${messageId}`, { content });
        return data;
    } catch (error) {
        console.error('Erreur editMessage:', error);
        throw error?.response?.data || error;
    }
};

export const deleteMessage = async (messageId) => {
    try {
        const { data } = await apiClient.delete(`/admin/messages/${messageId}`);
        return data;
    } catch (error) {
        console.error('Erreur deleteMessage:', error);
        throw error?.response?.data || error;
    }
};

export const sendSystemMessage = async (conversationId, content) => {
    try {
        const { data } = await apiClient.post(`/admin/conversations/${conversationId}/system-message`, { content });
        return data;
    } catch (error) {
        console.error('Erreur sendSystemMessage:', error);
        throw error?.response?.data || error;
    }
};

/* --------------------------- Ajout / Retrait de membres --------------------------- */
export const addConversationMember = async (conversationId, { userId, roleId }) => {
    try {
        const { data } = await apiClient.post(`/admin/conversations/${conversationId}/members`, { userId, roleId });
        return data;
    } catch (error) {
        console.error('Erreur addConversationMember:', error);
        throw error?.response?.data || error;
    }
};

export const removeConversationMember = async (conversationId, { userId, roleId }) => {
    try {
        const { data } = await apiClient.delete(`/admin/conversations/${conversationId}/members`, { data: { userId, roleId } });
        return data;
    } catch (error) {
        console.error('Erreur removeConversationMember:', error);
        throw error?.response?.data || error;
    }
};

/* --------------------------- Factures employé (pagination serveur) --------------------------- */
export const listEmployeeBills = async (employeeId, { page = 1, pageSize = 10 } = {}) => {
    try {
        const params = { page, pageSize };
        const { data } = await apiClient.get(`/admin/employees/${employeeId}/bills`, { params });
        return data;
    } catch (error) {
        console.error('Erreur listEmployeeBills:', error);
        throw error?.response?.data || error;
    }
};

/* --------------------------- FULL ACCESS (par entreprise) --------------------------- */
export const setCompanyFullAccess = async (companyId, userId, enabled) => {
    try {
        const { data } = await apiClient.post(`/admin/companies/${companyId}/users/${userId}/full-access`, { enabled });
        return data; // { success, granted }
    } catch (error) {
        console.error('Erreur setCompanyFullAccess:', error);
        throw error?.response?.data || error;
    }
};

/* -------------------------------------------------------------------------------------------------
 * Admin — Company Details (pagination serveur + actions)
 * ------------------------------------------------------------------------------------------------- */

const normalizePaged = (resp, fallbackPage = 1, fallbackPageSize = 10) => {
    const items = Array.isArray(resp?.items)
        ? resp.items
        : (Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []));

    const total = Number(resp?.total ?? resp?.pagination?.totalCount ?? resp?.pagination?.total ?? items.length ?? 0);
    const page = Number(resp?.page ?? resp?.pagination?.currentPage ?? fallbackPage);
    const pageSize = Number(resp?.pageSize ?? resp?.pagination?.pageSize ?? fallbackPageSize);
    const totalPages = Number(resp?.totalPages ?? resp?.pagination?.totalPages ?? Math.max(1, Math.ceil(total / Math.max(1, pageSize))));

    return { items, total, page, pageSize, totalPages };
};

/** PATCH company (admin) — supporte isApiActive + apiDeactivationReason + name/isParentCompany/accountingPrice selon backend */
export const updateCompanyAdmin = async (companyId, payload = {}) => {
    try {
        const { data } = await apiClient.patch(`/admin/companies/${companyId}`, payload);
        return data;
    } catch (error) {
        handleError('Erreur updateCompanyAdmin', error);
    }
};

/** Logs paginés */
export const listCompanyLogs = async (companyId, params = {}) => {
    try {
        const { data } = await apiClient.get(`/admin/companies/${companyId}/logs`, { params });
        return normalizePaged(data, params.page, params.pageSize);
    } catch (error) {
        handleError('Erreur listCompanyLogs', error);
    }
};

/** Force le retraitement d'un log */
export const retryLog = async (logId) => {
    try {
        const { data } = await apiClient.post(`/admin/logs/${logId}/retry`);
        return data;
    } catch (error) {
        handleError('Erreur retryLog', error);
    }
};

/** Récupère les stats des logs */
export const getLogsStats = async (params = {}) => {
    try {
        const { data } = await apiClient.get('/admin/logs/stats', { params });
        return data;
    } catch (error) {
        handleError('Erreur getLogsStats', error);
    }
};

/** Relance tous les logs en échec (avec filtres optionnels) */
export const retryAllFailedLogs = async (filters = {}) => {
    try {
        const { data } = await apiClient.post('/admin/logs/retry-all', filters);
        return data;
    } catch (error) {
        handleError('Erreur retryAllFailedLogs', error);
    }
};

/** Liste globale des logs avec filtres */
export const listGlobalLogs = async (params = {}) => {
    try {
        const { data } = await apiClient.get('/admin/logs', { params });
        return normalizePaged(data, params.page, params.pageSize);
    } catch (error) {
        handleError('Erreur listGlobalLogs', error);
    }
};

/** Liste basique des entreprises pour les filtres */
export const listCompaniesBasic = async () => {
    try {
        const { data } = await apiClient.get('/admin/companies/basic');
        return data;
    } catch (error) {
        handleError('Erreur listCompaniesBasic', error);
    }
};

/** Employés paginés */
export const listCompanyEmployees = async (companyId, params = {}) => {
    try {
        const { data } = await apiClient.get(`/admin/companies/${companyId}/employees`, { params });
        return normalizePaged(data, params.page, params.pageSize);
    } catch (error) {
        handleError('Erreur listCompanyEmployees', error);
    }
};

/** Reset compte employé (mdp/username/etc selon backend) */
export const resetEmployeeAccount = async (companyId, employeeId) => {
    try {
        const { data } = await apiClient.post(`/admin/companies/${companyId}/employees/${employeeId}/reset-account`);
        return data;
    } catch (error) {
        handleError('Erreur resetEmployeeAccount', error);
    }
};

/** MAJ profil user lié à un employee (name/discordId/characterId/phone/iban) */
export const updateEmployeeUserProfile = async (companyId, employeeId, payload = {}) => {
    try {
        const { data } = await apiClient.patch(`/admin/companies/${companyId}/employees/${employeeId}/user-profile`, payload);
        return data;
    } catch (error) {
        handleError('Erreur updateEmployeeUserProfile', error);
    }
};

/** Transactions paginées */
export const listCompanyTransactions = async (companyId, params = {}) => {
    try {
        const { data } = await apiClient.get(`/admin/companies/${companyId}/transactions`, { params });
        return normalizePaged(data, params.page, params.pageSize);
    } catch (error) {
        handleError('Erreur listCompanyTransactions', error);
    }
};

/** Changer la catégorie d'une transaction */
export const updateTransactionCategory = async (companyId, transactionId, categoryId) => {
    try {
        const { data } = await apiClient.patch(
            `/admin/companies/${companyId}/transactions/${transactionId}/category`,
            { categoryId }
        );
        return data;
    } catch (error) {
        handleError('Erreur updateTransactionCategory', error);
    }
};

/** Factures paginées */
export const listCompanyBills = async (companyId, params = {}) => {
    try {
        const { data } = await apiClient.get(`/admin/companies/${companyId}/bills`, { params });
        return normalizePaged(data, params.page, params.pageSize);
    } catch (error) {
        handleError('Erreur listCompanyBills', error);
    }
};

/** Changer le statut d'une facture */
export const updateBillStatus = async (companyId, billId, status) => {
    try {
        const { data } = await apiClient.patch(`/admin/companies/${companyId}/bills/${billId}/status`, { status });
        return data;
    } catch (error) {
        handleError('Erreur updateBillStatus', error);
    }
};

/** Clients paginés */
export const listCompanyClients = async (companyId, params = {}) => {
    try {
        const { data } = await apiClient.get(`/admin/companies/${companyId}/clients`, { params });
        return normalizePaged(data, params.page, params.pageSize);
    } catch (error) {
        handleError('Erreur listCompanyClients', error);
    }
};

export const createCompanyClient = async (companyId, payload) => {
    try {
        const { data } = await apiClient.post(`/admin/companies/${companyId}/clients`, payload);
        return data;
    } catch (error) {
        handleError('Erreur createCompanyClient', error);
    }
};

export const updateCompanyClient = async (companyId, clientId, payload) => {
    try {
        const { data } = await apiClient.patch(`/admin/companies/${companyId}/clients/${clientId}`, payload);
        return data;
    } catch (error) {
        handleError('Erreur updateCompanyClient', error);
    }
};

export const deleteCompanyClient = async (companyId, clientId) => {
    try {
        const { data } = await apiClient.delete(`/admin/companies/${companyId}/clients/${clientId}`);
        return data;
    } catch (error) {
        handleError('Erreur deleteCompanyClient', error);
    }
};

/** Rangs (CRUD) */
export const listCompanyRanks = async (companyId) => {
    try {
        const { data } = await apiClient.get(`/admin/companies/${companyId}/ranks`);
        return Array.isArray(data) ? data : (data?.items || []);
    } catch (error) {
        handleError('Erreur listCompanyRanks', error);
    }
};

export const createCompanyRank = async (companyId, payload) => {
    try {
        const { data } = await apiClient.post(`/admin/companies/${companyId}/ranks`, payload);
        return data;
    } catch (error) {
        handleError('Erreur createCompanyRank', error);
    }
};

export const updateCompanyRank = async (companyId, rankId, payload) => {
    try {
        const { data } = await apiClient.patch(`/admin/companies/${companyId}/ranks/${rankId}`, payload);
        return data;
    } catch (error) {
        handleError('Erreur updateCompanyRank', error);
    }
};

export const deleteCompanyRank = async (companyId, rankId) => {
    try {
        const { data } = await apiClient.delete(`/admin/companies/${companyId}/ranks/${rankId}`);
        return data;
    } catch (error) {
        handleError('Erreur deleteCompanyRank', error);
    }
};

export const updateCompanyRankOrder = async (companyId, order) => {
    try {
        const { data } = await apiClient.patch(`/admin/companies/${companyId}/ranks/order`, { order });
        return data;
    } catch (error) {
        handleError('Erreur updateCompanyRankOrder', error);
    }
};

export const listPermissionTemplates = async () => {
    try {
        const { data } = await apiClient.get('/admin/permission-templates');
        return Array.isArray(data) ? data : (data?.items || []);
    } catch (error) {
        handleError('Erreur listPermissionTemplates', error);
    }
};

/** Contacts facturables — priorité */
export const setBillableContactPrio = async (companyId, userId, isPrio) => {
    try {
        const { data } = await apiClient.patch(`/admin/companies/${companyId}/billable-contacts/${userId}`, { isPrio: !!isPrio });
        return data;
    } catch (error) {
        handleError('Erreur setBillableContactPrio', error);
    }
};
/* ------------------------------ Services Custom ------------------------------ */

/** Liste des services custom d'une entreprise. */
export const listCustomServices = async (companyId) => {
    try {
        const { data } = await apiClient.get(`/admin/companies/${companyId}/custom-services`);
        return Array.isArray(data) ? data : (data?.items || []);
    } catch (error) {
        handleError('Erreur listCustomServices', error);
    }
};

/** Crée un service custom. */
export const createCustomService = async (companyId, payload) => {
    try {
        const { data } = await apiClient.post(`/admin/companies/${companyId}/custom-services`, payload);
        return data;
    } catch (error) {
        handleError('Erreur createCustomService', error);
    }
};

/** Met à jour un service custom. */
export const updateCustomService = async (serviceId, payload) => {
    try {
        const { data } = await apiClient.patch(`/admin/custom-services/${serviceId}`, payload);
        return data;
    } catch (error) {
        handleError('Erreur updateCustomService', error);
    }
};

/** Supprime un service custom. */
export const deleteCustomService = async (serviceId) => {
    try {
        const { data } = await apiClient.delete(`/admin/custom-services/${serviceId}`);
        return data;
    } catch (error) {
        handleError('Erreur deleteCustomService', error);
    }
};

/** Injecte du CSV (PARSE ou INJECT) */
export const injectCompanyCsv = async (companyId, payload) => {
    try {
        const { data } = await apiClient.post(`/admin/companies/${companyId}/inject-csv`, payload);
        return data;
    } catch (error) {
        handleError('Erreur injectCompanyCsv', error);
    }
};

/** Annule une injection CSV */
export const cancelCompanyInjection = async (companyId, transactionId) => {
    try {
        const { data } = await apiClient.post(`/admin/companies/${companyId}/cancel-injection`, { transactionId });
        return data;
    } catch (error) {
        handleError('Erreur cancelCompanyInjection', error);
    }
};

/** Liste les transactions injectées via CSV */
export const listCompanyInjectedTransactions = async (companyId) => {
    try {
        const { data } = await apiClient.get(`/admin/companies/${companyId}/injected-transactions`);
        return data;
    } catch (error) {
        handleError('Erreur listCompanyInjectedTransactions', error);
    }
};

/** Suppression groupée d’injections CSV */
export const bulkCancelCompanyInjections = async (companyId, transactionIds) => {
    try {
        const { data } = await apiClient.post(`/admin/companies/${companyId}/bulk-cancel-injections`, { transactionIds });
        return data;
    } catch (error) {
        handleError('Erreur bulkCancelCompanyInjections', error);
    }
};
