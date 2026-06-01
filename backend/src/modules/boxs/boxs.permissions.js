// /backend/src/modules/boxs/boxs.permissions.js

const PERMISSIONS = {
    CARTON_SALES_VIEW: 'BOXS.CARTON_SALES.VIEW',
    CARTON_SALES_EDIT: 'BOXS.CARTON_SALES.EDIT',
};

const HIERARCHY = {
    [PERMISSIONS.CARTON_SALES_EDIT]: [
        PERMISSIONS.CARTON_SALES_VIEW,
    ],
};

const DESCRIPTIONS = {
    [PERMISSIONS.CARTON_SALES_VIEW]: "Accède à la liste des ventes de cartons (journal) + statistiques",
    [PERMISSIONS.CARTON_SALES_EDIT]: "Peut corriger/éditer une vente de carton (cartonCount / reason / numéro)",
};

module.exports = {
    PERMISSIONS,
    HIERARCHY,
    DESCRIPTIONS,
};
