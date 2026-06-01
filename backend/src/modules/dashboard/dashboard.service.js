// backend/src/modules/dashboard/dashboard.service.js
const prisma = require('../../db');
const { hasPermission: checkUserPermission } = require('../../middleware/auth');
const fs = require('fs');
const path = require('path');
const { getActiveModulesForCompany } = require('../../lib/moduleUtils');

/**
 * Construit l'ensemble des permissions effectives d'un utilisateur
 * pour une entreprise donnée :
 *  - permissions directes utilisateur
 *  - permissions via rôles globaux
 *  - permissions via le RANG d'entreprise (permissionTemplates du Rank)
 */
async function buildEffectiveCompanyPermissions(userId, companyId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            permissions: true,
            roles: { include: { permissions: true } },
        },
    });
    if (!user) return new Set();

    const perms = new Set();

    // 1) Directes + via rôles
    user.permissions.forEach(p => perms.add(p.action));
    user.roles.forEach(role => role.permissions.forEach(p => perms.add(p.action)));

    // ✅ IMPORTANT : contexte GLOBAL / hors entreprise => pas de rang, pas de companyEmployee
    if (!companyId) {
        return perms;
    }

    // 2) Via rang d'entreprise (permissionTemplates)
    const employment = await prisma.companyEmployee.findUnique({
        where: { companyId_userId: { companyId, userId } },
        include: {
            rank: { include: { permissionTemplates: { select: { action: true } } } },
        },
    });

    if (employment?.rank?.permissionTemplates?.length) {
        for (const t of employment.rank.permissionTemplates) {
            const action = t.action?.includes('{companyId}')
                ? t.action.replace('{companyId}', String(companyId))
                : t.action;
            if (action) perms.add(action);
        }
    }

    return perms;
}

/**
 * Récupère les définitions de widgets pour les modules actifs de l’entreprise
 * puis filtre selon les permissions effectives de l’utilisateur.
 */
async function getFilteredWidgetDefinitions(userId, companyId) {
    // Permissions effectives (inclut rang d’entreprise)
    const userPermissions = await buildEffectiveCompanyPermissions(userId, companyId);
    let activeModuleNames = ["dashboard"];

    if (companyId) {
        const activeModules = await getActiveModulesForCompany(companyId);

        activeModuleNames = activeModules.map(am => am.module.name);
        if (!activeModuleNames.includes("dashboard")) activeModuleNames.push("dashboard");
    }

    // On charge toutes les définitions de widgets des modules actifs
    const allWidgetDefinitions = [];
    const modulesDir = path.join(__dirname, '..');

    for (const moduleName of activeModuleNames) {
        const widgetFile = path.join(modulesDir, moduleName, `${moduleName}.widgets.js`);
        if (!fs.existsSync(widgetFile)) continue;

        // IMPORTANT: nettoyer le cache require en dev si besoin
        try {
            delete require.cache[require.resolve(widgetFile)];
        } catch (_) {}

        const moduleWidgets = require(widgetFile);
        if (!Array.isArray(moduleWidgets)) continue;

        // On annote chaque widget avec une route data par convention
        for (const w of moduleWidgets) {
            allWidgetDefinitions.push({
                ...w,
                // ex: /api/products/widgets/declare_product
                dataRoute: `/api/${moduleName}/widgets/${String(w.type || '').toLowerCase()}`,
            });
        }
    }

    // Filtre par permission — remplace {companyId} si présent
    return allWidgetDefinitions.filter(def => {
        const tpl = def.requiredPermission;
        if (!tpl) return true; // widget public
        const required = tpl.includes('{companyId}')
            ? tpl.replace('{companyId}', String(companyId))
            : tpl;
        return checkUserPermission(userPermissions, required);
    });
}

/**
 * Récupère la disposition sauvegardée des widgets pour l’utilisateur dans un contexte entreprise.
 */
async function getUserDashboardLayout({ userId, companyId /*, contextType*/ }) {
    const widgets = await prisma.userWidget.findMany({
        where: { userId, companyId },
        include: { widgetDefinition: true },
    });

    return widgets.map(widget => {
        try {
            return {
                ...widget,
                layout: JSON.parse(widget.layout),
                config: widget.config ? JSON.parse(widget.config) : {},
            };
        } catch {
            return { ...widget, layout: {}, config: {} };
        }
    });
}

/**
 * Sauvegarde la disposition (créations/mises à jour/suppressions) des widgets.
 */
async function saveUserDashboardLayout({ userId, companyId, widgets }) {
    return prisma.$transaction(async (tx) => {
        const existingIds = widgets.map(w => w.id).filter(id => typeof id === 'number');

        // Supprimer les widgets retirés
        await tx.userWidget.deleteMany({
            where: { userId, companyId, id: { notIn: existingIds } },
        });

        const toCreate = widgets.filter(w => typeof w.id !== 'number');
        const toUpdate = widgets.filter(w => typeof w.id === 'number');

        // Mises à jour
        if (toUpdate.length) {
            await Promise.all(
                toUpdate.map(w =>
                    tx.userWidget.update({
                        where: { id: w.id },
                        data: {
                            layout: JSON.stringify(w.layout),
                            config: JSON.stringify(w.config || {}),
                        },
                    }),
                ),
            );
        }

        // Créations
        if (toCreate.length) {
            const defs = await tx.widgetDefinition.findMany({
                where: { type: { in: toCreate.map(w => w.widgetDefinition.type) } },
            });
            const typeToId = new Map(defs.map(d => [d.type, d.id]));

            await tx.userWidget.createMany({
                data: toCreate.map(w => ({
                    userId,
                    companyId,
                    widgetDefinitionId: typeToId.get(w.widgetDefinition.type),
                    layout: JSON.stringify(w.layout),
                    config: JSON.stringify(w.config || {}),
                })),
            });
        }
    });
}

function safeModuleName(name) {
    return String(name || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "");
}

function deepMerge(base, patch) {
    if (!patch || typeof patch !== "object") return base;
    const out = Array.isArray(base) ? [...base] : { ...(base || {}) };

    for (const [k, v] of Object.entries(patch)) {
        const baseVal = base ? base[k] : undefined;

        if (
            v &&
            typeof v === "object" &&
            !Array.isArray(v) &&
            baseVal &&
            typeof baseVal === "object" &&
            !Array.isArray(baseVal)
        ) {
            out[k] = deepMerge(baseVal, v);
        } else {
            out[k] = v;
        }
    }
    return out;
}

function tryLoadModuleSettings(moduleNameRaw) {
    const moduleName = safeModuleName(moduleNameRaw);
    if (!moduleName) return null;

    try {
        // /src/modules/<module>/<module>.settings.js
        const settingsPath = path.join(__dirname, "..", moduleName, `${moduleName}.settings.js`);
        const def = require(settingsPath);

        // Contrat minimal
        if (!def || !def.key || !def.fields || !def.defaults || typeof def.sanitize !== "function") {
            return null;
        }

        return def;
    } catch {
        return null;
    }
}

/**
 * Récupère les paramètres d'une entreprise (nom, clés, etc.)
 */
async function getCompanySettings(companyId) {
    // 1) Structure existante (inchangée)
    const settings = await prisma.company.findUnique({
        where: { id: companyId },
        select: {
            id: true,
            name: true,
            apiKey: true,
            onboardingKey: true,
        },
    });

    if (!settings) throw new Error("Entreprise non trouvée.");

    // 2) Charger CompanySettings.settings (JSON) - upsert pour garantir existence
    const cs = await prisma.companySettings.upsert({
        where: { companyId },
        create: { companyId, settings: {} },
        update: {},
        select: { settings: true },
    });

    const storedSettings = cs?.settings && typeof cs.settings === "object" ? cs.settings : {};

    // 3) Modules actifs
    const active = await getActiveModulesForCompany(companyId);

    // 4) Charger defs settings des modules actifs
    const defs = (active || [])
        .map((a) => {
            const def = tryLoadModuleSettings(a.module.name);
            if (!def) return null;

            return {
                moduleName: a.module.name,
                moduleLabel: a.module.description || a.module.name,
                def,
            };
        })
        .filter(Boolean);

    // 5) Construire settingsForms (format "rank-form-settings like")
    const settingsFieldsByModuleKey = {};
    const settingsDefaultsByModuleKey = {};

    for (const { moduleLabel, def } of defs) {
        settingsFieldsByModuleKey[def.key] = {
            type: "object",
            required: false,
            label: moduleLabel,
            schema: def.fields,
        };

        settingsDefaultsByModuleKey[def.key] = def.defaults;
    }

    const settingsForms = {
        fields: {
            settings: {
                type: "object",
                required: false,
                label: "Paramètres",
                schema: settingsFieldsByModuleKey,
            },
        },
        defaults: {
            settings: settingsDefaultsByModuleKey,
        },
    };

    // 6) Sanitize valeurs existantes par module (optionnel mais recommandé)
    const sanitizedByModule = {};
    for (const { def } of defs) {
        sanitizedByModule[def.key] = def.sanitize(storedSettings?.[def.key]);
    }

    // 7) Resolved (defaults + valeurs)
    const resolvedSettings = deepMerge(settingsForms.defaults.settings, sanitizedByModule);

    // 8) Retour : structure existante + ajouts
    return {
        ...settings,
        settingsForms,
        settingsValues: { settings: sanitizedByModule },
        settingsResolved: { settings: resolvedSettings },
    };
}


/**
 * Met à jour le nom d'une entreprise
 */
async function updateCompany(companyId, name) {
    if (!name || typeof name !== 'string' || name.trim() === '') {
        throw new Error("Le nom de l'entreprise est requis.");
    }

    const updated = await prisma.company.update({
        where: { id: companyId },
        data: { name: name.trim() },
        select: { id: true, name: true },
    });

    return updated;
}

/**
 * Régénère la clé API
 */
async function generateApiKey(companyId) {
    const crypto = require('crypto');
    const newApiKey = crypto.randomBytes(32).toString('hex');
    await prisma.company.update({
        where: { id: companyId },
        data: { apiKey: newApiKey },
    });
    return { apiKey: newApiKey };
}

/**
 * Régénère la clé d’onboarding
 */
async function regenerateOnboardingKey(companyId) {
    const crypto = require('crypto');
    const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true },
    });

    if (!company) throw new Error("Entreprise introuvable.");

    const slug = company.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const randomPart = crypto.randomBytes(16).toString('hex');
    const newKey = `${slug}-${randomPart}`;

    await prisma.company.update({
        where: { id: companyId },
        data: { onboardingKey: newKey },
    });

    return { onboardingKey: newKey };
}

/**
 * Sauvegarde CompanySettings.settings (JSON) avec sanitation par module actif.
 * - body.settings doit être un objet { [moduleKey]: moduleSettingsObject }
 * - on sanitize uniquement les keys connues via defs
 * - on conserve les autres keys existantes (si un ancien module a laissé des données)
 */
async function updateCompanySettings(companyId, incomingSettings) {
    if (!Number.isFinite(companyId)) throw { status: 400, message: "companyId invalide." };
    if (!incomingSettings || typeof incomingSettings !== "object") {
        throw { status: 400, message: "Body invalide: settings attendu (object)." };
    }

    // Modules actifs
    const active = await getActiveModulesForCompany(companyId);

    const defs = (active || [])
        .map((a) => {
            const def = tryLoadModuleSettings(a.module.name);
            if (!def) return null;
            return { moduleName: a.module.name, moduleLabel: a.module.description || a.module.name, def };
        })
        .filter(Boolean);

    // Chargement settings existants
    const current = await prisma.companySettings.upsert({
        where: { companyId },
        create: { companyId, settings: {} },
        update: {},
        select: { settings: true },
    });

    const currentSettings = current?.settings && typeof current.settings === "object" ? current.settings : {};

    // On prend une base = current, puis on remplace/sanitize chaque module connu
    const nextSettings = { ...currentSettings };

    for (const { def } of defs) {
        const rawIncoming = incomingSettings?.[def.key];
        nextSettings[def.key] = def.sanitize(rawIncoming);
    }

    await prisma.companySettings.update({
        where: { companyId },
        data: { settings: nextSettings },
    });

    // Retourner la même structure que getCompanySettings (inchangée) + settingsForms/values/resolved
    // => on réutilise votre getCompanySettings(companyId) existant enrichi
    return getCompanySettings(companyId);
}

module.exports = {
    getFilteredWidgetDefinitions,
    getUserDashboardLayout,
    saveUserDashboardLayout,
    getCompanySettings,
    updateCompany,
    generateApiKey,
    regenerateOnboardingKey,
    updateCompanySettings,
};
