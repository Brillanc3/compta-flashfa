// /backend/src/modules/sacem/sacem.permissions.js
'use strict';

const PERMISSIONS = {
    SACEM_VIEW: 'SACEM.{companyId}.VIEW',
    SACEM_VIEW_SELF: 'SACEM.{companyId}.VIEW_SELF',
    SACEM_CREATE: 'SACEM.{companyId}.CREATE',
    SACEM_EDIT: 'SACEM.{companyId}.EDIT',
    SACEM_STATS: 'SACEM.{companyId}.STATS',
};

const DESCRIPTIONS = {
    [PERMISSIONS.SACEM_VIEW]: 'Voir tous les posts SACEM et participations',
    [PERMISSIONS.SACEM_VIEW_SELF]: 'Voir ses propres participations et posts SACEM',
    [PERMISSIONS.SACEM_CREATE]: 'Ajouter des nouveaux posts SACEM (import texte)',
    [PERMISSIONS.SACEM_EDIT]: 'Modifier les titres, catégories et participations des posts SACEM',
    [PERMISSIONS.SACEM_STATS]: 'Voir les statistiques de revenus SACEM',
};

const HIERARCHY = {
    [PERMISSIONS.SACEM_VIEW]: [PERMISSIONS.SACEM_VIEW_SELF],
};

module.exports = {
    PERMISSIONS,
    DESCRIPTIONS,
    HIERARCHY,
};
