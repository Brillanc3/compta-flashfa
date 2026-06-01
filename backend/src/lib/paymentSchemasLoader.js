// /backend/src/lib/paymentSchemasLoader.js

const fs = require('fs');
const path = require('path');

// On utilise un Map pour stocker en mémoire les schémas par nom de module.
const paymentSchemaCache = new Map();

/**
 * Scanne tous les modules au démarrage, charge leur configuration 'payments' et la met en cache.
 */
function loadPaymentSchemas() {
    console.log('[Schemas] Chargement des schémas de paiement des modules...');
    try {
        const modulesDir = path.join(__dirname, '../modules');
        const moduleNames = fs.readdirSync(modulesDir).filter(file =>
            fs.statSync(path.join(modulesDir, file)).isDirectory()
        );

        for (const moduleName of moduleNames) {
            const routeFile = path.join(modulesDir, moduleName, `${moduleName}.routes.js`);
            if (fs.existsSync(routeFile)) {
                const moduleConfig = require(routeFile);
                if (moduleConfig.payments && Array.isArray(moduleConfig.payments)) {
                    paymentSchemaCache.set(moduleName, moduleConfig.payments);
                }
            }
        }
        console.log(`[Schemas] ✅ ${paymentSchemaCache.size} modules avec schémas de paiement chargés.`);
    } catch (error) {
        console.error('[Schemas] ❌ Erreur critique lors du chargement des schémas de paiement :', error);
        process.exit(1);
    }
}

/**
 * Récupère les schémas de paiement mis en cache pour une liste de noms de modules.
 * @param {string[]} companyOrModuleNames - Un tableau de noms de modules (ex: ['comptabilite', 'exportation'])
 * @returns {Array} - Un tableau plat contenant tous les champs de paiement.
 */
async function getSchemaForModules(companyOrModuleNames) {
    let moduleNames = [];

    if (typeof companyOrModuleNames === 'number') {
        const { getActiveModulesForCompany } = require('./moduleUtils');
        const activeModules = await getActiveModulesForCompany(companyOrModuleNames);
        moduleNames = activeModules.map(am => am.module.name);
    } else {
        moduleNames = companyOrModuleNames;
    }

    let combinedSchema = [];
    for (const moduleName of moduleNames) {
        if (paymentSchemaCache.has(moduleName)) {
            combinedSchema = [...combinedSchema, ...paymentSchemaCache.get(moduleName)];
        }
    }
    return combinedSchema;
}

module.exports = {
    loadPaymentSchemas,
    getSchemaForModules,
};