// backend/src/modules/pawnshop/pawnshop.permissions.js

const PERMISSIONS = {
    ACCESS: "PAWNSHOP.ACCESS",

    // Purchases (granulaire)
    PURCHASES_VIEW_ALL: "PAWNSHOP.PURCHASES.VIEW_ALL",
    PURCHASES_VIEW_SELF: "PAWNSHOP.PURCHASES.VIEW_SELF",
    PURCHASES_CREATE: "PAWNSHOP.PURCHASES.CREATE",
    PURCHASES_UPDATE: "PAWNSHOP.PURCHASES.UPDATE",
    PURCHASES_DELETE: "PAWNSHOP.PURCHASES.DELETE",
    PURCHASES_VALIDATE: "PAWNSHOP.PURCHASES.VALIDATE",
    PURCHASES_CANCEL: "PAWNSHOP.PURCHASES.CANCEL",

    // Purchases: actions spéciales
    PURCHASES_MARK_PAID: "PAWNSHOP.PURCHASES.MARK_PAID",
    PURCHASES_CHANGE_OWNER: "PAWNSHOP.PURCHASES.CHANGE_OWNER",
    PURCHASES_DELETE_CANCELED: "PAWNSHOP.PURCHASES.DELETE_CANCELED",

    // Purchases (macro, recommandé pour assignation simple)
    PURCHASES_MANAGE: "PAWNSHOP.PURCHASES.MANAGE",

    // Products (granulaire)
    PRODUCTS_VIEW: "PAWNSHOP.PRODUCTS.VIEW",
    PRODUCTS_CREATE: "PAWNSHOP.PRODUCTS.CREATE",
    PRODUCTS_UPDATE: "PAWNSHOP.PRODUCTS.UPDATE",
    PRODUCTS_DELETE: "PAWNSHOP.PRODUCTS.DELETE",

    // Products (macro)
    PRODUCTS_MANAGE: "PAWNSHOP.PRODUCTS.MANAGE",

    // Clients (granulaire)
    CLIENTS_CREATE: "PAWNSHOP.CLIENTS.CREATE",
    CLIENTS_UPDATE: "PAWNSHOP.CLIENTS.UPDATE",

    // Clients (macro)
    CLIENTS_MANAGE: "PAWNSHOP.CLIENTS.MANAGE",

    // Partners (granulaire)
    PARTNERS_VIEW: "PAWNSHOP.PARTNERS.VIEW",
    PARTNERS_CREATE: "PAWNSHOP.PARTNERS.CREATE",
    PARTNERS_UPDATE: "PAWNSHOP.PARTNERS.UPDATE",
    PARTNERS_DELETE: "PAWNSHOP.PARTNERS.DELETE",

    // Partners (macro)
    PARTNERS_MANAGE: "PAWNSHOP.PARTNERS.MANAGE",

    // Partner buy prices
    PARTNER_PRICES_VIEW: "PAWNSHOP.PARTNER_PRICES.VIEW",
    PARTNER_PRICES_MANAGE: "PAWNSHOP.PARTNER_PRICES.MANAGE",

    // CNI
    CLIENTS_UPLOAD_CNI: "PAWNSHOP.CLIENTS.UPLOAD_CNI",

    // Estimations
    ESTIMATIONS_VIEW: "PAWNSHOP.ESTIMATIONS.VIEW",
    ESTIMATIONS_CREATE: "PAWNSHOP.ESTIMATIONS.CREATE",
    ESTIMATIONS_MANAGE: "PAWNSHOP.ESTIMATIONS.MANAGE",

    // Page publique
    PUBLIC_PAGE_MANAGE: "PAWNSHOP.PUBLIC_PAGE.MANAGE",
};

const HIERARCHY = {
    // Purchases
    [PERMISSIONS.PURCHASES_VIEW_ALL]: [PERMISSIONS.PURCHASES_VIEW_SELF],

    [PERMISSIONS.PURCHASES_MANAGE]: [
        PERMISSIONS.ACCESS,
        PERMISSIONS.PURCHASES_VIEW_ALL,
        PERMISSIONS.PURCHASES_VIEW_SELF,
        PERMISSIONS.PURCHASES_CREATE,
        PERMISSIONS.PURCHASES_UPDATE,
        PERMISSIONS.PURCHASES_DELETE,
        PERMISSIONS.PURCHASES_DELETE_CANCELED,
        PERMISSIONS.PURCHASES_VALIDATE,
        PERMISSIONS.PURCHASES_CANCEL,
        PERMISSIONS.PURCHASES_MARK_PAID,
        PERMISSIONS.PURCHASES_CHANGE_OWNER,
    ],

    // Products
    [PERMISSIONS.PRODUCTS_MANAGE]: [
        PERMISSIONS.ACCESS,
        PERMISSIONS.PRODUCTS_VIEW,
        PERMISSIONS.PRODUCTS_CREATE,
        PERMISSIONS.PRODUCTS_UPDATE,
        PERMISSIONS.PRODUCTS_DELETE,
    ],

    // Clients
    [PERMISSIONS.CLIENTS_MANAGE]: [
        PERMISSIONS.ACCESS,
        PERMISSIONS.CLIENTS_CREATE,
        PERMISSIONS.CLIENTS_UPDATE,
        PERMISSIONS.CLIENTS_UPLOAD_CNI,
    ],

    // Estimations
    [PERMISSIONS.ESTIMATIONS_MANAGE]: [
        PERMISSIONS.ACCESS,
        PERMISSIONS.ESTIMATIONS_VIEW,
        PERMISSIONS.ESTIMATIONS_CREATE,
    ],

    // Partners
    [PERMISSIONS.PARTNERS_MANAGE]: [
        PERMISSIONS.ACCESS,
        PERMISSIONS.PARTNERS_VIEW,
        PERMISSIONS.PARTNERS_CREATE,
        PERMISSIONS.PARTNERS_UPDATE,
        PERMISSIONS.PARTNERS_DELETE,
    ],

    // Partner prices
    [PERMISSIONS.PARTNER_PRICES_MANAGE]: [PERMISSIONS.ACCESS, PERMISSIONS.PARTNER_PRICES_VIEW],

    // Page publique
    [PERMISSIONS.PUBLIC_PAGE_MANAGE]: [PERMISSIONS.ACCESS],
};

const DESCRIPTIONS = {
    [PERMISSIONS.ACCESS]: "Accès au module Pawnshop.",

    [PERMISSIONS.PURCHASES_VIEW_ALL]: "Voir toutes les feuilles d'achat.",
    [PERMISSIONS.PURCHASES_VIEW_SELF]: "Voir uniquement ses feuilles d'achat.",
    [PERMISSIONS.PURCHASES_CREATE]: "Créer une feuille d'achat.",
    [PERMISSIONS.PURCHASES_UPDATE]: "Modifier une feuille d'achat (brouillon) et ses lignes.",
    [PERMISSIONS.PURCHASES_DELETE]: "Supprimer une feuille d'achat (brouillon).",
    [PERMISSIONS.PURCHASES_VALIDATE]:
        "Valider une feuille d'achat (IBAN + téléphone requis sur le client).",
    [PERMISSIONS.PURCHASES_CANCEL]: "Annuler une feuille d'achat.",
    [PERMISSIONS.PURCHASES_MARK_PAID]: "Marquer une feuille comme payée (virement effectué).",
    [PERMISSIONS.PURCHASES_CHANGE_OWNER]: "Changer le vendeur (propriétaire) d'une feuille d'achat.",
    [PERMISSIONS.PURCHASES_DELETE_CANCELED]: "Supprimer une feuille d'achat annulée.",
    [PERMISSIONS.PURCHASES_MANAGE]: "Gestion complète des feuilles d'achat (inclut VIEW_ALL + CRUD + validate/cancel + mark_paid + change_owner).",

    [PERMISSIONS.PRODUCTS_VIEW]: "Lister les produits Pawnshop.",
    [PERMISSIONS.PRODUCTS_CREATE]: "Créer un produit Pawnshop (prix achat + prix revente).",
    [PERMISSIONS.PRODUCTS_UPDATE]: "Modifier un produit Pawnshop.",
    [PERMISSIONS.PRODUCTS_DELETE]: "Supprimer un produit Pawnshop.",
    [PERMISSIONS.PRODUCTS_MANAGE]: "Gestion complète des produits Pawnshop.",

    [PERMISSIONS.CLIENTS_CREATE]: "Créer un client depuis Pawnshop.",
    [PERMISSIONS.CLIENTS_UPDATE]: "Mettre à jour un client depuis Pawnshop.",
    [PERMISSIONS.CLIENTS_MANAGE]: "Gestion des mutations client dans Pawnshop.",

    [PERMISSIONS.PARTNERS_VIEW]: "Lister les partenaires Pawnshop.",
    [PERMISSIONS.PARTNERS_CREATE]: "Créer un partenaire Pawnshop.",
    [PERMISSIONS.PARTNERS_UPDATE]: "Modifier un partenaire Pawnshop.",
    [PERMISSIONS.PARTNERS_DELETE]: "Supprimer un partenaire Pawnshop.",
    [PERMISSIONS.PARTNERS_MANAGE]: "Gestion complète des partenaires Pawnshop.",

    [PERMISSIONS.PARTNER_PRICES_VIEW]:
        "Voir les prix d'achat personnalisés par partenaire (override du prix achat produit).",
    [PERMISSIONS.PARTNER_PRICES_MANAGE]:
        "Gérer les prix d'achat personnalisés par partenaire (override du prix achat produit).",

    [PERMISSIONS.PUBLIC_PAGE_MANAGE]:
        "Configurer la page publique d'estimation (slug, thème, activation).",
};

module.exports = { PERMISSIONS, HIERARCHY, DESCRIPTIONS };
