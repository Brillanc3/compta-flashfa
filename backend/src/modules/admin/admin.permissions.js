// /backend/src/modules/admin/admin.permissions.js

/**
 * Définition des permissions du module Admin + hiérarchie d'héritage.
 */
const PERMISSIONS = {
    // Accès général au panel d'administration
    ADMIN_PANEL_ACCESS: 'ADMIN.PANEL.ACCESS',

    // Support facturation (déjà existant dans le projet)
    ADMIN_BILLING_SUPPORT_VIEW: 'ADMIN.BILLING.SUPPORT.VIEW',

    // Support facturation — actions (gestion contacts, prix compta, émission/relances)
    ADMIN_BILLING_SUPPORT_MANAGE: 'ADMIN.BILLING.SUPPORT.MANAGE',

    // Entreprises – lecture (liste / basique)
    ADMIN_COMPANY_VIEW: 'ADMIN.COMPANY.VIEW',
    // Détails complets (toutes relations)
    ADMIN_COMPANY_VIEW_DETAILS: 'ADMIN.COMPANY.VIEW_DETAILS',
    // Création / modification / suppression d'une entreprise
    ADMIN_COMPANY_MANAGE: 'ADMIN.COMPANY.MANAGE',
    // Gérer l'attribution des modules d'une entreprise
    ADMIN_COMPANY_MODULES_MANAGE: 'ADMIN.COMPANY.MODULES.MANAGE',

    // Catalogue des modules disponibles (lecture)
    ADMIN_MODULES_CATALOG_VIEW: 'ADMIN.MODULES.CATALOG.VIEW',

    // Gestion MyCalendar (événements prédéfinis)
    ADMIN_MYCALENDAR_MANAGE: 'ADMIN.MYCALENDAR.MANAGE',

    // Services Custom
    ADMIN_SERVICE_CREATE: 'ADMIN.SERVICE.CREATE',
    ADMIN_SERVICE_REMOVE: 'ADMIN.SERVICE.REMOVE',
    ADMIN_SERVICE_UPDATE: 'ADMIN.SERVICE.UPDATE',
    ADMIN_SERVICE_DELETE: 'ADMIN.SERVICE.DELETE',
    ADMIN_SERVICE_MANAGE: 'ADMIN.SERVICE.MANAGE',

    // Annonces admin
    ADMIN_ANNOUNCEMENT_VIEW: 'ADMIN.ANNOUNCEMENT.VIEW',
    ADMIN_ANNOUNCEMENT_MANAGE: 'ADMIN.ANNOUNCEMENT.MANAGE',

    // Gestion des images
    ADMIN_IMAGE_MANAGE: 'ADMIN.IMAGE.MANAGE',
};

/**
 * Hiérarchie: si un utilisateur possède une permission "parent",
 * il obtient implicitement les permissions "enfant" listées ici.
 */
const HIERARCHY = {
    [PERMISSIONS.ADMIN_BILLING_SUPPORT_MANAGE]: [
        PERMISSIONS.ADMIN_BILLING_SUPPORT_VIEW,
    ],
    [PERMISSIONS.ADMIN_COMPANY_MANAGE]: [
        PERMISSIONS.ADMIN_COMPANY_VIEW_DETAILS,
        PERMISSIONS.ADMIN_COMPANY_VIEW,
    ],
    [PERMISSIONS.ADMIN_COMPANY_MODULES_MANAGE]: [
        PERMISSIONS.ADMIN_COMPANY_VIEW_DETAILS,
        PERMISSIONS.ADMIN_COMPANY_VIEW,
    ],
    [PERMISSIONS.ADMIN_SERVICE_MANAGE]: [
        PERMISSIONS.ADMIN_SERVICE_CREATE,
        PERMISSIONS.ADMIN_SERVICE_UPDATE,
        PERMISSIONS.ADMIN_SERVICE_DELETE,
        PERMISSIONS.ADMIN_SERVICE_REMOVE,
    ],
    [PERMISSIONS.ADMIN_ANNOUNCEMENT_MANAGE]: [
        PERMISSIONS.ADMIN_ANNOUNCEMENT_VIEW,
    ],
};

module.exports = { PERMISSIONS, HIERARCHY };