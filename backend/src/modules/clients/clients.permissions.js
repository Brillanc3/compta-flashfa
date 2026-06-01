// /backend/src/modules/clients/clients.permissions.js

const PERMISSIONS = {
    // Permissions pour la gestion des clients
    CLIENTS_VIEW: 'CLIENTS.{companyId}.VIEW',
    CLIENTS_MANAGE: 'CLIENTS.{companyId}.MANAGE',

    // Permissions pour la gestion de la fidélité
    FIDELITY_VIEW: 'CLIENTS.{companyId}.FIDELITY.VIEW',
    FIDELITY_MANAGE: 'CLIENTS.{companyId}.FIDELITY.MANAGE',
    FIDELITY_STAMP: 'CLIENTS.{companyId}.FIDELITY.STAMP',

    // Permission globale pour créer / modifier / supprimer des variables clients
    CLIENTS_VARIABLES_MANAGE: 'clients.variables.manage',
};

const HIERARCHY = {
    [PERMISSIONS.CLIENTS_MANAGE]: [
        PERMISSIONS.CLIENTS_VIEW,
    ],
    [PERMISSIONS.FIDELITY_MANAGE]: [
        PERMISSIONS.FIDELITY_VIEW,
        PERMISSIONS.FIDELITY_STAMP,
    ],
};



module.exports = {
    PERMISSIONS,
    HIERARCHY,
};