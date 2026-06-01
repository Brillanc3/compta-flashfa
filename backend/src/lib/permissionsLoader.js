// /backend/src/lib/permissionsLoader.js

const fs = require('fs');
const path = require('path');
const prisma = require('../db');

// On stockera les permissions chargées ici pour ne les lire qu'une fois.
let loadedPermissions = [];
let modulePermissionMap = new Map();

/**
 * Lit tous les fichiers *.permissions.js au démarrage du serveur,
 * et stocke en mémoire les permissions "modèles" (celles avec {companyId}).
 */
async function loadPermissions() {
    console.log('[Permissions] Chargement des modèles de permission depuis les fichiers...');
    try {
        const tempPermissions = [];
        const modulesDir = path.join(__dirname, '../modules');
        const moduleNames = fs.readdirSync(modulesDir).filter(file =>
            fs.statSync(path.join(modulesDir, file)).isDirectory()
        );

        for (const moduleName of moduleNames) {
            const permissionsFile = path.join(modulesDir, moduleName, `${moduleName}.permissions.js`);

            if (fs.existsSync(permissionsFile)) {
                const { PERMISSIONS } = require(permissionsFile);
                const module = await prisma.module.findUnique({ where: { name: moduleName.toLowerCase() } });

                if (module && PERMISSIONS) {
                    const modulePermissions = [];
                    for (const key in PERMISSIONS) {
                        const action = PERMISSIONS[key];
                        // On ne garde que les permissions qui sont des modèles pour les entreprises
                        if (action.includes('{companyId}')) {
                            tempPermissions.push({ action, moduleId: module.id });
                            modulePermissions.push(action);
                        }
                    }
                    modulePermissionMap.set(module.id, modulePermissions);
                }
            }
        }
        loadedPermissions = tempPermissions;
        console.log(`[Permissions] ✅ ${loadedPermissions.length} modèles de permission chargés.`);
    } catch (error) {
        console.error('[Permissions] ❌ Erreur critique lors du chargement des permissions :', error);
        process.exit(1);
    }
}
/**
 * Retourne la liste des permissions chargées en mémoire.
 */
function getLoadedPermissions() {
    return loadedPermissions;
}

module.exports = {
    loadPermissions,
    getLoadedPermissions,
};