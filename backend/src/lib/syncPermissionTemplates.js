// /backend/src/lib/syncPermissionTemplates.js

const fs = require('fs');
const path = require('path');
const prisma = require('../db');

/**
 * Lit tous les fichiers *.permissions.js, trouve le module correspondant en BDD,
 * et synchronise les permissions trouvées avec la table PermissionTemplate.
 * Utilise 'upsert' pour éviter les doublons et les erreurs.
 */
async function syncPermissionTemplates() {
    console.log('[Sync Permissions] Début de la synchronisation des permissions modèles...');
    try {
        const modulesDir = path.join(__dirname, '../modules');
        const moduleNames = fs.readdirSync(modulesDir).filter(file =>
            fs.statSync(path.join(modulesDir, file)).isDirectory()
        );

        let templatesSynced = 0;
        for (const moduleName of moduleNames) {
            const permissionsFile = path.join(modulesDir, moduleName, `${moduleName}.permissions.js`);

            if (fs.existsSync(permissionsFile)) {
                // On récupère le module depuis la BDD pour avoir son ID
                const module = await prisma.module.findUnique({
                    where: { name: moduleName.toLowerCase() },
                });

                if (!module) {
                    console.warn(`[Sync Permissions] Le module '${moduleName}' existe en code mais pas en BDD. Synchronisation des modules à lancer avant.`);
                    continue;
                }

                const { PERMISSIONS } = require(permissionsFile);

                if (PERMISSIONS) {
                    for (const key in PERMISSIONS) {
                        const permissionAction = PERMISSIONS[key];

                        await prisma.permissionTemplate.upsert({
                            where: { action: permissionAction },
                            update: { moduleId: module.id }, // Au cas où on changerait un module de permission
                            create: {
                                action: permissionAction,
                                moduleId: module.id,
                            },
                        });
                        templatesSynced++;
                    }
                }
            }
        }

        console.log(`[Sync Permissions] ✅ ${templatesSynced} permissions modèles synchronisées avec succès.`);

    } catch (error) {
        console.error('[Sync Permissions] ❌ Erreur critique lors de la synchronisation des permissions modèles :', error);
        process.exit(1);
    }
}

module.exports = syncPermissionTemplates;