// frontend/src/services/ticketsService.js
import apiClient from "./api";

function buildQuery(params = {}) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v === undefined || v === null || v === "") return;
        q.set(k, String(v));
    });
    return q.toString();
}

export const TICKET_CATEGORIES = {
    BILLS: "BILLS",
    SUPPORT: "SUPPORT",
    OTHERS: "OTHERS",
};

export const TICKET_STATUSES = {
    OPEN: "OPEN",
    ASSIGNED: "ASSIGNED",
    WAITING_AGENT: "WAITING_AGENT",
    WAITING_USER: "WAITING_USER",
    CLOSURE_REQUESTED: "CLOSURE_REQUESTED",
    CLOSED: "CLOSED",
};

/* -------------------------------------------------------------------------- */
/* User (créateur)                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Liste les tickets du user connecté.
 * @param {{page?:number,pageSize?:number,status?:string}} params
 */
export async function listMyTickets(params = {}) {
    const qs = buildQuery(params);
    const { data } = await apiClient.get(`/tickets${qs ? `?${qs}` : ""}`);
    return data;
}

/**
 * Crée un ticket + 1er message.
 * @param {{category:string, subject:string, message:string}} payload
 */
export async function createMyTicket(payload) {
    const { data } = await apiClient.post("/tickets", payload);
    return data;
}

/**
 * Récupère un ticket du user (créateur).
 * @param {number} ticketId
 */
export async function getMyTicket(ticketId) {
    if (!ticketId) throw new Error("ticketId invalide.");
    const { data } = await apiClient.get(`/tickets/${ticketId}`);
    return data;
}

/**
 * Liste les messages d'un ticket (user).
 * @param {number} ticketId
 * @param {{page?:number,pageSize?:number}} params
 */
export async function listMyTicketMessages(ticketId, params = {}) {
    if (!ticketId) throw new Error("ticketId invalide.");
    const qs = buildQuery(params);
    const { data } = await apiClient.get(`/tickets/${ticketId}/messages${qs ? `?${qs}` : ""}`);
    return data;
}

/**
 * Poste un message (user).
 * @param {number} ticketId
 * @param {{content:string}} payload
 */
export async function postMyTicketMessage(ticketId, payload) {
    if (!ticketId) throw new Error("ticketId invalide.");
    const { data } = await apiClient.post(`/tickets/${ticketId}/messages`, payload);
    return data;
}

/**
 * Ferme un ticket (user créateur).
 * @param {number} ticketId
 */
export async function closeMyTicket(ticketId) {
    if (!ticketId) throw new Error("ticketId invalide.");
    const { data } = await apiClient.post(`/tickets/${ticketId}/close`);
    return data;
}

/**
 * Réouvre un ticket fermé depuis moins de 48h (user créateur).
 * @param {number} ticketId
 */
export async function reopenMyTicket(ticketId) {
    if (!ticketId) throw new Error("ticketId invalide.");
    const { data } = await apiClient.post(`/tickets/${ticketId}/reopen`);
    return data;
}

/* -------------------------------------------------------------------------- */
/* Admin                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Inbox admin tickets.
 * Visibilité backend:
 * - ADMIN.* / ADMIN.TICKETS.* : tous les tickets
 * - sinon : non-assignés (cat autorisée) + assignés à soi
 * @param {{page?:number,pageSize?:number,category?:string,status?:string,assigned?:'me'|'unassigned'|'all',search?:string}} params
 */
export async function listAdminTickets(params = {}) {
    const qs = buildQuery(params);
    const { data } = await apiClient.get(`/tickets/admin${qs ? `?${qs}` : ""}`);
    return data;
}

/**
 * Détail ticket côté admin.
 * @param {number} ticketId
 */
export async function getAdminTicket(ticketId) {
    if (!ticketId) throw new Error("ticketId invalide.");
    const { data } = await apiClient.get(`/tickets/admin/${ticketId}`);
    return data;
}

/**
 * Liste messages ticket côté admin.
 * @param {number} ticketId
 * @param {{page?:number,pageSize?:number}} params
 */
export async function listAdminTicketMessages(ticketId, params = {}) {
    if (!ticketId) throw new Error("ticketId invalide.");
    const qs = buildQuery(params);
    const { data } = await apiClient.get(`/tickets/admin/${ticketId}/messages${qs ? `?${qs}` : ""}`);
    return data;
}

/**
 * Prendre en charge un ticket (assigne à soi si non assigné).
 * @param {number} ticketId
 */
export async function takeTicket(ticketId) {
    if (!ticketId) throw new Error("ticketId invalide.");
    const { data } = await apiClient.post(`/tickets/admin/${ticketId}/take`);
    return data;
}

/**
 * Rejoindre un ticket (obligatoire avant répondre).
 * @param {number} ticketId
 */
export async function joinTicket(ticketId) {
    if (!ticketId) throw new Error("ticketId invalide.");
    const { data } = await apiClient.post(`/tickets/admin/${ticketId}/join`);
    return data;
}

/**
 * Répondre côté admin (requiert join).
 * @param {number} ticketId
 * @param {{content:string}} payload
 */
export async function postAdminTicketMessage(ticketId, payload) {
    if (!ticketId) throw new Error("ticketId invalide.");
    const { data } = await apiClient.post(`/tickets/admin/${ticketId}/messages`, payload);
    return data;
}

/**
 * Forcer l'assignation (ADMIN.* ou ADMIN.TICKETS.*).
 * @param {number} ticketId
 * @param {{assigneeId:number|null}} payload
 */
export async function forceAssignTicket(ticketId, payload) {
    if (!ticketId) throw new Error("ticketId invalide.");
    const { data } = await apiClient.post(`/tickets/admin/${ticketId}/assign`, payload);
    return data;
}

/**
 * Demander la clôture (assignee ou super).
 * @param {number} ticketId
 */
export async function requestTicketClosure(ticketId) {
    if (!ticketId) throw new Error("ticketId invalide.");
    const { data } = await apiClient.post(`/tickets/admin/${ticketId}/closure-request`);
    return data;
}

/**
 * Fermer manuellement un ticket (agent assigné ou super).
 * @param {number} ticketId
 */
export async function closeAdminTicket(ticketId) {
    if (!ticketId) throw new Error("ticketId invalide.");
    const { data } = await apiClient.post(`/tickets/admin/${ticketId}/close`);
    return data;
}

/**
 * Infos du demandeur (assignee OU ADMIN.*).
 * @param {number} ticketId
 */
export async function getTicketRequesterProfile(ticketId) {
    if (!ticketId) throw new Error("ticketId invalide.");
    const { data } = await apiClient.get(`/tickets/admin/${ticketId}/requester-profile`);
    return data;
}
