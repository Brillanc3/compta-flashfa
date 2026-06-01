// /backend/src/modules/partenariat/partenariat.permissions.js

/**
 * Permissions du module Partenariat
 * ---------------------------------
 * Structure standardisée conforme aux autres modules :
 *
 *  - PERMISSIONS : toutes les actions disponibles
 *  - HIERARCHY : les permissions "supérieures" qui incluent d'autres permissions
 *
 * Les wildcards (ex: PARTENARIAT.*) seront également gérées
 * automatiquement par le middleware global (checkPermission).
 */

const PERMISSIONS = {
    // Accès global au module
    ACCESS: 'PARTENARIAT.ACCESS',

    /* ---------------------------------------------------------------------- */
    /* 🧩 PARTENAIRES                                                         */
    /* ---------------------------------------------------------------------- */

    PARTNER_CREATE:     'PARTENARIAT.PARTNER.CREATE',
    PARTNER_UPDATE:     'PARTENARIAT.PARTNER.UPDATE',
    PARTNER_DEACTIVATE: 'PARTENARIAT.PARTNER.DEACTIVATE',
    PARTNER_ACTIVATE: 'PARTENARIAT.PARTNER.ACTIVATE',
    PARTNER_LIST:       'PARTENARIAT.PARTNER.LIST',

    /* ---------------------------------------------------------------------- */
    /* 🧩 SERVICES PAR PARTENAIRE                                             */
    /* ---------------------------------------------------------------------- */

    SERVICE_TYPE_CREATE:     'PARTENARIAT.SERVICE_TYPE.CREATE',
    SERVICE_TYPE_UPDATE:     'PARTENARIAT.SERVICE_TYPE.UPDATE',
    SERVICE_TYPE_DEACTIVATE: 'PARTENARIAT.SERVICE_TYPE.DEACTIVATE',
    SERVICE_TYPE_ACTIVATE: 'PARTENARIAT.SERVICE_TYPE.ACTIVATE',
    SERVICE_TYPE_LIST:       'PARTENARIAT.SERVICE_TYPE.LIST',

    /* ---------------------------------------------------------------------- */
    /* 🧩 SERVICES RENDUS                                                     */
    /* ---------------------------------------------------------------------- */

    SERVICE_RENDERED_CREATE: 'PARTENARIAT.SERVICE_RENDERED.CREATE',
    SERVICE_RENDERED_UPDATE: 'PARTENARIAT.SERVICE_RENDERED.UPDATE',
    SERVICE_RENDERED_LIST:   'PARTENARIAT.SERVICE_RENDERED.LIST',
    SERVICE_RENDERED_DELETE: 'PARTENARIAT.SERVICE_RENDERED.DELETE',

    /* ---------------------------------------------------------------------- */
    /* 🧮 RÉCAPITULATIF                                                       */
    /* ---------------------------------------------------------------------- */

    WEEKLY_TOTAL_VIEW: 'PARTENARIAT.WEEKLY_TOTAL.VIEW'
};

const HIERARCHY = {
    // Une permission globale peut englober toutes les autres
    [PERMISSIONS.ACCESS]: [
        PERMISSIONS.PARTNER_CREATE,
        PERMISSIONS.PARTNER_UPDATE,
        PERMISSIONS.PARTNER_DEACTIVATE,
        PERMISSIONS.PARTNER_ACTIVATE,
        PERMISSIONS.PARTNER_LIST,

        PERMISSIONS.SERVICE_TYPE_CREATE,
        PERMISSIONS.SERVICE_TYPE_UPDATE,
        PERMISSIONS.SERVICE_TYPE_DEACTIVATE,
        PERMISSIONS.SERVICE_TYPE_ACTIVATE,
        PERMISSIONS.SERVICE_TYPE_LIST,

        PERMISSIONS.SERVICE_RENDERED_CREATE,
        PERMISSIONS.SERVICE_RENDERED_UPDATE,
        PERMISSIONS.SERVICE_RENDERED_LIST,
        PERMISSIONS.SERVICE_RENDERED_DELETE,

        PERMISSIONS.WEEKLY_TOTAL_VIEW
    ],

    // CRUD partenaires
    [PERMISSIONS.PARTNER_CREATE]:     [],
    [PERMISSIONS.PARTNER_UPDATE]:     [],
    [PERMISSIONS.PARTNER_DEACTIVATE]: [],
    [PERMISSIONS.PARTNER_LIST]:       [],

    // CRUD services partenaires
    [PERMISSIONS.SERVICE_TYPE_CREATE]:     [],
    [PERMISSIONS.SERVICE_TYPE_UPDATE]:     [],
    [PERMISSIONS.SERVICE_TYPE_DEACTIVATE]: [],
    [PERMISSIONS.SERVICE_TYPE_ACTIVATE]:   [],
    [PERMISSIONS.SERVICE_TYPE_LIST]:       [],

    // CRUD services rendus
    [PERMISSIONS.SERVICE_RENDERED_CREATE]: [],
    [PERMISSIONS.SERVICE_RENDERED_UPDATE]: [],
    [PERMISSIONS.SERVICE_RENDERED_LIST]:   [],
    [PERMISSIONS.SERVICE_RENDERED_DELETE]: [],

    // Récapitulatif
    [PERMISSIONS.WEEKLY_TOTAL_VIEW]: []
};

const DESCRIPTIONS = {
    [PERMISSIONS.ACCESS]: "Donne accès à tout le module partenariat et services",
    [PERMISSIONS.PARTNER_CREATE]: "Créer des partenaires",
    [PERMISSIONS.PARTNER_LIST]: "Affiche la liste des partenaires",
    [PERMISSIONS.PARTNER_UPDATE]: "Modifier des partenaires",
    [PERMISSIONS.PARTNER_DEACTIVATE]: "Désactiver des partenaires",
    [PERMISSIONS.PARTNER_ACTIVATE]: "Activer des partenaires",
    [PERMISSIONS.SERVICE_TYPE_DEACTIVATE]: "Désactiver un service partenaire",
    [PERMISSIONS.SERVICE_TYPE_ACTIVATE]: "Active un service partenaire",
    [PERMISSIONS.WEEKLY_TOTAL_VIEW]: "Accède au détail partenaire",
    [PERMISSIONS.SERVICE_RENDERED_CREATE]: "WIDGET : Déclarer un Service Partenaire",
    [PERMISSIONS.SERVICE_RENDERED_UPDATE]: "WIDGET : Modifier son Service Partenaire",
    [PERMISSIONS.SERVICE_RENDERED_DELETE]: "WIDGET : Supprimer son Service Partenaire"
};

module.exports = {
    PERMISSIONS,
    HIERARCHY,
    DESCRIPTIONS
};
