// /backend/src/modules/contracts/contracts.permissions.js

/**
 * Permissions du module Contracts
 * --------------------------------
 * Structure standardisée conforme aux autres modules.
 *
 * Les wildcards (ex: CONTRACTS.*) sont prises en charge par checkPermission().
 */

const PERMISSIONS = {
    // Accès global au module Contrats
    ACCESS: 'CONTRACTS.ACCESS',

    /* ---------------------------------------------------------------------- */
    /* 🧩 GESTION DES TEMPLATES                                              */
    /* ---------------------------------------------------------------------- */

    TEMPLATE_CREATE:  'CONTRACTS.TEMPLATE.CREATE.{companyId}',
    TEMPLATE_UPDATE:  'CONTRACTS.TEMPLATE.UPDATE.{companyId}',
    TEMPLATE_LIST:    'CONTRACTS.TEMPLATE.LIST.{companyId}',
    TEMPLATE_VIEW:    'CONTRACTS.TEMPLATE.VIEW.{companyId}',

    // Gestion des articles Markdown dans un template
    TEMPLATE_ARTICLE_MANAGE: 'CONTRACTS.TEMPLATE.ARTICLE.MANAGE.{companyId}',

    /* ---------------------------------------------------------------------- */
    /* 📨 ASSIGNATION DE CONTRATS                                             */
    /* ---------------------------------------------------------------------- */

    ASSIGN: 'CONTRACTS.ASSIGN.{companyId}',

    /* ---------------------------------------------------------------------- */
    /* 🧾 CONTRATS D'ENTREPRISE                                               */
    /* ---------------------------------------------------------------------- */

    // Permission dynamique : VIEW.{companyId}
    COMPANY_ASSIGNMENTS_VIEW: 'CONTRACTS.COMPANY_ASSIGNMENTS.VIEW.{companyId}',

    /* ---------------------------------------------------------------------- */
    /* 🔗 PARTAGES PUBLICS                                                    */
    /* ---------------------------------------------------------------------- */

    SHARES: 'CONTRACTS.SHARES'
};

const HIERARCHY = {
    /* ---------------------------------------------------------------------- */
    /* 🔝 ACCÈS GLOBAL AU MODULE                                               */
    /* ---------------------------------------------------------------------- */

    [PERMISSIONS.ACCESS]: [
        PERMISSIONS.TEMPLATE_CREATE,
        PERMISSIONS.TEMPLATE_UPDATE,
        PERMISSIONS.TEMPLATE_LIST,
        PERMISSIONS.TEMPLATE_VIEW,
        PERMISSIONS.TEMPLATE_ARTICLE_MANAGE,
        PERMISSIONS.ASSIGN
        // Note : pas de permission pour lire ses propres contrats
    ],

    /* ---------------------------------------------------------------------- */
    /* 🧩 GESTION DES TEMPLATES                                              */
    /* ---------------------------------------------------------------------- */

    [PERMISSIONS.TEMPLATE_CREATE]: [
        PERMISSIONS.TEMPLATE_UPDATE,
        PERMISSIONS.TEMPLATE_LIST,
        PERMISSIONS.TEMPLATE_VIEW
    ],

    [PERMISSIONS.TEMPLATE_UPDATE]: [
        PERMISSIONS.TEMPLATE_VIEW
    ],

    [PERMISSIONS.TEMPLATE_LIST]: [],
    [PERMISSIONS.TEMPLATE_VIEW]: [],

    [PERMISSIONS.TEMPLATE_ARTICLE_MANAGE]: [
        PERMISSIONS.TEMPLATE_VIEW
    ],

    /* ---------------------------------------------------------------------- */
    /* 📨 ASSIGNATION                                                         */
    /* ---------------------------------------------------------------------- */

    [PERMISSIONS.ASSIGN]: [],

    /* ---------------------------------------------------------------------- */
    /* 🧾 CONTRATS D'ENTREPRISE                                               */
    /* ---------------------------------------------------------------------- */

    // La permission dynamique sera résolue par checkPermission()
    ["CONTRACTS.COMPANY_ASSIGNMENTS.VIEW.*"]: [],

    /* ---------------------------------------------------------------------- */
    /* 🔗 PARTAGES PUBLICS                                                    */
    /* ---------------------------------------------------------------------- */

    [PERMISSIONS.SHARES]: []
};

module.exports = {
    PERMISSIONS,
    HIERARCHY
};
