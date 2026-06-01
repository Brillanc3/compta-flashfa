// /backend/src/modules/regie/regie.permissions.js
'use strict';

const PERMISSIONS = {
    REGIE_VIEW: 'REGIE.{companyId}.VIEW',
    REGIE_MANAGE_KEYS: 'REGIE.{companyId}.MANAGE_KEYS',
    REGIE_CONTROL: 'REGIE.{companyId}.CONTROL',
};

const DESCRIPTIONS = {
    [PERMISSIONS.REGIE_VIEW]: 'Accéder à la page Régie et voir les flux en direct',
    [PERMISSIONS.REGIE_MANAGE_KEYS]: 'Gérer les clés de streaming temporaires des employés',
    [PERMISSIONS.REGIE_CONTROL]: 'Utiliser les commandes de contrôle (Coupure d\'urgence TV)',
};

const HIERARCHY = {
    [PERMISSIONS.REGIE_VIEW]: [],
    [PERMISSIONS.REGIE_MANAGE_KEYS]: [PERMISSIONS.REGIE_VIEW],
    [PERMISSIONS.REGIE_CONTROL]: [PERMISSIONS.REGIE_VIEW],
};

module.exports = {
    PERMISSIONS,
    DESCRIPTIONS,
    HIERARCHY,
};
