// backend/src/modules/automation/automation.permissions.js
'use strict';

/**
 * Permissions du module Automation (Scratch).
 *
 *  - AUTOMATION.{companyId}.VIEW   : lire la config, les modèles et les workflows.
 *  - AUTOMATION.{companyId}.MANAGE : créer / modifier les workflows. Inclut VIEW.
 *
 * Le module en BDD porte le nom 'automation' (rattachement des permissionTemplates).
 * L'activation de la fonctionnalité reste pilotée par le module 'scratch' (companyModule).
 */
const PERMISSIONS = {
    VIEW: 'AUTOMATION.{companyId}.VIEW',
    MANAGE: 'AUTOMATION.{companyId}.MANAGE',
};

const HIERARCHY = {
    [PERMISSIONS.VIEW]: [],
    [PERMISSIONS.MANAGE]: [PERMISSIONS.VIEW],
};

const DESCRIPTIONS = {
    [PERMISSIONS.VIEW]: "Accède aux automates (workflows, modèles) en lecture seule",
    [PERMISSIONS.MANAGE]: "Peut créer et modifier les automates de l'entreprise",
};

/**
 * Construit les gardes de route (preHandler) pour l'automation.
 * Utilise les helpers exportés par le middleware d'auth pour éviter
 * la fragilité du OR de permissions (double envoi de réponse / hiérarchie {companyId}).
 *
 * @param {object} authMiddleware - { buildEffectiveCompanyPermissions, hasPermission }
 * @returns {{ canView: Function, canManage: Function }}
 */
function buildAutomationGuard(authMiddleware) {
    const { buildEffectiveCompanyPermissions, hasPermission } = authMiddleware;

    const make = (requiredTemplates) => async (request, reply) => {
        // Clé API : scopes déjà validés à l'authentification.
        if (request.user?.isApiKey) return;

        const companyId = parseInt(request.headers['x-company-id'], 10);
        if (!companyId || Number.isNaN(companyId)) {
            return reply.code(400).send({ message: "Header 'x-company-id' manquant ou invalide." });
        }

        const userId = request.user?.userId;
        if (!userId) return reply.code(401).send({ message: 'Non authentifié.' });

        const perms = await buildEffectiveCompanyPermissions(userId, companyId);

        // Dirigeant d'entreprise / admin global → bypass.
        if (perms.has(`COMPANY.${companyId}.*`) || perms.has('ADMIN.*')) return;

        const ok = requiredTemplates.some((t) =>
            hasPermission(perms, t.replace('{companyId}', String(companyId)))
        );
        if (!ok) {
            return reply.code(403).send({
                message: "Accès interdit : permission Automation requise.",
                code: 'AUTOMATION_FORBIDDEN',
            });
        }
    };

    return {
        canView: make([PERMISSIONS.VIEW, PERMISSIONS.MANAGE]),
        canManage: make([PERMISSIONS.MANAGE]),
    };
}

module.exports = {
    PERMISSIONS,
    HIERARCHY,
    DESCRIPTIONS,
    buildAutomationGuard,
};
