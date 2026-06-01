// /backend/src/modules/garage/garage.permissions.js

/**
 * Permissions du module GARAGE
 *
 * VIEW   → Consulter les véhicules + mouvements
 * MANAGE → Ajouter / modifier / supprimer un véhicule enregistré
 */

const PERMISSIONS = {
    VIEW:   "GARAGE.{companyId}.VIEW",
    MANAGE: "GARAGE.{companyId}.MANAGE",
};

/**
 * Hiérarchie :
 * - MANAGE implique VIEW
 */
const HIERARCHY = {
    "GARAGE.{companyId}.MANAGE": ["GARAGE.{companyId}.VIEW"],
};

module.exports = {
    PERMISSIONS,
    HIERARCHY,
};