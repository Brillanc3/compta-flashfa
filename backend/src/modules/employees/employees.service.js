// /backend/src/modules/employees/employees.service.js
'use strict';

const prisma = require('../../db');
const path = require('path');
const fs = require('fs');
const {
    startOfWeek, endOfWeek, setYear, setISOWeek, getYear, getISOWeek, isValid,
    startOfISOWeek, endOfISOWeek, getISOWeekYear,
    parseISO, startOfDay, endOfDay
} = require('date-fns');

const { createNotification } = require('../../services/notificationService');
const { getSchemaForModules } = require('../../lib/paymentSchemasLoader');
const { getColumnsForModules } = require('../../lib/columnConfigLoader');
// const { emitPermissionChangeToRankMembers } = require('../admin/admin.service');
const { CompanyEmployeeStatus } = require('@prisma/client');
const { getActiveModulesForCompany } = require('../../lib/moduleUtils');
const discordService = require('../discord/discord.service');


/* ============================================================================
 * Helpers
 * ==========================================================================*/

/**
 * Parse query boolean "true"/"false"
 */
function parseBool(v, defaultValue = false) {
    if (v === undefined || v === null) return defaultValue;
    return String(v) === 'true';
}

/**
 * Parse query date (ISO string). Returns null if invalid.
 */
function parseDateOrNull(v) {
    if (!v) return null;
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Parse "1,2,3" -> [1,2,3] or pass-through array
 */
function parseIntArray(v) {
    if (!v) return null;

    if (Array.isArray(v)) {
        const arr = v.map((x) => Number.parseInt(String(x), 10)).filter(Number.isFinite);
        return arr.length ? arr : null;
    }

    const arr = String(v)
        .split(',')
        .map((x) => Number.parseInt(x.trim(), 10))
        .filter(Number.isFinite);

    return arr.length ? arr : null;
}

/**
 * Parse "ACTIVE,PENDING_LINK" -> ["ACTIVE","PENDING_LINK"] or pass-through array
 */
function parseStringArray(v) {
    if (!v) return null;

    if (Array.isArray(v)) {
        const arr = v.map((x) => String(x).trim()).filter(Boolean);
        return arr.length ? arr : null;
    }

    const arr = String(v)
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);

    return arr.length ? arr : null;
}

/**
 * Charge les permissions d'un user :
 * - all: permissions issues des rôles + permissions directes
 * - direct: permissions directes uniquement (user.permissions)
 */
async function _loadActorPermissionSets(actorUserId, companyId) {
    const uId = Number.parseInt(actorUserId, 10);
    const cId = Number.parseInt(companyId, 10);

    if (!uId || !cId) {
        throw { status: 400, message: "Identifiants invalides." };
    }

    // Remplace les placeholders type {companyId} si tes templates les utilisent.
    const expand = (action) => {
        if (!action) return action;
        return String(action).replace(/\{companyId\}/g, String(cId));
    };

    // Charge l'emploi (rank actif) + les permissions directes user
    const employment = await prisma.companyEmployee.findUnique({
        where: {
            companyId_userId: { companyId: cId, userId: uId },
        },
        include: {
            rank: { include: { permissionTemplates: true } },
            user: { include: { permissions: true } },
        },
    });

    // Si pas d'emploi (ou pas ACTIF), on ne prend pas de permissions de rank.
    // On garde uniquement les permissions directes (utile si ADMIN.* est direct).
    const all = new Set();
    const direct = new Set();

    const userPerms = employment?.user?.permissions || [];
    userPerms.forEach((p) => {
        const action = expand(p.action);
        all.add(action);
        direct.add(action);
    });

    if (employment && employment.status === "ACTIVE" && employment.rank) {
        const rankTemplates = employment.rank.permissionTemplates || [];
        rankTemplates.forEach((pt) => {
            all.add(expand(pt.action));
        });
    }

    return { all, direct };
}

/**
 * Match permission simple avec wildcard '*' (prefix).
 * Ex:
 * - 'ADMIN.*' matche tout
 * - 'COMPANY.12.*' matche 'COMPANY.12.X.Y'
 */
function _matchesPermission(granted, required) {
    if (!granted || !required) return false;
    if (granted === required) return true;

    const starIndex = granted.indexOf('*');
    if (starIndex === -1) return false;

    const prefix = granted.slice(0, starIndex);
    return required.startsWith(prefix);
}

/**
 * Résout un template de permission vers le companyId réel.
 * Ex: 'EMPLOYEES.{companyId}.RANKS.MANAGE' -> 'EMPLOYEES.12.RANKS.MANAGE'
 */
function _resolveCompanyAction(actionTemplate, companyId) {
    return String(actionTemplate).replace('{companyId}', String(companyId));
}

/**
 * Vérifie que l'acteur possède les permissions qu'il essaye d'assigner à un rang.
 * Bypass si ADMIN.* ou COMPANY.${companyId}.*.
 */
async function _assertActorCanAssignPermissions({ actorUserId, companyId, permissionTemplateIds }) {
    if (!actorUserId) return; // middleware ACL en amont

    const ids = Array.isArray(permissionTemplateIds) ? permissionTemplateIds : [];
    if (ids.length === 0) return;

    const { all: actorAllPerms } = await _loadActorPermissionSets(actorUserId, companyId);
    const companyWildcard = `COMPANY.${companyId}.*`;
    if (actorAllPerms.has(companyWildcard) || actorAllPerms.has('ADMIN.*')) {
        return;
    }

    const templates = await prisma.permissionTemplate.findMany({
        where: { id: { in: ids } },
        select: { id: true, action: true },
    });

    // actions attendues (companyId résolu)
    const requiredActions = templates.map((t) => _resolveCompanyAction(t.action, companyId));

    const hasRequired = (required) => {
        // exact
        if (actorAllPerms.has(required)) return true;
        // wildcard match
        for (const g of actorAllPerms) {
            if (_matchesPermission(g, required)) return true;
        }
        return false;
    };

    const missing = requiredActions.filter((a) => !hasRequired(a));

    if (missing.length > 0) {
        const err = new Error(
            "Action non autorisée : vous ne pouvez pas attribuer à un rang des permissions que vous ne possédez pas."
        );
        err.statusCode = 403;
        err.details = { missingPermissions: missing.slice(0, 20) };
        throw err;
    }
}

/**
 * Autorisation hiérarchique optionnelle sur les rangs.
 * Si actorUserId est absent, on considère que les middlewares d'ACL ont déjà validé.
 */
async function _checkRankUpdatePermissionOptional(actorUserId, companyId, targetRankId) {
    if (!actorUserId) return; // on fait confiance au middleware d'ACL en amont
    const RankId = parseInt(targetRankId, 10);
    const actor = await prisma.user.findUnique({
        where: { id: actorUserId },
        include: { roles: { include: { permissions: true } }, permissions: true },
    });

    const actorPermissions = new Set();
    actor?.roles?.forEach((r) => r.permissions.forEach((p) => actorPermissions.add(p.action)));
    actor?.permissions?.forEach((p) => actorPermissions.add(p.action));

    if (actorPermissions.has('ADMIN.*') || actorPermissions.has(`COMPANY.${companyId}.*`)) {
        return; // autorisé
    }

    const actorEmployee = await prisma.companyEmployee.findUnique({
        where: { companyId_userId: { companyId, userId: actorUserId } },
        include: { rank: true },
    });

    const targetRank = await prisma.rank.findUnique({ where: { id: RankId } });

    if (!actorEmployee || !targetRank) {
        throw new Error('Employé ou rang cible introuvable.');
    }

    if (actorEmployee.rank.position <= targetRank.position) {
        throw new Error("Action non autorisée : vous ne pouvez pas modifier un rang d'une position >= à la vôtre.");
    }
}

/**
 * Calcule le détail du salaire pour un employé sur une période, à partir des calculateurs actifs des modules.
 * On s'attend à ce que chaque module expose dans son *.routes.js :
 *   salaryCalculators: [{ key, serviceFunction, drawingDetails: { label, template, templateVariables? } }]
 * et dans son *.service.js la fonction `serviceFunction(employee, dateRange)` qui renvoie :
 *   { key, value, templateVariables? }
 */
async function _calculateSalaryBreakdownCore(employee, activeModules, dateRange) {
    let calculatedSalary = 0;
    const breakdown = [];

    // utilitaire local pour parser la JSON du rang
    const parseCfg = (raw) => {
        if (!raw) return {};
        try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return {}; }
    };
    const rankCfg = parseCfg(employee?.rank?.remunerationConfig) || {};
    const activeModuleNames = activeModules.map((am) => am.module.name);
    employee.__activeModules = activeModuleNames;
    employee.__hasMecano = activeModuleNames.includes('mecano');

    const modulesDir = path.join(__dirname, '..');
    for (const moduleName of activeModuleNames) {
        const routeFile = path.join(modulesDir, moduleName, `${moduleName}.routes.js`);
        if (!fs.existsSync(routeFile)) continue;

        const moduleConfig = require(routeFile);
        if (!Array.isArray(moduleConfig.salaryCalculators)) continue;

        const serviceFile = path.join(modulesDir, moduleName, `${moduleName}.service.js`);
        if (!fs.existsSync(serviceFile)) continue;

        const moduleService = require(serviceFile);

        for (const calculator of moduleConfig.salaryCalculators) {
            const hasRemu = rankCfg[calculator.key] !== undefined;
            const calculatorFn = moduleService[calculator.serviceFunction];
            if (!hasRemu || typeof calculatorFn !== 'function') continue;

            const result = await calculatorFn(employee, dateRange);
            if (!result || result.key !== calculator.key) continue;

            // === Normalisation des variables de template ===
            const vars = { ...(result.templateVariables || {}) };

            // 1) Injecte les valeurs "globales rang" utiles si absentes
            if (vars.commissionRate == null && rankCfg.commissionRate != null) {
                vars.commissionRate = Number(rankCfg.commissionRate);
            }
            if (vars.serviceSalaryPerMinute == null && rankCfg.serviceSalaryPerMinute != null) {
                vars.serviceSalaryPerMinute = Number(rankCfg.serviceSalaryPerMinute);
            }

            // 2) Alias automatiques percent <-> commissionRate
            if (vars.percent == null && vars.commissionRate != null) {
                vars.percent = Number(vars.commissionRate);
            }
            if (vars.commissionRate == null && vars.percent != null) {
                vars.commissionRate = Number(vars.percent);
            }

            calculatedSalary += result.value;

            // On n'inclut dans le breakdown que les lignes avec une valeur > 0
            // pour ne pas encombrer l'UI avec des lignes inutiles à 0$.
            if (result.value > 0) {
                breakdown.push({
                    label: calculator.drawingDetails.label,
                    template: calculator.drawingDetails.template,
                    value: result.value,
                    templateVariables: vars,
                    details: result.details || null,
                });
            }
        }
    }

    let combinedSalary = calculatedSalary;

    const salaryCap = employee.rank?.salaryCap ? parseFloat(employee.rank.salaryCap) : 0;
    const isMissingCap = !salaryCap || salaryCap <= 0;

    const finalSalary = isMissingCap
        ? combinedSalary
        : Math.min(combinedSalary, salaryCap);

    return {
        calculatedSalary,
        finalSalary: Math.round(finalSalary),
        salaryCap,
        isCapped: calculatedSalary > salaryCap && !isMissingCap,
        isMissingCap,
        breakdown,
        dateRange,
    };
}

/**
 * Génère un token numérique à 6 chiffres.
 * Exemple : "483920"
 */
function generate6DigitToken() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function _loadUserAllPermissions(tx, userId) {
    const u = await tx.user.findUnique({
        where: { id: userId },
        include: { roles: { include: { permissions: true } }, permissions: true },
    });

    const all = new Set();
    u?.roles?.forEach((r) => r.permissions.forEach((p) => all.add(p.action)));
    u?.permissions?.forEach((p) => all.add(p.action));
    return all;
}

/**
 * Reset le compte utilisateur lié à un employé.
 * - Si un token actif existe (non expiré) → on le renvoie simplement.
 * - Sinon → un nouveau token est généré pour 15 minutes.
 */
async function resetEmployeeAccount({ companyId, employeeId, actorUserId }) {
    const cId = Number(companyId);
    const eId = Number(employeeId);
    const aId = Number(actorUserId);

    if (!cId || !eId || !aId) {
        throw { status: 400, message: "Identifiants invalides." };
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes

    return prisma.$transaction(async (tx) => {
        // Charger l'employé + son user + son rang (pour la position)
        const employee = await tx.companyEmployee.findUnique({
            where: { id: eId },
            include: { user: true, rank: true },
        });

        if (!employee || employee.companyId !== cId) {
            throw { status: 404, message: "Employé introuvable dans cette entreprise." };
        }

        if (!employee.user) {
            throw { status: 404, message: "Utilisateur lié à l'employé introuvable." };
        }

        if (employee.user.status === 'PENDING_LINK' || employee.user.username.startsWith("pending_")) {
            throw { status: 403, message: "Action non autorisée : Utilisateur toujours en attente. L'utilisateur doit relier son compte depuis la page onboarding." };
        }

        // Charger l'employé acteur (dans cette company) + son rang
        const actorEmployee = await tx.companyEmployee.findUnique({
            where: { companyId_userId: { companyId: cId, userId: aId } },
            include: { rank: true },
        });

        if (!actorEmployee?.rank) {
            throw { status: 403, message: "Action non autorisée : acteur introuvable ou sans rang." };
        }

        // Permissions acteur (pour bypass hiérarchique)
        const actorPerms = await _loadUserAllPermissions(tx, aId);
        const companyWildcard = `COMPANY.${cId}.*`;
        const actorBypass = actorPerms.has("ADMIN.*") || actorPerms.has(companyWildcard);

        // Permissions de la cible (pour interdiction admin / company wildcard)
        const targetUser = employee.user;
        const targetPerms = await _loadUserAllPermissions(tx, targetUser.id);

        // Règle 1: ne peut pas reset un admin
        if (targetPerms.has("ADMIN.*")) {
            throw { status: 403, message: "Action non autorisée : impossible de réinitialiser un administrateur." };
        }

        // Règle 2: ne peut pas reset un user qui a COMPANY.${companyId}.*
        if (targetPerms.has(companyWildcard)) {
            throw { status: 403, message: `Action non autorisée : impossible de réinitialiser un utilisateur ayant ${companyWildcard}.` };
        }

        // Règle 3: hiérarchie de rang (position >= acteur interdit), sauf bypass
        if (!actorBypass) {
            const actorPos = Number(actorEmployee.rank.position ?? 0);
            const targetPos = Number(employee.rank?.position ?? 0);

            if (targetPos >= actorPos) {
                throw {
                    status: 403,
                    message: "Action non autorisée : impossible de réinitialiser un employé dont le rang est de position >= à la vôtre.",
                };
            }
        }

        // Vérifier si un token actif existe déjà
        if (targetUser.tempPasswordToken && targetUser.tempPasswordExpiresAt && targetUser.tempPasswordExpiresAt > now) {
            return {
                alreadyActive: true,
                userId: targetUser.id,
                username: targetUser.username,
                tempPasswordToken: targetUser.tempPasswordToken,
                tempPasswordExpiresAt: targetUser.tempPasswordExpiresAt,
            };
        }

        // Générer le token 6 chiffres
        const token = generate6DigitToken();
        const placeholderPassword = "__RESET__"; // password n'est pas nullable

        // Mise à jour du compte utilisateur
        const updatedUser = await tx.user.update({
            where: { id: targetUser.id },
            data: {
                password: placeholderPassword,
                tempPasswordToken: token,
                tempPasswordExpiresAt: expiresAt,
            },
        });

        return {
            alreadyActive: false,
            userId: updatedUser.id,
            username: updatedUser.username,
            tempPasswordToken: updatedUser.tempPasswordToken,
            tempPasswordExpiresAt: updatedUser.tempPasswordExpiresAt,
        };
    });
}

/* ============================================================================
 * Ranks
 * ==========================================================================*/

async function getRanks(companyId) {
    return prisma.rank.findMany({
        where: { companyId },
        orderBy: { position: 'asc' },
        include: { permissionTemplates: true },
    });
}

function safeModuleName(name) {
    // évite toute tentative de traversal, et garantit un chemin stable
    return String(name).toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

/**
 * getRankFormSettings(companyId)
 * Renvoie la config du formulaire de création/édition de rang :
 * - fields de base (name, position, salaryCap)
 * - schema de remunerationConfig selon les modules actifs
 * - liste des permissionTemplates disponibles (modules actifs)
 */
async function getRankFormSettings(companyId) {
    // Modules actifs (ids + names + description si tu veux l'afficher)
    const active = await getActiveModulesForCompany(companyId);

    const moduleIds = active.map((a) => a.module.id);
    const moduleNames = active.map((a) => a.module.name);

    // Schéma de rémunération en fonction des modules
    const remunerationSchema = getSchemaForModules(moduleNames) || {};

    // Permissions “modèle” disponibles pour ces modules
    const permissionTemplates = await prisma.permissionTemplate.findMany({
        where: { moduleId: { in: moduleIds } },
        select: { id: true, action: true, moduleId: true }, // <-- IMPORTANT
        orderBy: { action: "asc" },
    });

    // moduleId -> meta (descriptions/hierarchy)
    const moduleMetaById = new Map(
        active.map((a) => {
            const moduleNameRaw = a.module.name; // ex: "employees"
            const moduleName = safeModuleName(moduleNameRaw);

            let permsFile = {};
            try {
                // Chemin robuste: .../src/modules/<module>/<module>.permissions.js
                const permissionsPath = path.join(__dirname,
                    '..', moduleName, `${moduleName}.permissions.js`);
                permsFile = require(permissionsPath);
            } catch {
                permsFile = {};
            }

            return [
                a.module.id,
                {
                    name: moduleNameRaw,
                    label: a.module.description || moduleNameRaw,
                    descriptions: permsFile.DESCRIPTIONS || {},
                    hierarchy: permsFile.HIERARCHY || {},
                },
            ];
        })
    );
    const permissionTemplatesEnriched = permissionTemplates.map((p) => {
        const meta = moduleMetaById.get(p.moduleId) || {};
        const label = (meta.descriptions && meta.descriptions[p.action]) || p.action;
        return {
            id: p.id,
            action: p.action,
            label,
            moduleName: meta.name,
            moduleLabel: meta.label,
        };
    });

    return {
        fields: {
            name: { type: "string", required: true, label: "Nom du rang", maxLength: 100 },
            position: { type: "number", required: false, label: "Position" },
            salaryCap: { type: "number", required: false, label: "Plafond salarial", min: 0 },
            remunerationConfig: {
                type: "object",
                required: false,
                label: "Rémunération",
                schema: remunerationSchema,
            },
            permissionTemplateIds: {
                type: "multi-select",
                required: false,
                label: "Permissions (modèles)",
                options: permissionTemplatesEnriched,
            },
        },
        defaults: {
            position: null,
            salaryCap: null,
            remunerationConfig: {},
            permissionTemplateIds: [],
        },
    };
}

/**
 * createRank — nouvelle signature : ({ companyId, payload, actorUserId })
 */
async function createRank({ companyId, payload, actorUserId }) {
    const { name, groupRankId, position, remunerationConfig, permissionTemplateIds = [], salaryCap } = payload || {};

    await _assertActorCanAssignPermissions({
        actorUserId,
        companyId,
        permissionTemplateIds,
    });

    const last = await prisma.rank.findFirst({
        where: { companyId },
        orderBy: { position: 'desc' },
    });

    const nextPosition = last ? last.position + 1 : 1;
    const finalPosition = Number.isFinite(position) ? position : nextPosition;

    return prisma.rank.create({
        data: {
            name,
            groupRankId,
            position: finalPosition,
            remunerationConfig,
            salaryCap,
            companyId,
            permissionTemplates: { connect: permissionTemplateIds.map((id) => ({ id })) },
        },
    });
}

/**
 * updateRank — nouvelle signature : ({ companyId, rankId, payload, actorUserId? })
 */
async function updateRank({ companyId, rankId, payload, actorUserId }) {
    await _checkRankUpdatePermissionOptional(actorUserId, companyId, rankId);

    const { name, groupRankId, position, remunerationConfig, permissionTemplateIds = [], salaryCap } = payload || {};

    await _assertActorCanAssignPermissions({
        actorUserId,
        companyId,
        permissionTemplateIds,
    });

    const updated = await prisma.rank.update({
        where: { id: parseInt(rankId) },
        data: {
            name,
            groupRankId,
            position,
            remunerationConfig,
            salaryCap,
            permissionTemplates: { set: permissionTemplateIds.map(id => ({ id })) },
        },
    });

    const { emitPermissionChangeToRankMembers } = require('../admin/admin.service');
    await emitPermissionChangeToRankMembers(companyId, rankId, {
        reason: 'rank-permissions-updated'
    });

    return updated;
}

/**
 * deleteRank — nouvelle signature : ({ companyId, rankId, actorUserId? })
 */
async function deleteRank({ companyId, rankId, actorUserId }) {
    await _checkRankUpdatePermissionOptional(actorUserId, companyId, rankId);

    const rId = Number(rankId);
    const employeesWithRank = await prisma.companyEmployee.count({ where: { rankId: rId } });
    if (employeesWithRank > 0) {
        throw new Error('Impossible de supprimer ce rang car il est encore assigné à des employés.');
    }
    return prisma.rank.delete({ where: { id: rId } });
}

/**
 * updateRankOrder — nouvelle signature : ({ companyId, order })
 * where order = Array<number> des rankId dans l'ordre voulu
 */
async function updateRankOrder({ companyId, order }) {
    if (!Array.isArray(order)) {
        throw new Error("Le corps de la requête doit être un tableau d'IDs de rangs.");
    }

    return prisma.$transaction(async (tx) => {

        // Étape 1 — Donner une position temporaire UNIQUE à chaque rang
        // Exemple : -id (toujours unique)
        for (const rankId of order) {
            await tx.rank.update({
                where: { id: rankId },
                data: { position: -rankId }   // valeur temporaire unique
            });
        }

        // Étape 2 — Assigner les positions finales propres
        for (let idx = 0; idx < order.length; idx++) {
            const rankId = order[idx];
            await tx.rank.update({
                where: { id: rankId },
                data: { position: idx }
            });
        }
    });
}

/* ============================================================================
 * Employees
 * ==========================================================================*/

/**
 * Récupère la liste des employés en filtrant et en calculant les données
 * pour la semaine sélectionnée.
 */
/*async function getEmployees(companyId, options = {}) {
    const { getExpenseReportStatsForEmployeeList } = require('../comptabilite/comptabilite.service');

    // --- ⬇️ SEULE MODIF: sécurisation year/week -> nombres + fallback ---
    const now = new Date();
    const y = Number.parseInt(options.year, 10);
    const w = Number.parseInt(options.week, 10);
    const safeYear = Number.isInteger(y) ? y : getYear(now);
    const safeWeek = Number.isInteger(w) ? w : getISOWeek(now);

    let dateInWeek = setISOWeek(setYear(new Date(), safeYear), safeWeek);
    if (!isValid(dateInWeek)) {
        // ultime filet de sécurité
        dateInWeek = now;
    }
    const startDate = startOfWeek(dateInWeek, { weekStartsOn: 1 });
    const endDate   = endOfWeek(dateInWeek,   { weekStartsOn: 1 });
    const dateRange = { from: startDate, to: endDate };
    // --- ⬆️ FIN DES MODIFS ---

    const employees = await prisma.companyEmployee.findMany({
        where: {
            companyId,
            createdAt: { lte: endDate },
            OR: [
                { status: 'ACTIVE' },
                { status: 'PENDING_LINK' },
                { status: { in: ['FIRE', 'RESIGNED'] }, statusUpdatedAt: { gte: startDate } }
            ]
        },
        include: {
            user: { select: { id: true, name: true, status: true } },
            rank: true,
        },
        orderBy: { user: { name: 'asc' } },
    });

    const fieldsCsv = Array.isArray(options.fields)
        ? options.fields.join(',')                 // fields=a&fields=b → ['a','b'] → "a,b"
        : (typeof options.fields === 'string' ? options.fields : ''); // fields="a,b" ou undefined

    const fieldsToFetch = new Set(
        fieldsCsv.split(',').map(s => s.trim()).filter(Boolean)
    );

    if (fieldsToFetch.size === 0) {
        return employees;
    }

    // On prépare une Map pour stocker toutes les données enrichies
    const enrichedDataMap = new Map();

    // --- Calcul du Salaire ---
    if (fieldsToFetch.has('salary')) {
        const salaryPromises = employees.map(employee =>
            getSalaryBreakdown(companyId, employee.id, dateRange)
        );
        const salaryResults = await Promise.all(salaryPromises);
        salaryResults.forEach((salaryData, index) => {
            const employeeId = employees[index].id;
            if (!enrichedDataMap.has(employeeId)) enrichedDataMap.set(employeeId, {});
            enrichedDataMap.get(employeeId).salary = salaryData;
        });

    }

    // --- Comptage des Factures ---
    if (fieldsToFetch.has('billCount')) {
        const billCountPromises = employees.map(employee =>
            prisma.bill.count({
                where: {
                    authorId: employee.userId,
                    companyId: companyId,
                    date: { gte: dateRange.from, lte: dateRange.to }
                }
            })
        );
        const billCountResults = await Promise.all(billCountPromises);
        billCountResults.forEach((count, index) => {
            const employeeId = employees[index].id;
            if (!enrichedDataMap.has(employeeId)) enrichedDataMap.set(employeeId, {});
            enrichedDataMap.get(employeeId).billCount = count;
        });
    }

    // --- Statistiques des Notes de Frais ---
    const expenseReportFields = ['expenseReportTotal', 'expenseReportPending', 'expenseReportReimbursed', 'expenseReportRejected'];
    if (expenseReportFields.some(field => fieldsToFetch.has(field))) {
        // On appelle la fonction groupée une seule fois
        const expenseStatsMap = await getExpenseReportStatsForEmployeeList(employees, dateRange);

        // On fusionne les résultats
        for (const [employeeId, stats] of expenseStatsMap.entries()) {
            if (!enrichedDataMap.has(employeeId)) enrichedDataMap.set(employeeId, {});
            Object.assign(enrichedDataMap.get(employeeId), stats);
        }
    }

    // On fusionne les données de base avec les données enrichies
    const finalEmployees = employees.map(employee => ({
        ...employee,
        ...(enrichedDataMap.get(employee.id) || {})
    }));

    return finalEmployees;
}*/

async function getEmployees(companyId, options = {}) {
    // --- ⬇️ SEULE MODIF: sécurisation year/week -> nombres + fallback ---
    const now = new Date();
    const y = Number.parseInt(options.year, 10);
    const w = Number.parseInt(options.week, 10);
    const safeYear = Number.isInteger(y) ? y : getYear(now);
    const safeWeek = Number.isInteger(w) ? w : getISOWeek(now);

    let dateInWeek = setISOWeek(setYear(new Date(), safeYear), safeWeek);
    if (!isValid(dateInWeek)) {
        // ultime filet de sécurité
        dateInWeek = now;
    }
    const startDate = startOfWeek(dateInWeek, { weekStartsOn: 1 });
    const endDate = endOfWeek(dateInWeek, { weekStartsOn: 1 });
    const dateRange = { from: startDate, to: endDate };
    // --- ⬆️ FIN DES MODIFS ---

    const employees = await prisma.companyEmployee.findMany({
        where: {
            companyId,
            createdAt: { lte: endDate },
            OR: [
                { status: 'ACTIVE' },
                { status: 'PENDING_LINK' },
                { status: { in: ['FIRE', 'RESIGNED'] }, statusUpdatedAt: { gte: startDate } }
            ]
        },
        include: {
            user: { select: { id: true, name: true, status: true } },
            rank: true,
        },
        orderBy: { user: { name: 'asc' } },
    });

    const fieldsCsv = Array.isArray(options.fields)
        ? options.fields.join(',')
        : (typeof options.fields === 'string' ? options.fields : '');

    const fieldsToFetch = new Set(
        fieldsCsv.split(',').map(s => s.trim()).filter(Boolean)
    );

    if (fieldsToFetch.size === 0) {
        return employees;
    }

    // On ignore les clés "default" (rendu géré côté frontend via employee.user / employee.rank / employee.status)
    const defaultKeys = new Set(['name', 'rank', 'status']);
    const requestedFields = [...fieldsToFetch].filter((k) => k && !defaultKeys.has(k));

    if (requestedFields.length === 0) {
        return employees;
    }

    const enrichedDataMap = new Map();
    const ensureRow = (employeeId) => {
        if (!enrichedDataMap.has(employeeId)) enrichedDataMap.set(employeeId, {});
        return enrichedDataMap.get(employeeId);
    };

    // 2) Charger les modules actifs pour savoir quoi calculer
    const activeModules = await getActiveModulesForCompany(companyId);
    const moduleNames = activeModules.map((am) => am.module.name);
    const moduleColumns = getColumnsForModules(moduleNames);

    const columnByKey = new Map();
    for (const col of moduleColumns) {
        if (col && col.key) {
            columnByKey.set(col.key, col);
        }
    }

    // Groupage par (moduleName + serviceFunction)
    const groups = new Map(); // groupId -> { moduleName, serviceFunction, keys: string[] }
    const noServiceKeys = [];

    for (const field of requestedFields) {
        const cfg = columnByKey.get(field);
        if (!cfg || !cfg.serviceFunction) {
            noServiceKeys.push(field);
            continue;
        }

        const groupId = `${cfg.moduleName}::${cfg.serviceFunction}`;
        if (!groups.has(groupId)) {
            groups.set(groupId, { moduleName: cfg.moduleName, serviceFunction: cfg.serviceFunction, keys: [] });
        }
        groups.get(groupId).keys.push(field);
    }

    // Pas de serviceFunction => "-"
    if (noServiceKeys.length > 0) {
        for (const emp of employees) {
            const row = ensureRow(emp.id);
            for (const k of noServiceKeys) {
                row[k] = '-';
            }
        }
    }

    const applyError = (keys) => {
        for (const emp of employees) {
            const row = ensureRow(emp.id);
            for (const k of keys) {
                row[k] = 'ERROR';
            }
        }
    };

    const applyMissingAsDash = (keys) => {
        for (const emp of employees) {
            const row = ensureRow(emp.id);
            for (const k of keys) {
                if (row[k] === undefined) row[k] = '-';
            }
        }
    };

    const groupPromises = [...groups.values()].map(async (g) => {
        let serviceModule;
        try {
            serviceModule = require(path.join('..', g.moduleName, `${g.moduleName}.service`));
        } catch (e) {
            applyError(g.keys);
            return;
        }

        const fn = serviceModule?.[g.serviceFunction];
        if (typeof fn !== 'function') {
            applyError(g.keys);
            return;
        }

        let result;
        try {
            result = await fn(employees, dateRange, { companyId, keys: g.keys });
        } catch (e) {
            applyError(g.keys);
            return;
        }

        if (!(result instanceof Map)) {
            applyError(g.keys);
            return;
        }

        for (const emp of employees) {
            const employeeId = emp.id;
            const row = ensureRow(employeeId);

            if (!result.has(employeeId)) {
                for (const k of g.keys) {
                    if (row[k] === undefined) row[k] = '-';
                }
                continue;
            }

            const value = result.get(employeeId);

            if (value === null || value === undefined) {
                for (const k of g.keys) {
                    if (row[k] === undefined) row[k] = '-';
                }
                continue;
            }

            const isPlainObject =
                typeof value === 'object' &&
                !Array.isArray(value) &&
                !(value instanceof Date);

            if (isPlainObject) {
                if (g.keys.length === 1) {
                    const k = g.keys[0];
                    if (Object.prototype.hasOwnProperty.call(value, k)) {
                        row[k] = (value[k] === null || value[k] === undefined) ? '-' : value[k];
                    } else {
                        row[k] = value;
                    }
                } else {
                    for (const k of g.keys) {
                        if (Object.prototype.hasOwnProperty.call(value, k)) {
                            row[k] = (value[k] === null || value[k] === undefined) ? '-' : value[k];
                        } else if (row[k] === undefined) {
                            row[k] = '-';
                        }
                    }
                }
            } else {
                if (g.keys.length === 1) {
                    const k = g.keys[0];
                    row[k] = value;
                } else {
                    applyError(g.keys);
                    return;
                }
            }
        }
    });

    await Promise.all(groupPromises);

    // fallback "-" sur tout ce qui manque encore
    applyMissingAsDash(requestedFields);

    return employees.map(employee => ({
        ...employee,
        ...(enrichedDataMap.get(employee.id) || {})
    }));
}

/**
 * getEmployeeDetails — nouvelle signature : ({ companyId, employeeId, page?, limit? })
 */
async function getEmployeeDetails({ companyId, employeeId, page = 1, limit = 5 }) {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const eId = parseInt(employeeId);

    const employee = await prisma.companyEmployee.findFirst({
        where: { id: eId, companyId },
        include: {
            user: { select: { id: true, name: true, username: true, phoneNumber: true, iban: true, imageUrl: true, status: true } },
            rank: true,
        },
        // Expose linkCode so the manager card can display it without regenerating
        // (linkCode is directly on the companyEmployee record)
    });
    // linkCode & linkCodeCreatedAt are included in the spread below
    if (!employee) throw new Error('Employé non trouvé.');

    const [bills, rankHistory, totalHistoryCount] = await prisma.$transaction([
        prisma.bill.findMany({
            where: { authorId: employee.userId, companyId },
            orderBy: { date: 'desc' },
            take: 5,
        }),
        prisma.rankHistory.findMany({
            where: { companyEmployeeId: eId },
            orderBy: { assignedAt: 'desc' },
            skip: (pageNum - 1) * limitNum,
            take: limitNum,
        }),
        prisma.rankHistory.count({ where: { companyEmployeeId: eId } }),
    ]);

    return {
        ...employee,
        bills,
        rankHistory: {
            data: rankHistory,
            pagination: {
                totalCount: totalHistoryCount,
                currentPage: pageNum,
                totalPages: Math.ceil(totalHistoryCount / limitNum),
            },
        },
    };
}

/**
 * changeEmployeeStatus — nouvelle signature : ({ companyId, employeeId, status })
 */
async function changeEmployeeStatus({ companyId, employeeId, status }) {
    const allowed = ['FIRE', 'RESIGNED', 'ACTIVE', 'PENDING_LINK'];
    if (!allowed.includes(status)) {
        throw new Error('Le statut est invalide.');
    }

    const now = new Date();
    const isLeaving = status === 'FIRE' || status === 'RESIGNED';
    let capturedRankId = null;

    const result = await prisma.$transaction(async (tx) => {
        // 1) Charger l'employé en s'assurant du companyId
        const emp = await tx.companyEmployee.findFirst({
            where: {
                id: parseInt(employeeId, 10),
                companyId,
            },
            include: {
                rank: true, // pour rankName en history
            },
        });
        capturedRankId = emp?.rankId ?? null;

        if (!emp) {
            const e = new Error('Employé introuvable pour cette entreprise.');
            e.statusCode = 404;
            throw e;
        }

        // 2) Mettre à jour le status
        await tx.companyEmployee.update({
            where: { id: emp.id }, // where unique
            data: {
                status,
                statusUpdatedAt: isLeaving ? now : null,
            },
        });

        // 3) Gérer RankHistory
        if (isLeaving) {
            // Clôture toute entrée "active" (leaveAt null) par sécurité
            await tx.rankHistory.updateMany({
                where: {
                    companyEmployeeId: emp.id,
                    leaveAt: null,
                },
                data: {
                    leaveAt: now,
                },
            });
        } else {
            // Optionnel mais conseillé: si on (re)active et qu'il n'y a pas d'historique ouvert, on en crée un
            const open = await tx.rankHistory.findFirst({
                where: { companyEmployeeId: emp.id, leaveAt: null },
                orderBy: { assignedAt: 'desc' },
            });

            if (!open) {
                await tx.rankHistory.create({
                    data: {
                        companyEmployeeId: emp.id,
                        rankId: emp.rankId,
                        rankName: emp.rank?.name ?? 'Rang inconnu',
                        assignedAt: now,
                        leaveAt: null,
                    },
                });
            }
        }

        // 4) Retourner l'employé à jour (et éventuellement son historique)
        return tx.companyEmployee.findUnique({
            where: { id: emp.id },
            include: {
                rank: true,
                rankHistory: { orderBy: { assignedAt: 'desc' } },
            },
        });
    });

    discordService.syncOnStatusChange(companyId, parseInt(employeeId, 10), status, capturedRankId).catch(() => { });

    if (result?.userId) {
        const { ensureCompanyMember, removeCompanyGuildMember } = require('../tchatv2/guild/guild.service');
        if (status === 'ACTIVE') {
            ensureCompanyMember(result.userId, companyId).catch(() => {});
        } else if (status === 'FIRE' || status === 'RESIGNED') {
            removeCompanyGuildMember(result.userId, companyId).catch(() => {});
        }
    }

    return result;
}


/**
 * changeEmployeeRank — nouvelle signature : ({ companyId, employeeId, rankId, actorUserId? })
 */
async function changeEmployeeRank({ companyId, employeeId, rankId, actorUserId }) {
    const cId = Number.parseInt(companyId, 10);
    const eId = Number.parseInt(employeeId, 10);
    const rId = Number.parseInt(rankId, 10);
    let oldRankId = null;

    console.log("-- DEBUG changeEmployeeRank --");
    console.log("\tcId=", cId);
    console.log("\teId=", eId);
    console.log("\trId=", rId);
    console.log("\tactorUserId=", actorUserId);

    if (!Number.isInteger(cId) || cId <= 0) {
        const err = new Error('companyId manquant ou invalide.');
        err.statusCode = 400; throw err;
    }
    if (!Number.isInteger(eId) || eId <= 0) {
        const err = new Error('employeeId manquant ou invalide.');
        err.statusCode = 400; throw err;
    }
    if (!Number.isInteger(rId) || rId <= 0) {
        const err = new Error('rankId manquant ou invalide.');
        err.statusCode = 400; throw err;
    }

    const result = await prisma.$transaction(async (tx) => {
        const employee = await tx.companyEmployee.findUnique({
            where: { id: eId },
            include: { rank: true },
        });
        if (!employee || employee.companyId !== cId) {
            const err = new Error('Employé introuvable dans cette entreprise.');
            err.statusCode = 404;
            throw err;
        }
        oldRankId = employee.rankId;

        // ⚠️ Vérifie que le rang existe et qu'il appartient à la même entreprise
        const newRank = await tx.rank.findFirst({
            where: { id: rId, companyId: cId },
        });
        if (!newRank) {
            const err = new Error("Rang introuvable pour cette entreprise.");
            err.statusCode = 400; throw err;
        }

        // Si déjà sur ce rang → no-op
        if (employee.rankId === rId) {
            return employee;
        }

        /* ============================================================
           NEW: règles hiérarchiques + self-rank
        ============================================================ */
        if (actorUserId) {
            const actorId = Number.parseInt(actorUserId, 10);
            console.log("\tactorId=", actorId);

            // Charge permissions acteur (all + direct)
            const { all: actorAllPerms, direct: actorDirectPerms } = await _loadActorPermissionSets(actorUserId, cId);

            const companyWildcard = `COMPANY.${cId}.*`;
            const isBypass = actorAllPerms.has('ADMIN.*') || actorAllPerms.has(companyWildcard);

            // SELF-RANK interdit sauf COMPANY.${companyId}.* en permission DIRECTE
            // (exigence : direct only)
            if (employee.userId === actorId) {
                const hasDirectCompanyWildcard = actorDirectPerms.has(companyWildcard);
                if (!hasDirectCompanyWildcard) {
                    const err = new Error("Action non autorisée : vous ne pouvez pas modifier votre propre rang.");
                    err.statusCode = 403;
                    throw err;
                }
            }

            // Hiérarchie : si pas bypass, on applique les règles de position
            if (!isBypass) {
                const actorEmployee = await tx.companyEmployee.findUnique({
                    where: { companyId_userId: { companyId: cId, userId: actorId } },
                    include: { rank: true },
                });

                if (!actorEmployee?.rank) {
                    const err = new Error("Action non autorisée : employé acteur introuvable ou sans rang.");
                    err.statusCode = 403;
                    throw err;
                }

                const actorPos = Number(actorEmployee.rank.position ?? 0);
                const targetCurrentPos = Number(employee.rank?.position ?? 0);
                const targetNewPos = Number(newRank.position ?? 0);

                // 1) Interdit de modifier quelqu'un de position >= à toi
                if (targetCurrentPos >= actorPos) {
                    const err = new Error("Action non autorisée : vous ne pouvez pas modifier un employé d'un rang de position >= à la vôtre.");
                    err.statusCode = 403;
                    throw err;
                }

                // 2) Interdit d'assigner un rang de position >= à toi
                if (targetNewPos >= actorPos) {
                    const err = new Error("Action non autorisée : vous ne pouvez pas assigner un rang de position >= à la vôtre.");
                    err.statusCode = 403;
                    throw err;
                }
            }
        }

        // Clôture l'historique en cours (s'il existe)
        await tx.rankHistory.updateMany({
            where: { companyEmployeeId: eId, leaveAt: null },
            data: { leaveAt: new Date() },
        });

        // Met à jour le rang de l'employé
        const updated = await tx.companyEmployee.update({
            where: { id: eId },
            data: { rankId: rId },
        });

        // Ajoute une entrée d'historique pour le nouveau rang
        await tx.rankHistory.create({
            data: {
                companyEmployeeId: eId,
                rankId: rId,
                rankName: newRank.name || 'N/A',
            },
        });

        return updated;
    });

    discordService.syncOnRankChange(cId, eId, oldRankId, rId).catch(() => { });
    return result;
}

/**
 * sendProfileUpdateRequest — nouvelle signature : ({ companyId, employeeId, actorUserName })
 * (companyId non utilisé ici, mais on garde la même convention d'arguments)
 */
async function sendProfileUpdateRequest({ companyId, employeeId, actorUserName }) { // eslint-disable-line no-unused-vars
    const emp = await prisma.companyEmployee.findUnique({
        where: { id: parseInt(employeeId) },
        include: { user: { select: { id: true } } },
    });
    if (!emp) throw new Error('Employé introuvable.');

    await createNotification({
        recipientUserIds: [emp.user.id],
        content: {
            title: 'Mise à jour du profil requise',
            body: `Une action administrative requiert que votre profil soit à jour. Cette demande a été faite par ${actorUserName || 'un responsable'}.`,
        },
        behavior: 'BLOCKING',
        type: 'SYSTEM',
    });
}

/**
 * getUsersForChat — utilitaire pour peupler un select (id, fullName, imageUrl, rank)
 */
async function getUsersForChat(companyId) {
    const cId = Number(companyId);
    if (!Number.isInteger(cId) || cId <= 0) {
        const e = new Error('companyId manquant ou invalide.');
        e.statusCode = 400;
        throw e;
    }

    // On récupère uniquement les employés actifs et ayant un rang
    const rows = await prisma.companyEmployee.findMany({
        where: {
            companyId: cId,

            status: { notIn: ['FIRE', 'RESIGNED', 'PENDING_LINK'] },
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                    imageUrl: true,
                },
            },
            rank: {
                select: {
                    id: true,
                    name: true,
                    position: true,
                },
            },
        },
        orderBy: [
            { rank: { position: 'asc' } },
            { user: { name: 'asc' } },
        ],
    });

    // Normalisation utilisateurs
    const users = [];
    const ranksMap = new Map(); // rankId -> { id, name, position, membersCount }

    for (const r of rows) {
        const u = r.user;
        if (!u?.id) continue;

        const fullName = u.name || `Utilisateur ${u.id}`;
        users.push({
            employeeId: r.id,
            userId: u.id,
            username: u.username || null,
            fullName,
            imageUrl: u.imageUrl || null,
            rankId: r.rank?.id ?? null,
            rankName: r.rank?.name ?? null,
        });

        if (r.rank?.id) {
            const prev = ranksMap.get(r.rank.id);
            if (prev) {
                prev.membersCount += 1;
            } else {
                ranksMap.set(r.rank.id, {
                    id: r.rank.id,
                    name: r.rank.name,
                    position: r.rank.position ?? 0,
                    membersCount: 1,
                });
            }
        }
    }

    const ranks = Array.from(ranksMap.values()).sort((a, b) => {
        if ((a.position ?? 0) !== (b.position ?? 0)) return (a.position ?? 0) - (b.position ?? 0);
        return String(a.name).localeCompare(String(b.name));
    });

    return { users, ranks };
}

const getEmployeeForChat = getUsersForChat;

/**
 * Récupère les CompanyEmployee d'une company, filtrables par date, status, rang, et recherche.
 * On récupère d'abord la liste des rangs, puis on mappe en mémoire (comme demandé).
 */
async function getCompanyEmployees(companyId, options = {}) {
    const includeInactive = parseBool(options.includeInactive, false);
    /**
     * @TODO Fix pour que ça prenne l'intégralitré
     * @type {null}
     */
    const activeAt = null;
    //parseDateOrNull(options.activeAt);

    const search = (options.search || '').toString().trim();
    const rankIds = parseIntArray(options.rankIds);
    const statuses = parseStringArray(options.statuses);

    // 1) Rangs (pris directement)
    const ranks = await prisma.rank.findMany({
        where: { companyId },
        orderBy: { position: 'asc' },
        select: {
            id: true,
            name: true,
            position: true,
        },
    });
    const rankById = new Map(ranks.map((r) => [r.id, r]));

    // 2) Statuts
    const defaultStatuses = includeInactive
        ? null
        : [CompanyEmployeeStatus.ACTIVE, CompanyEmployeeStatus.PENDING_LINK];

    const statusFilter = statuses?.length ? statuses : defaultStatuses;

    // 3) Where principal
    // - Si activeAt est fourni, on scope par rankHistory
    // - Si activeAt n'est pas fourni, on peut garder rankId direct (state current)
    const where = {
        companyId,
        ...(statusFilter ? { status: { in: statusFilter } } : {}),
        ...(search
            ? {
                OR: [
                    { user: { name: { contains: search, mode: 'insensitive' } } },
                    { user: { username: { contains: search, mode: 'insensitive' } } },
                ],
            }
            : {}),
        ...(activeAt
            ? {
                // "Présent à la date" basé sur RankHistory
                rankHistory: {
                    some: {
                        assignedAt: { lte: activeAt },
                        OR: [{ leaveAt: null }, { leaveAt: { gt: activeAt } }],
                        ...(rankIds ? { rankId: { in: rankIds } } : {}),
                    },
                },
            }
            : {
                // Pas de date => filtre éventuel sur rang courant
                ...(rankIds ? { rankId: { in: rankIds } } : {}),
            }),
    };

    const employees = await prisma.companyEmployee.findMany({
        where,
        orderBy: [{ status: 'asc' }, { id: 'asc' }],
        select: {
            id: true,
            status: true,
            createdAt: true,
            statusUpdatedAt: true,
            rankId: true, // rang courant (utile si activeAt absent)
            userId: true,
            user: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                    status: true,
                },
            },

            // Si activeAt fourni, on récupère le rang effectif à cette date
            ...(activeAt
                ? {
                    rankHistory: {
                        where: {
                            assignedAt: { lte: activeAt },
                            OR: [{ leaveAt: null }, { leaveAt: { gt: activeAt } }],
                        },
                        orderBy: { assignedAt: 'desc' }, // le plus récent à la date
                        take: 1,
                        select: {
                            rankId: true,
                            rankName: true,
                            assignedAt: true,
                            leaveAt: true,
                        },
                    },
                }
                : {}),
        },
    });

    // 4) Enrich rank + effectiveRankId
    const enriched = employees.map((e) => {
        const effectiveRankId = activeAt
            ? (e.rankHistory?.[0]?.rankId ?? null)
            : (e.rankId ?? null);

        return {
            ...e,
            effectiveRankId,
            rank: effectiveRankId ? (rankById.get(effectiveRankId) || null) : null,

            // On ne veut pas exposer toute l'historique ici (on l'a juste utilisé pour calculer)
            ...(activeAt ? { rankHistory: undefined } : {}),
        };
    });

    return {
        data: enriched,
        meta: {
            companyId,
            filters: {
                includeInactive,
                activeAt: activeAt ? activeAt.toISOString() : null,
                search: search || null,
                rankIds: rankIds || null,
                statuses: statusFilter || null,
            },
            ranks,
        },
    };
}


/* ============================================================================
 * Salary / Columns / Permissions / Widgets
 * ==========================================================================*/

/**
 * getAvailablePermissionTemplates — compatible 2 formes :
 *  - (companyId) → retourne toutes les permissions des modules actifs
 *  - (companyId, actorUserId) → applique un filtre "délégable" si besoin
 */
async function getAvailablePermissionTemplates(companyId, actorUserId) {
    const activeCompanyModules = await getActiveModulesForCompany(companyId);
    if (activeCompanyModules.length === 0) return [];

    const activeModuleIds = activeCompanyModules.map((cm) => cm.module.id);

    const templates = await prisma.permissionTemplate.findMany({
        where: { moduleId: { in: activeModuleIds } },
        select: { id: true, action: true, moduleId: true }, // <-- IMPORTANT
        orderBy: { action: "asc" },
    });

    // moduleId -> meta (descriptions/hierarchy)
    const moduleMetaById = new Map(
        activeCompanyModules.map((cm) => {
            const moduleNameRaw = cm.module.name;
            const moduleName = safeModuleName(moduleNameRaw);

            let permsFile = {};
            try {
                // même structure que ton patch getRankFormSettings
                const permissionsPath = path.join(__dirname, "..", moduleName, `${moduleName}.permissions.js`);
                permsFile = require(permissionsPath);
            } catch {
                permsFile = {};
            }

            return [
                cm.module.id,
                {
                    name: moduleNameRaw,
                    label: cm.module.description || moduleNameRaw,
                    descriptions: permsFile.DESCRIPTIONS || {},
                    hierarchy: permsFile.HIERARCHY || {},
                },
            ];
        })
    );

    const normalizeCompanyIdToken = (action) =>
        String(action).replace(/\.[0-9]+\./, ".{companyId}.");

    const templatesEnriched = templates.map((t) => {
        const meta = moduleMetaById.get(t.moduleId) || {};
        const actionNorm = normalizeCompanyIdToken(t.action);

        const label =
            (meta.descriptions && (meta.descriptions[t.action] || meta.descriptions[actionNorm])) ||
            t.action;

        return {
            id: t.id,
            action: t.action,
            label,
            moduleName: meta.name,
            moduleLabel: meta.label,
        };
    });

    // Si pas d'actor -> on renvoie tout
    if (!actorUserId) return templatesEnriched;

    const manager = await prisma.user.findUnique({
        where: { id: actorUserId },
        include: { permissions: true },
    });

    const perms = new Set(manager?.permissions?.map((p) => p.action) || []);
    if (perms.has("ADMIN.*") || perms.has(`COMPANY.${companyId}.*`)) return templatesEnriched;

    // logique fine à implémenter au besoin (par défaut: vide)
    return [];
}


async function getRemunerationSchema(companyId) {
    const activeModules = await getActiveModulesForCompany(companyId);
    const names = activeModules.map((am) => am.module.name);
    return getSchemaForModules(names);
}

async function getAvailableColumns(companyId) {
    const defaults = [
        { key: 'name', label: 'Nom', isDefault: true, moduleName: 'employees' },
        { key: 'rank', label: 'Rang', isDefault: true, moduleName: 'employees' },
        { key: 'status', label: 'Statut', isDefault: true, moduleName: 'employees' },
    ];

    const activeModules = await getActiveModulesForCompany(companyId);
    const names = activeModules.map((am) => am.module.name);
    const moduleColumns = getColumnsForModules(names);
    return [...defaults, ...moduleColumns];
}

/**
 * getSalaryBreakdown(companyId, employeeId, { from, to }, preloaded?)
 */
async function getSalaryBreakdown(companyId, employeeId, dateRange, preloaded = {}) {
    // 1) companyId/employeeId sûrs
    const cId = Number.parseInt(companyId, 10);
    const eId = Number.parseInt(
        employeeId ?? preloaded?.employee?.id ?? preloaded?.employeeId,
        10
    );

    if (!Number.isInteger(cId) || cId <= 0) {
        const err = new Error('companyId manquant ou invalide.');
        err.statusCode = 400;
        throw err;
    }
    if (!Number.isInteger(eId) || eId <= 0) {
        const err = new Error('employeeId manquant ou invalide.');
        err.statusCode = 400;
        throw err;
    }

    // 2) normalisation du dateRange (accepte string ISO ou Date)
    const from = dateRange?.from instanceof Date ? dateRange.from : new Date(dateRange?.from);
    const to = dateRange?.to instanceof Date ? dateRange.to : new Date(dateRange?.to);

    if (Number.isNaN(from?.getTime()) || Number.isNaN(to?.getTime())) {
        const err = new Error('Plage de dates invalide (from/to).');
        err.statusCode = 400;
        throw err;
    }

    // 3) charge l'employé de façon sûre
    const employee =
        preloaded.employee ||
        (await prisma.companyEmployee.findUnique({
            where: { id: eId },
            include: { rank: true },
        }));

    if (!employee || employee.companyId !== cId) {
        throw new Error('Employé introuvable dans cette entreprise.');
    }

    // 4) modules actifs
    const activeModules =
        preloaded.activeModules || (await getActiveModulesForCompany(cId));

    // 5) calcule le salaire
    const result = await _calculateSalaryBreakdownCore(employee, activeModules, { from, to });

    // 6) override par semaine si défini
    const isoWeek = getISOWeek(from);
    const isoYear = getISOWeekYear(from);
    const override = await prisma.employeeSalaryOverride.findUnique({
        where: { companyEmployeeId_year_week: { companyEmployeeId: eId, year: isoYear, week: isoWeek } },
    });
    if (override) {
        result.finalSalary = Math.round(override.amount);
        result.isOverridden = true;
        result.salaryOverride = override.amount;
    } else {
        result.isOverridden = false;
        result.salaryOverride = null;
    }

    return result;
}

/**
 * Définit (upsert) ou supprime (amount=null) un override de salaire pour un employé sur une semaine ISO.
 */
async function setEmployeeSalaryOverride({ companyId, employeeId, year, week, amount }) {
    const cId = Number.parseInt(companyId, 10);
    const eId = Number.parseInt(employeeId, 10);
    const y = Number.parseInt(year, 10);
    const w = Number.parseInt(week, 10);

    if (!Number.isInteger(cId) || cId <= 0) throw Object.assign(new Error('companyId invalide.'), { statusCode: 400 });
    if (!Number.isInteger(eId) || eId <= 0) throw Object.assign(new Error('employeeId invalide.'), { statusCode: 400 });
    if (!Number.isInteger(y) || y <= 0) throw Object.assign(new Error('year invalide.'), { statusCode: 400 });
    if (!Number.isInteger(w) || w < 1 || w > 53) throw Object.assign(new Error('week invalide.'), { statusCode: 400 });

    const employee = await prisma.companyEmployee.findFirst({ where: { id: eId, companyId: cId } });
    if (!employee) throw Object.assign(new Error('Employé introuvable dans cette entreprise.'), { statusCode: 404 });

    // amount=null → suppression de l'override
    if (amount === null || amount === undefined) {
        await prisma.employeeSalaryOverride.deleteMany({
            where: { companyEmployeeId: eId, year: y, week: w },
        });
        return { deleted: true };
    }

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 0) throw Object.assign(new Error('Montant invalide.'), { statusCode: 400 });

    return prisma.employeeSalaryOverride.upsert({
        where: { companyEmployeeId_year_week: { companyEmployeeId: eId, year: y, week: w } },
        update: { amount: amt },
        create: { companyEmployeeId: eId, year: y, week: w, amount: amt },
    });
}

/**
 * Masse salariale totale sur une période.
 */
/*async function getTotalPayrollForPeriod(companyId, dateRange) {
    const employees = await prisma.companyEmployee.findMany({
        where: { companyId },
        include: { rank: true },
    });
    if (!employees.length) return 0;

    const activeModules = await prisma.companyModule.findMany({
        where: { companyId },
        include: { module: true },
    });

    const isMecanoActive = activeModules.some((m) => m.module?.name === "mecano");
    let billsByAuthorId = null;
    if (isMecanoActive) {
        const employeesWithCfg = employees.filter((e) => {
            const cfg = e.rank?.remunerationConfig;
            return cfg && typeof cfg === "object" && cfg.customVehicleRemuneration !== undefined;
        });

        if (employeesWithCfg.length) {
            const customBills = await prisma.bill.findMany({
                where: {
                    companyId,
                    status: { in: ["PAID_CASH", "PAID_CARD"] },
                    reason: { contains: "Custom véhicule" },
                    date: { gte: dateRange.from, lte: dateRange.to },
                },
                select: { id: true, authorId: true, amount: true, reason: true, status: true, date: true },
            });

            billsByAuthorId = new Map();
            for (const b of customBills) {
                if (!b.authorId) continue;
                if (!billsByAuthorId.has(b.authorId)) billsByAuthorId.set(b.authorId, []);
                billsByAuthorId.get(b.authorId).push(b);
            }
        }
    }

    if (billsByAuthorId) {
        for (const e of employees) {
            e.__prefetchedCustomVehicleBills = billsByAuthorId.get(e.userId) || [];
        }
    }

    const results = await Promise.all(
        employees.map((e) => getSalaryBreakdown(companyId, e.id, dateRange, { employee: e, activeModules })),
    );
    if(companyId == 3) {
        console.log("getTotalPayrollForPeriod catch", dateRange);
        console.log("results :");
        console.log(results);
    }
    return results.reduce((sum, s) => sum + (s?.finalSalary || 0), 0);
}*/

async function getTotalPayrollForPeriod(companyId, dateRange) {
    const from = dateRange?.from instanceof Date ? dateRange.from : new Date(dateRange?.from);
    const to = dateRange?.to instanceof Date ? dateRange.to : new Date(dateRange?.to);

    if (Number.isNaN(from?.getTime()) || Number.isNaN(to?.getTime())) {
        const err = new Error('Plage de dates invalide (from/to).');
        err.statusCode = 400;
        throw err;
    }

    const employees = await prisma.companyEmployee.findMany({
        where: {
            companyId,
            rankHistory: {
                some: {
                    assignedAt: { lte: to },
                    OR: [
                        { leaveAt: null },
                        { leaveAt: { gt: from } },
                    ],
                },
            },
        },
        include: { rank: true },
    });

    if (!employees.length) return 0;

    const activeModules = await getActiveModulesForCompany(companyId);

    const isMecanoActive = activeModules.some((m) => m.module?.name === "mecano");
    let billsByAuthorId = null;

    if (isMecanoActive) {
        const employeesWithCfg = employees.filter((e) => {
            const cfg = e.rank?.remunerationConfig;
            return cfg && typeof cfg === "object" && cfg.customVehicleRemuneration !== undefined;
        });

        if (employeesWithCfg.length) {
            const customBills = await prisma.bill.findMany({
                where: {
                    companyId,
                    status: { in: ["PAID_CASH", "PAID_CARD"] },
                    reason: { contains: "Custom véhicule" },
                    date: { gte: from, lte: to },
                },
                select: { id: true, authorId: true, amount: true, reason: true, status: true, date: true },
            });

            billsByAuthorId = new Map();
            for (const b of customBills) {
                if (!b.authorId) continue;
                if (!billsByAuthorId.has(b.authorId)) billsByAuthorId.set(b.authorId, []);
                billsByAuthorId.get(b.authorId).push(b);
            }
        }
    }

    if (billsByAuthorId) {
        for (const e of employees) {
            e.__prefetchedCustomVehicleBills = billsByAuthorId.get(e.userId) || [];
        }
    }

    const results = await Promise.all(
        employees.map((e) => getSalaryBreakdown(companyId, e.id, { from, to }, { employee: e, activeModules })),
    );

    return results.reduce((sum, s) => sum + (s?.finalSalary || 0), 0);
}

/**
 * Widget "Mon Salaire" — compatible 2 formes :
 *  - getWidgetData_MySalary({ companyId, userId, config })
 *  - getWidgetData_MySalary(userId, companyId, config)  // rétro-compat
 */
async function getWidgetData_MySalary(a, b, c) {
    // Détection de la signature
    const isNewSig = typeof a === 'object' && a !== null;
    const userId = isNewSig ? a.userId : a;
    const companyId = isNewSig ? a.companyId : b;
    const config = (isNewSig ? a.config : c) || {};

    const employee = await prisma.companyEmployee.findUnique({
        where: { companyId_userId: { userId, companyId } },
    });
    if (!employee) return null;

    const year = config.year ?? getISOWeekYear(new Date());
    const week = config.week ?? getISOWeek(new Date());

    const isoYearAnchor = new Date(year, 0, 4);
    const dateInWeek = setISOWeek(isoYearAnchor, week);

    const startDate = startOfISOWeek(dateInWeek);
    const endDate = endOfISOWeek(dateInWeek);

    const dateRange = { from: startDate, to: endDate };

    return getSalaryBreakdown(companyId, employee.id, dateRange);
}

/* ============================================================================
 * Onboarding util
 * ==========================================================================*/

/**
 * Lie un user à une company avec rang "par défaut" (créé si absent) — utilisé côté onboarding.
 * Conçu pour être appelé DANS une transaction Prisma.
 */
async function addUserToCompanyWithRank(tx, userId, companyId) {
    let defaultRank = await tx.rank.findFirst({
        where: { companyId },
        orderBy: { position: 'asc' },
    });

    if (!defaultRank) {
        defaultRank = await tx.rank.create({
            data: {
                name: 'Recrue',
                position: 1,
                companyId,
                remunerationConfig: { commissionRate: 0, serviceSalaryPerMinute: 0 },
            },
        });
    }

    const employee = await tx.companyEmployee.create({
        data: {
            company: { connect: { id: companyId } },
            user: { connect: { id: userId } },
            rank: { connect: { id: defaultRank.id } },
            status: 'PENDING_LINK',
        },
    });

    await tx.rankHistory.create({
        data: {
            companyEmployeeId: employee.id,
            rankId: defaultRank.id,
            rankName: defaultRank.name,
        },
    });

    return employee;
}

/**
 * Changement de rang spécial pour le handler FiveM.
 * Logique :
 * - Si assignedAt + 15 minutes >= maintenant => CONSOLIDATION (mise à jour de l'entrée)
 * - Sinon => FERMETURE et NOUVELLE entrée
 */
async function changeEmployeeRankFromHandler({ companyId, employeeId, rankId }) {
    const cId = Number(companyId);
    const eId = Number(employeeId);
    const rId = Number(rankId);

    const fifteenMs = 15 * 60 * 1000;

    return prisma.$transaction(async (tx) => {

        // 1. Charger employé
        const employee = await tx.companyEmployee.findUnique({
            where: { id: eId },
            include: { rank: true },
        });

        if (!employee || employee.companyId !== cId) {
            throw new Error('Employé introuvable pour cette entreprise.');
        }

        if (employee.rankId === rId) {
            return employee;
        }

        // 2. Charger nouveau rang
        const newRank = await tx.rank.findFirst({
            where: { id: rId, companyId: cId },
        });

        if (!newRank) {
            throw new Error("Rang introuvable pour cette entreprise.");
        }

        // 3. Charger dernier historique
        const last = await tx.rankHistory.findFirst({
            where: { companyEmployeeId: eId },
            orderBy: { assignedAt: 'desc' }
        });

        const now = new Date();

        // Mise à jour rang de l'employé
        await tx.companyEmployee.update({
            where: { id: eId },
            data: { rankId: rId },
        });

        // --- CAS 1 : PAS D'HISTORIQUE → création simple ---
        if (!last) {
            await tx.rankHistory.create({
                data: {
                    companyEmployeeId: eId,
                    rankId: rId,
                    rankName: newRank.name,
                },
            });
            return;
        }

        // --- CAS 2 : CONSOLIDATION ---
        const seuil = new Date(last.assignedAt).getTime() + fifteenMs;

        if (now.getTime() <= seuil) {
            // On garde assignedAt et leaveAt comme ils sont
            // On met juste rankId + rankName
            await tx.rankHistory.update({
                where: { id: last.id },
                data: {
                    rankId: rId,
                    rankName: newRank.name,
                    // leaveAt reste tel quel (= null car période en cours)
                }
            });
            return;
        }

        // --- CAS 3 : NOUVELLE PÉRIODE ---
        // On ferme l'ancienne
        await tx.rankHistory.update({
            where: { id: last.id },
            data: {
                leaveAt: now,
            }
        });

        // On crée une nouvelle entrée propre
        await tx.rankHistory.create({
            data: {
                companyEmployeeId: eId,
                rankId: rId,
                rankName: newRank.name,
                // assignedAt = now par défaut
            },
        });
    });
}

function _decimalToNumber(v) {
    if (v === null || v === undefined) return 0;
    if (typeof v === "number") return v;
    if (typeof v === "string") return Number(v) || 0;
    if (typeof v?.toNumber === "function") return v.toNumber();
    if (typeof v?.toString === "function") return Number(v.toString()) || 0;
    return Number(v) || 0;
}



/**
 * Widget "Mon Chiffre d'Affaire" — compatible 2 formes :
 *  - getWidgetData_MyTurnover({ companyId, userId, config })
 *  - getWidgetData_MyTurnover(userId, companyId, config)
 *
 * config:
 *  - mode: "WEEK" | "DAY" (défaut WEEK)
 *  - year/week (si WEEK)
 *  - date: "YYYY-MM-DD" (si DAY)
 */
async function getWidgetData_MyTurnover(a, b, c) {
    const isNewSig = typeof a === "object" && a !== null;
    const userId = isNewSig ? a.userId : a;
    const companyId = isNewSig ? a.companyId : b;
    const config = (isNewSig ? a.config : c) || {};

    const employee = await prisma.companyEmployee.findUnique({
        where: { companyId_userId: { userId, companyId } },
    });
    if (!employee) return null;

    const mode = String(config.mode || "WEEK").toUpperCase();

    let startDate;
    let endDate;
    let period;

    if (mode === "DAY") {
        const parsed = parseISO(String(config.date || ""));
        if (!isValid(parsed)) {
            throw { status: 400, message: "Date invalide (attendu: YYYY-MM-DD)." };
        }

        startDate = startOfDay(parsed);
        endDate = endOfDay(parsed);

        period = {
            mode: "DAY",
            date: String(config.date),
            from: startDate,
            to: endDate,
        };
    } else {
        const year = config.year ?? getISOWeekYear(new Date());
        const week = config.week ?? getISOWeek(new Date());

        const isoYearAnchor = new Date(year, 0, 4);
        const dateInWeek = setISOWeek(isoYearAnchor, week);

        startDate = startOfISOWeek(dateInWeek);
        endDate = endOfISOWeek(dateInWeek);

        period = {
            mode: "WEEK",
            year,
            week,
            from: startDate,
            to: endDate,
        };
    }

    const where = {
        companyId,
        authorId: userId,
        date: { gte: startDate, lte: endDate },
    };

    const rows = await prisma.bill.groupBy({
        by: ["status"],
        where,
        _sum: { amount: true },
        _count: { id: true },
    });

    const byStatus = rows
        .map((r) => ({
            status: r.status,
            amount: _decimalToNumber(r._sum?.amount),
            count: r._count?.id || 0,
        }))
        .sort((a, b) => (b.amount || 0) - (a.amount || 0));

    const isPaid = (status) => String(status || "").startsWith("PAID");
    const isCanceled = (status) => status === "CANCELED";

    const paidRows = byStatus.filter(s => isPaid(s.status));
    const canceledRows = byStatus.filter(s => isCanceled(s.status));
    const pendingRows = byStatus.filter(s => !isPaid(s.status) && !isCanceled(s.status));

    const paidAmount = paidRows.reduce((acc, s) => acc + (s.amount || 0), 0);
    const paidCount = paidRows.reduce((acc, s) => acc + (s.count || 0), 0);
    const canceledAmount = canceledRows.reduce((acc, s) => acc + (s.amount || 0), 0);
    const canceledCount = canceledRows.reduce((acc, s) => acc + (s.count || 0), 0);
    const pendingAmount = pendingRows.reduce((acc, s) => acc + (s.amount || 0), 0);
    const pendingCount = pendingRows.reduce((acc, s) => acc + (s.count || 0), 0);

    // Prestation partenaire (si config.includePartnerServices)
    let partnerAmount = 0;
    let partnerCount = 0;
    if (config.includePartnerServices) {
        const partnerRows = await prisma.pawnshopPurchase.groupBy({
            by: ["status"],
            where: {
                companyId,
                createdByEmployee: { userId },
                createdAt: { gte: startDate, lte: endDate },
            },
            _sum: { totalResaleAmount: true },
            _count: { id: true },
        });
        partnerAmount = partnerRows.reduce((acc, r) => acc + _decimalToNumber(r._sum?.totalResaleAmount), 0);
        partnerCount = partnerRows.reduce((acc, r) => acc + (r._count?.id || 0), 0);
    }

    return {
        period,
        totals: {
            amount: paidAmount + partnerAmount,
            count: paidCount + partnerCount,
            paidAmount,
            paidCount,
            pendingAmount,
            pendingCount,
            canceledAmount,
            canceledCount,
            partnerAmount,
            partnerCount,
        },
        byStatus,
    };
}


/* ============================================================================
 * Exports
 * ==========================================================================*/

/* ============================================================================
 * Link Code
 * ==========================================================================*/

/**
 * Génère un code de liaison unique (8 chars) pour un CompanyEmployee PENDING_LINK.
 * Le dirigeant donne ce code à l'employé IRL.
 * Le code est stocké sur CompanyEmployee.linkCode (null après utilisation).
 */
async function generateLinkCode({ companyId, employeeId }) {
    const cId = parseInt(companyId, 10);
    const eId = parseInt(employeeId, 10);

    const employee = await prisma.companyEmployee.findFirst({
        where: { id: eId, companyId: cId },
        include: { user: { select: { name: true } } },
    });

    if (!employee) {
        const e = new Error('Employé introuvable.');
        e.statusCode = 404;
        throw e;
    }

    if (employee.status !== 'PENDING_LINK') {
        const e = new Error('Le code de liaison ne peut être généré que pour un employé en attente de liaison.');
        e.statusCode = 400;
        throw e;
    }

    // Génère un code 8 chars alphanumérique majuscule, unique en base
    const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans I, O, 0, 1 (ambigus)
    let linkCode;
    let attempts = 0;
    do {
        linkCode = Array.from({ length: 8 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
        const existing = await prisma.companyEmployee.findUnique({ where: { linkCode } });
        if (!existing) break;
        attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
        const e = new Error('Impossible de générer un code unique. Réessayez.');
        e.statusCode = 500;
        throw e;
    }

    const now = new Date();
    await prisma.companyEmployee.update({
        where: { id: eId },
        data: { linkCode, linkCodeCreatedAt: now },
    });

    return { linkCode, linkCodeCreatedAt: now, employeeName: employee.user?.name ?? 'Employé' };
}

/**
 * Consomme un code de liaison : fusionne le compte temp (pending_XXXXX)
 * avec le compte réel (l'utilisateur actuellement connecté).
 *
 * Préconditions :
 *   - currentUser.characterId === null && currentUser.discordId === null
 *   - CompanyEmployee avec linkCode trouvé, status = PENDING_LINK
 *
 * La logique de fusion est identique à onboarding.linkAccount :
 *   1. Tombstone l'identité du compte temp
 *   2. Réaffecte toutes les relations via reassignUserData
 *   3. Copie characterId + discordId du temp → réel
 *   4. Supprime le compte temp
 *   5. Active le CompanyEmployee (userId = réel, status = ACTIVE, linkCode = null)
 */
async function useLinkCode({ currentUserId, code }) {
    // 1. Charger l'utilisateur courant
    const currentUser = await prisma.user.findUnique({ where: { id: currentUserId } });
    if (!currentUser) {
        const e = new Error('Utilisateur introuvable.');
        e.statusCode = 404;
        throw e;
    }

    if (currentUser.characterId !== null || currentUser.discordId !== null) {
        const e = new Error('Votre compte est déjà lié à une identité IG.');
        e.statusCode = 403;
        throw e;
    }

    // 2. Trouver le CompanyEmployee par code
    const employee = await prisma.companyEmployee.findUnique({
        where: { linkCode: code },
        include: { user: true },
    });

    if (!employee || employee.status !== 'PENDING_LINK') {
        const e = new Error('Code invalide ou déjà utilisé.');
        e.statusCode = 400;
        throw e;
    }

    const tempUser = employee.user;
    if (!tempUser) {
        const e = new Error('Compte temporaire introuvable.');
        e.statusCode = 404;
        throw e;
    }

    // Helpers de fusion (copiés depuis onboarding.service)
    const log = (...args) => console.log('[link-code]', ...args);

    async function reassignUserData(tx, oldId, newId) {
        const map = [
            ['companyEmployee', 'userId'],
            ['conversationUserMember', 'userId'],
            ['conversationUserMember', 'invitedById'],
            ['message', 'authorId'],
            ['conversation', 'ticketAdminId'],
            ['bill', 'authorId'],
            ['expenseReport', 'authorId'],
            ['expenseReport', 'reviewerId'],
            ['transaction', 'createdById'],
            ['transaction', 'updatedById'],
            ['notification', 'senderId'],
            ['notificationRecipient', 'userId'],
            ['calendarEvent', 'authorId'],
            ['calendarEventAttendee', 'userId'],
            ['userWidget', 'userId'],
        ];
        for (const [model, column] of map) {
            try {
                const r = await tx[model].updateMany({
                    where: { [column]: oldId },
                    data: { [column]: newId },
                });
                if (r.count) log(` - ${model}.${column}: ${r.count} réaffectée(s)`);
            } catch (e) {
                log(` - WARN: ${model}.${column} ignoré (${e?.message || e})`);
            }
        }
    }

    // 3. Transaction de fusion
    await prisma.$transaction(async (tx) => {
        // a. Tombstone identité du compte temp pour éviter les collisions unique
        try {
            await tx.user.update({
                where: { id: tempUser.id },
                data: { discordId: `TEMP#${tempUser.id}#${tempUser.discordId}` },
            });
        } catch (e) {
            log('WARN: tombstone discordId échoué:', e?.message);
        }

        // b. Réaffecter les relations (sauf le CompanyEmployee qui sera mis à jour manuellement)
        await reassignUserData(tx, tempUser.id, currentUserId);

        // c. Copier l'identité IG du temp → réel
        await tx.user.update({
            where: { id: currentUserId },
            data: {
                characterId: tempUser.characterId,
                discordId: tempUser.discordId,
            },
        });
        log(`characterId=${tempUser.characterId} discordId=${tempUser.discordId} copiés sur user#${currentUserId}`);

        // d. Supprimer le compte temp
        await tx.user.delete({ where: { id: tempUser.id } });
        log(`compte temp user#${tempUser.id} supprimé`);

        // e. Activer le CompanyEmployee
        await tx.companyEmployee.update({
            where: { id: employee.id },
            data: {
                userId: currentUserId,
                status: 'ACTIVE',
                linkCode: null,
                linkCodeCreatedAt: null,
                statusUpdatedAt: new Date(),
            },
        });
        log(`CompanyEmployee#${employee.id} → ACTIVE (userId=${currentUserId})`);

        // f. Créer RankHistory si aucune entrée ouverte
        const open = await tx.rankHistory.findFirst({
            where: { companyEmployeeId: employee.id, leaveAt: null },
        });
        if (!open) {
            const rank = await tx.rank.findUnique({ where: { id: employee.rankId } });
            await tx.rankHistory.create({
                data: {
                    companyEmployeeId: employee.id,
                    rankId: employee.rankId,
                    rankName: rank?.name ?? 'Rang inconnu',
                    assignedAt: new Date(),
                    leaveAt: null,
                },
            });
            log(`RankHistory créé pour CompanyEmployee#${employee.id}`);
        }
    });

    const { ensureCompanyMember } = require('../tchatv2/guild/guild.service');
    ensureCompanyMember(currentUserId, employee.companyId).catch(() => {});

    return { success: true, message: 'Compte lié avec succès.' };
}

module.exports = {
    // Ranks
    getRanks,
    getRankFormSettings,
    createRank,
    updateRank,
    deleteRank,
    updateRankOrder,

    // Employees
    getEmployees,
    getEmployeeDetails,
    getCompanyEmployees,
    changeEmployeeStatus,
    changeEmployeeRank,
    sendProfileUpdateRequest,
    getUsersForChat,
    getEmployeeForChat,
    changeEmployeeRankFromHandler,
    resetEmployeeAccount,

    // Salary / Columns / Permissions / Widgets
    getAvailablePermissionTemplates,
    getRemunerationSchema,
    getAvailableColumns,
    getSalaryBreakdown,
    setEmployeeSalaryOverride,
    getTotalPayrollForPeriod,
    getWidgetData_MySalary,
    getWidgetData_MyTurnover,

    // Onboarding
    addUserToCompanyWithRank,

    // Link Code
    generateLinkCode,
    useLinkCode,
};
