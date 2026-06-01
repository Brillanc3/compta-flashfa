// /backend/src/modules/partenariat/partenariat.widgets.js

/**
 * Widgets du module Partenariat
 */

const widgets = [
    {
        type: "DECLARE_PARTNER_SERVICE",
        name: "Déclarer un Service Partenaire",
        description: "Permet à un employé de déclarer un service rendu.",
        requiredPermission: "PARTENARIAT.SERVICE_RENDERED.CREATE"
    },
    {
        type: "MY_PARTNER_SERVICES",
        name: "Mes Services Rendus",
        description: "Affiche l'historique de vos 5 derniers services rendus.",
        requiredPermission: null
    }
];

module.exports = widgets;