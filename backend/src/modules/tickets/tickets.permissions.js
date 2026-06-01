// /backend/src/modules/tickets/tickets.permissions.js

/**
 * Permissions du module Tickets (côté ADMIN).
 *
 * Convention repo:
 * - PERMISSIONS: constantes
 * - HIERARCHY: héritage optionnel
 * - DESCRIPTIONS: libellés UI
 *
 * Note: les wildcards sont gérées par hasPermission() (middleware/auth.js).
 */
const PERMISSIONS = {
    TICKETS_ALL: 'ADMIN.TICKETS.*',

    TICKETS_BILLS: 'ADMIN.TICKETS.BILLS',
    TICKETS_SUPPORT: 'ADMIN.TICKETS.SUPPORT',
    TICKETS_OTHERS: 'ADMIN.TICKETS.OTHERS',
};

const HIERARCHY = {
    [PERMISSIONS.TICKETS_ALL]: [
        PERMISSIONS.TICKETS_BILLS,
        PERMISSIONS.TICKETS_SUPPORT,
        PERMISSIONS.TICKETS_OTHERS,
    ],
};

const DESCRIPTIONS = {
    [PERMISSIONS.TICKETS_ALL]: "Accède à tous les tickets (toutes catégories) et peut forcer l'assignation.",
    [PERMISSIONS.TICKETS_BILLS]: "Accède aux tickets de facturation / Billing Service.",
    [PERMISSIONS.TICKETS_SUPPORT]: "Accède aux tickets d'aide / support.",
    [PERMISSIONS.TICKETS_OTHERS]: "Accède aux tickets autres / contact / rendez-vous.",
};

/**
 * Mapping interne: catégorie ticket -> permission nécessaire
 */
const CATEGORY_PERMISSION_MAP = {
    BILLS: PERMISSIONS.TICKETS_BILLS,
    SUPPORT: PERMISSIONS.TICKETS_SUPPORT,
    OTHERS: PERMISSIONS.TICKETS_OTHERS,
};

module.exports = {
    PERMISSIONS,
    HIERARCHY,
    DESCRIPTIONS,
    CATEGORY_PERMISSION_MAP,
};
