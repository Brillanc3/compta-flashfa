// /backend/src/modules/notifications/notifications.permissions.js

/**
 * @fileoverview Définit les permissions pour le module Notifications.
 */

const PERMISSIONS = {
    // Permission requise pour envoyer des notifications à d'autres utilisateurs
    SEND: 'NOTIFICATIONS.SEND',
};

// Pas de hiérarchie nécessaire pour une seule permission.
const HIERARCHY = {};

module.exports = {
    PERMISSIONS,
    HIERARCHY,
};