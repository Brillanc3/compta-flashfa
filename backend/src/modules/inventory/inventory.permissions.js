// /backend/src/modules/inventory/inventory.permissions.js

'use strict';

/**
 * Permissions du module Inventaire.
 *
 * On suit le même pattern que Comptabilité :
 *  - INVENTORY.{companyId}.VIEW_SELF
 *  - INVENTORY.{companyId}.VIEW_ALL
 */

const PERMISSIONS = {
    VIEW_SELF: 'INVENTORY.{companyId}.VIEW_SELF',
    VIEW_ALL: 'INVENTORY.{companyId}.VIEW_ALL',
};

/**
 * Hiérarchie des permissions :
 *  - VIEW_ALL inclut VIEW_SELF
 */
const HIERARCHY = {
    [PERMISSIONS.VIEW_SELF]: [],
    [PERMISSIONS.VIEW_ALL]: [PERMISSIONS.VIEW_SELF],
};

module.exports = {
    PERMISSIONS,
    HIERARCHY,
};
