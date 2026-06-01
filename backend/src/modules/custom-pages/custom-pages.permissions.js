// /backend/src/modules/customPage/customPage.permissions.js

/**
 * Custom Pages (WordPress-like)
 *
 * NOTE:
 * - Les permissions ne contiennent PLUS `.{companyId}.` (choix produit V4)
 * - Le "super access" company est géré en dehors de ce fichier via :
 *   `COMPANY.${companyId}.*` (override total)
 */

const PERMISSIONS = {
    VIEW: "CUSTOM_PAGES.VIEW",

    MANAGE: "CUSTOM_PAGES.MANAGE",
    PUBLISH: "CUSTOM_PAGES.PUBLISH",
    DELETE: "CUSTOM_PAGES.DELETE",

    ACCESS_MANAGE: "CUSTOM_PAGES.ACCESS.MANAGE",
};

/**
 * Hiérarchie logique :
 * - MANAGE => PUBLISH, DELETE, ACCESS_MANAGE
 * - (optionnel) PUBLISH pourrait impliquer VIEW, mais on le garde explicite côté guard
 */
const HIERARCHY = {
    [PERMISSIONS.MANAGE]: [
        PERMISSIONS.PUBLISH,
        PERMISSIONS.DELETE,
        PERMISSIONS.ACCESS_MANAGE,
        PERMISSIONS.VIEW,
    ],
    [PERMISSIONS.PUBLISH]: [PERMISSIONS.VIEW],
    [PERMISSIONS.DELETE]: [PERMISSIONS.VIEW],
    [PERMISSIONS.ACCESS_MANAGE]: [PERMISSIONS.VIEW],
};

module.exports = { PERMISSIONS, HIERARCHY };
