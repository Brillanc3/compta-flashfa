// /backend/src/lib/columnConfigLoader.js

const fs = require('fs');
const path = require('path');

const columnConfigCache = new Map();

function loadColumnConfigs() {
    console.log('[Columns Loader] Démarrage du chargement...');
    try {
        const modulesDir = path.join(__dirname, '../modules');
        const moduleNames = fs.readdirSync(modulesDir).filter(f => fs.statSync(path.join(modulesDir, f)).isDirectory());

        for (const moduleName of moduleNames) {
            const routeFile = path.join(modulesDir, moduleName, `${moduleName}.routes.js`);
            if (fs.existsSync(routeFile)) {
                const moduleConfig = require(routeFile);
                if (moduleConfig.employeeListPageColumns && Array.isArray(moduleConfig.employeeListPageColumns)) {
                    // LOG AJOUTÉ : On affiche ce qu'on trouve
                    console.log(`[Columns Loader] Trouvé ${moduleConfig.employeeListPageColumns.length} colonne(s) pour le module '${moduleName}'.`);
                    const columns = moduleConfig.employeeListPageColumns.map(col => ({ ...col, moduleName }));
                    columnConfigCache.set(moduleName, columns);
                }
            }
        }
        console.log(`[Columns Loader] ✅ ${columnConfigCache.size} modules avec des colonnes personnalisées chargés.`);
    } catch (error) {
        console.error('[Columns Loader] ❌ Erreur critique lors du chargement :', error);
        process.exit(1);
    }
}

function getColumnsForModules(moduleNames = []) {
    let combinedColumns = [];
    for (const moduleName of moduleNames) {
        if (columnConfigCache.has(moduleName)) {
            combinedColumns = [...combinedColumns, ...columnConfigCache.get(moduleName)];
        }
    }
    return combinedColumns;
}

module.exports = {
    loadColumnConfigs,
    getColumnsForModules,
};