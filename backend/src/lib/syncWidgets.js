// backend/src/lib/syncWidgets.js
// Regroupe les 2 fonctionnalités :
//  - syncWidgets()           → MAJ de la base (master uniquement)
//  - registryWidgetsRoute()  → enregistrement des routes widgets (côté shard/server)
const fs = require('fs');
const path = require('path');
const prisma = require('../db');

const WIDGET_FILE_SUFFIX = '.widgets.js';

/**
 * Charge toutes les définitions de widgets depuis les fichiers
 *   /backend/src/modules/<module>/<module>.widgets.js
 * Retourne un tableau d'objets { type, name?, description?, requiredPermission?, targetContext?, method?, serviceFunction?, moduleName }
 */
function loadWidgetDefsFromCode() {
    const modulesDir = path.join(__dirname, '../modules');
    if (!fs.existsSync(modulesDir)) return [];

    const defs = [];
    const moduleNames = fs
        .readdirSync(modulesDir)
        .filter((name) => {
            try { return fs.statSync(path.join(modulesDir, name)).isDirectory(); }
            catch { return false; }
        });

    for (const moduleName of moduleNames) {
        const widgetFile = path.join(modulesDir, moduleName, `${moduleName}${WIDGET_FILE_SUFFIX}`);
        if (!fs.existsSync(widgetFile)) continue;

        let exported;
        try {
            // eslint-disable-next-line import/no-dynamic-require, global-require
            exported = require(widgetFile);
        } catch (e) {
            console.warn(`[Widgets] Impossible de charger ${widgetFile} : ${e.message}`);
            continue;
        }

        const arr = Array.isArray(exported) ? exported : Array.isArray(exported?.default) ? exported.default : [];
        for (const def of arr) {
            if (!def || !def.type) {
                console.warn(`[Widgets] Définition invalide dans ${widgetFile} (manque "type").`);
                continue;
            }
            defs.push({ ...def, moduleName });
        }
    }
    return defs;
}

/**
 * MASTER UNIQUEMENT.
 * Synchronise la table WidgetDefinition avec les définitions présentes dans le code :
 *  - supprime en DB les widgets absents du code
 *  - upsert les widgets présents dans le code
 * Ne ferme PAS Prisma (la fermeture se fait au niveau appelant si besoin).
 */
async function syncWidgets() {
    console.log('[Widgets] ⛓  Synchronisation en base…');

    const defs = loadWidgetDefsFromCode();

    // Déduplication par "type" (un type = un widget unique globalement)
    const seen = new Set();
    const uniqueDefs = [];
    for (const d of defs) {
        if (seen.has(d.type)) {
            console.warn(`[Widgets] Type dupliqué ignoré: ${d.type}`);
            continue;
        }
        seen.add(d.type);
        uniqueDefs.push(d);
    }

    // 1) Suppression des widgets obsolètes (présents en DB mais absents du code)
    const typesInCode = uniqueDefs.map((d) => d.type);
    if (typesInCode.length === 0) {
        const delAll = await prisma.widgetDefinition.deleteMany({});
        if (delAll.count) console.log(`[Widgets] Supprimé ${delAll.count} widget(s) (aucun widget trouvé dans le code).`);
    } else {
        const del = await prisma.widgetDefinition.deleteMany({
            where: { type: { notIn: typesInCode } },
        });
        if (del.count) console.log(`[Widgets] Supprimé ${del.count} widget(s) obsolète(s).`);
    }

    // 2) Upsert des widgets du code (séquentiel pour éviter les bursts de connexions)
    let upserts = 0;
    for (const def of uniqueDefs) {
        await prisma.widgetDefinition.upsert({
            where: { type: def.type },
            update: {
                name: def.name ?? def.type,
                description: def.description ?? null,
                requiredPermission: def.requiredPermission ?? null,
                targetContext: def.targetContext ?? 'COMPANY',
            },
            create: {
                type: def.type,
                name: def.name ?? def.type,
                description: def.description ?? null,
                requiredPermission: def.requiredPermission ?? null,
                targetContext: def.targetContext ?? 'COMPANY',
            },
        });
        upserts++;
    }

    console.log(`[Widgets] ✅ Sync terminé. ${upserts} définition(s) active(s) en DB.`);
    return { totalInCode: uniqueDefs.length, upserts, removed: typesInCode.length === 0 ? 'ALL' : undefined };
}

/**
 * SHARD/SERVER.
 * Enregistre dynamiquement les routes HTTP des widgets exposées par les modules.
 * Convention:
 *  - Chaque module peut exporter un tableau de définitions dans <module>.widgets.js
 *  - Chaque définition optionnelle : { method = 'GET', serviceFunction = '<nomHandlerDansController>' }
 *  - Route générée: /api/<module>/widgets/<type-en-minuscules>
 */
function methodToRegistrar(app, method = 'GET') {
    const m = String(method).toUpperCase();
    switch (m) {
        case 'POST': return app.post.bind(app);
        case 'PUT': return app.put.bind(app);
        case 'PATCH': return app.patch.bind(app);
        case 'DELETE': return app.delete.bind(app);
        case 'GET':
        default: return app.get.bind(app);
    }
}

async function registryWidgetsRoute(app) {
    const defs = loadWidgetDefsFromCode();
    if (!defs.length) {
        console.log('[Widgets] Aucun widget à enregistrer.');
        return;
    }

    const guards = app.authenticate ? { preHandler: [app.authenticate] } : {};

    let ok = 0, skipped = 0;
    for (const def of defs) {
        const routePath = `/api/${def.moduleName}/widgets/${String(def.type).toLowerCase()}`;
        const method = def.method || 'GET';
        const handlerName = def.serviceFunction; // ex: "getStatsWidget"

        if (!handlerName) {
            //console.warn(`[Widgets] ${def.type}: aucune "serviceFunction" fournie — route ignorée.`);
            skipped++;
            continue;
        }

        let controller;
        try {
            // eslint-disable-next-line import/no-dynamic-require, global-require
            controller = require(path.join(__dirname, '../modules', def.moduleName, `${def.moduleName}.controller.js`));
        } catch (e) {
            console.warn(`[Widgets] ${def.type}: contrôleur introuvable (${def.moduleName}.controller.js) — ${e.message}`);
            skipped++;
            continue;
        }

        const handler = controller?.[handlerName];
        if (typeof handler !== 'function') {
            console.warn(`[Widgets] ${def.type}: fonction "${handlerName}" introuvable dans ${def.moduleName}.controller.js`);
            skipped++;
            continue;
        }

        try {
            const register = methodToRegistrar(app, method);
            register(routePath, guards, async (req, reply) => handler(req, reply));
            ok++;
            console.log(`[Widgets] ➕ Route ${method.toUpperCase()} ${routePath}`);
        } catch (e) {
            console.error(`[Widgets] ❌ Échec d'enregistrement ${routePath}: ${e.message}`);
        }
    }

    console.log(`[Widgets] ✅ Enregistrement terminé. ${ok} route(s) ajoutée(s), ${skipped} ignorée(s).`);
}

module.exports = {
    syncWidgets,
    registryWidgetsRoute,
};
