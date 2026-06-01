// /backend/src/lib/syncModules.js

const fs = require('fs');
const path = require('path');
const prisma = require('../db');

/**
 * Lit les dossiers dans /src/modules et les synchronise avec la table Module de la BDD.
 * Utilise 'upsert' pour créer les modules manquants sans créer de doublons.
 * Cette fonction est appelée au démarrage du serveur pour une synchronisation automatique.
 */
async function syncModules() {
    console.log('[Sync] Début de la synchronisation des modules...');
    try {
        const modulesDir = path.join(__dirname, '../modules');

        const moduleNames = fs.readdirSync(modulesDir).filter(file =>
            fs.statSync(path.join(modulesDir, file)).isDirectory()
        );

        await Promise.all(
            moduleNames.map(name =>
                prisma.module.upsert({
                    where: { name: name },
                    update: {}, // Ne rien faire si le module existe déjà
                    create: {
                        name: name.toLowerCase(),
                        description: `Module pour la fonctionnalité ${name}.`,
                    },
                })
            )
        );

        console.log(`[Sync] ✅ ${moduleNames.length} modules synchronisés avec succès.`);

    } catch (error) {
        console.error('[Sync] ❌ Erreur critique lors de la synchronisation des modules :', error);
        process.exit(1); // Arrête le serveur si la BDD n'est pas synchronisée
    }
}

module.exports = syncModules;