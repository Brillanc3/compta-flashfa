const path = require('path');
const fs = require('fs');

const MODULES_DIR = path.join(__dirname, '../modules');

/**
 * Charge toutes les permissions déclarées dans
 * src/modules/../{moduleName}.permissions.js
*
* Retour :
* {
*   comptabilite: [ 'COMPTABILITE.{companyId}.BILLS.VIEW_ALL', ... ],
*   inventory: [ ... ],
* }
*/
function loadModulePermissions() {
    const map = {};

    const moduleNames = fs.readdirSync(MODULES_DIR);

    for (const moduleName of moduleNames) {
        const permissionsFile = path.join(
            MODULES_DIR,
            moduleName,
            `${moduleName}.permissions.js`
        );

        if (!fs.existsSync(permissionsFile)) continue;

        const mod = require(permissionsFile);
        if (!mod?.PERMISSIONS) continue;

        map[moduleName] = Object.values(mod.PERMISSIONS)
            .filter(Boolean)
            .map(String);
    }

    return map;
}

module.exports = loadModulePermissions;
