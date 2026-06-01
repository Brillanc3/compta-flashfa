// /backend/src/modules/products/products.permissions.js

/**
 * Permissions du module Products
 *
 * Format des clés : PRODUCTS.<ACTION>.{companyId}
 * - Les placeholders {companyId} sont remplacés côté middleware de vérification.
 * - Séparer les permissions permet d'octroyer des accès fins (ex: RH gère règles sans toucher produits).
 */

const PERMISSIONS = {
    // Voir la liste des produits (utilisateurs du module)
    PRODUCTS_VIEW: 'PRODUCTS.{companyId}.VIEW',

    // Gérer les produits (création / modification / désactivation)
    PRODUCTS_MANAGE: 'PRODUCTS.{companyId}.MANAGE',

    // Déclarer une création de produit (employés)
    PRODUCTS_DECLARE: 'PRODUCTS.{companyId}.DECLARE',

    // Voir l'historique des déclarations (RH / managers)
    PRODUCTS_DECLARATION_VIEW: 'PRODUCTS.{companyId}.DECLARATIONS.VIEW',
    PRODUCTS_DECLARATION_EDIT: 'PRODUCTS.DECLARATIONS.EDIT',

    // Gérer les règles de rémunération (édition/import/export des configs)
    PRODUCTS_RULES_MANAGE: 'PRODUCTS.{companyId}.RULES.MANAGE',
    PRODUCTS_DECLARATION_VIEW_SELF: 'PRODUCTS.VIEW_SELF',
};

/**
 * Hiérarchie des permissions (optionnelle)
 * - Permet d'indiquer qu'un droit "supérieur" inclut des droits "inférieurs".
 * - Le middleware peut utiliser cette table pour résoudre des droits implicites.
 */
const HIERARCHY = {
    [PERMISSIONS.PRODUCTS_MANAGE]: [
        PERMISSIONS.PRODUCTS_VIEW,
        PERMISSIONS.PRODUCTS_DECLARE,
        PERMISSIONS.PRODUCTS_DECLARATION_VIEW,
        PERMISSIONS.PRODUCTS_DECLARATION_EDIT,
        PERMISSIONS.PRODUCTS_RULES_MANAGE,
    ],
    [PERMISSIONS.PRODUCTS_RULES_MANAGE]: [
        PERMISSIONS.PRODUCTS_DECLARATION_VIEW,
        PERMISSIONS.PRODUCTS_DECLARATION_EDIT,
    ],
    [PERMISSIONS.PRODUCTS_DECLARATION_EDIT]: [
        PERMISSIONS.PRODUCTS_DECLARATION_VIEW
    ]
};

const DESCRIPTIONS = {
    [PERMISSIONS.PRODUCTS_DECLARE]: 'WIDGET : Permet de déclarer une production',
    [PERMISSIONS.PRODUCTS_MANAGE]: 'Permet de voir/modifier les déclarations, voir/modifier des produits',
    [PERMISSIONS.PRODUCTS_DECLARATION_VIEW]: 'Permet de voir les déclarations',
    [PERMISSIONS.PRODUCTS_DECLARATION_EDIT]: 'Permet de voir / modifier les déclarations',
    [PERMISSIONS.PRODUCTS_DECLARATION_VIEW_SELF]: 'WIDGET : Permet de voir ses déclarations'
};

module.exports = {
    PERMISSIONS,
    HIERARCHY,
    DESCRIPTIONS
};