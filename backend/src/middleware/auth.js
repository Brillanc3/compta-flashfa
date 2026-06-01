// /backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const prisma = require('../db');
const JWT_SECRET = process.env.JWT_SECRET || 'votre_secret_par_defaut';

/* ================== Auth de base ================== */
const authenticate = async (request, reply) => {
    // Déjà authentifié via clé API → passe
    if (request.user?.isApiKey) return;

    try {
        const authz = request.headers.authorization;
        if (!authz) return reply.code(401).send({ message: "En-tête d'autorisation manquant." });

        const token = authz.replace('Bearer ', '');
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.type !== 'access') {
            return reply.code(401).send({ message: 'Token de type invalide. Connexion requise.' });
        }
        request.user = { ...decoded, id: decoded.userId };

        // --- PROTECTION MODE DEMO ---
        const modifyingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
        if (modifyingMethods.includes(request.method)) {
            const user = await prisma.user.findUnique({
                where: { id: decoded.userId },
                select: { username: true }
            });
            if (user?.username === 'demo') {
                return reply.code(403).send({
                    message: "Action impossible : le mode DEMO ne permet pas la modification des données."
                });
            }
        }
    } catch (err) {
        return reply.code(401).send({ message: 'Token invalide ou expiré.' });
    }
};

/* ================== Helpers ================== */
function parseCompanyId(request) {
    // 1) Contexte ?contextType=COMPANY&contextId=ID
    const ctxType = String(request.query?.contextType || '').toUpperCase();
    const ctxId = Number.parseInt(request.query?.contextId, 10);
    if (ctxType === 'COMPANY' && Number.isInteger(ctxId) && ctxId > 0) return ctxId;

    // 2) Paramètre d’URL courant le plus fréquent
    const paramCompanyId = Number.parseInt(
        request.params?.companyId ?? request.params?.id ?? request.params?.company_id,
        10
    );
    //if (Number.isInteger(paramCompanyId) && paramCompanyId > 0) return paramCompanyId;

    // 3) En-tête
    const headerId = Number.parseInt(request.headers['x-company-id'], 10);
    if (Number.isInteger(headerId) && headerId > 0) return headerId;

    return null;
}

/**
 * hasPermission:
 * - correspondance exacte
 * - wildcards progressifs (MODULE.3.*, MODULE.*)
 * - hiérarchie optionnelle (mapping { 'A' : ['B','C'] })
 */
const hasPermission = (userPermissions, requiredPermission, hierarchy = {}) => {
    if (!requiredPermission) return true;
    if (!userPermissions || userPermissions.size === 0) return false;

    if (userPermissions.has('ADMIN.*')) return true;
    if (userPermissions.has(requiredPermission)) return true;

    // wildcards progressifs
    const parts = requiredPermission.split('.');
    for (let i = parts.length; i >= 1; i--) {
        const wc = parts.slice(0, i).join('.') + '.*';
        if (userPermissions.has(wc)) return true;
    }
    if (userPermissions.has('*')) return true;

    // hiérarchie (optionnelle)
    for (const perm of userPermissions) {
        if (hierarchy[perm] && hierarchy[perm].includes(requiredPermission)) {
            return true;
        }
    }
    return false;
};

/**
 * Construit l’ensemble des permissions effectives d’un user pour une company:
 * - directes user
 * - via rôles
 * - via rang d’entreprise (permissionTemplates du Rank), avec substitution {companyId}
 */
async function buildEffectiveCompanyPermissions(userId, companyId) {
    const perms = new Set();

    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            permissions: true,
            roles: { include: { permissions: true } },
        },
    });
    if (!user) return perms;

    // Directes
    user.permissions?.forEach((p) => p?.action && perms.add(p.action));

    // Rôles globaux
    user.roles?.forEach((role) => {
        role?.permissions?.forEach((p) => p?.action && perms.add(p.action));
    });

    // Rang d’entreprise
    if (companyId) {
        const employment = await prisma.companyEmployee.findUnique({
            where: { companyId_userId: { companyId, userId } },
            include: {
                rank: {
                    include: {
                        permissionTemplates: { select: { action: true } }, // table pivot Rank -> PermissionTemplate
                    },
                },
            },
        });

        const templates = employment?.rank?.permissionTemplates || [];
        for (const t of templates) {
            let act = t?.action;
            if (!act) continue;
            if (act.includes('{companyId}')) act = act.replace('{companyId}', String(companyId));
            perms.add(act);
        }

        // Option: si tu as un mécanisme "gérant" matérialisé ailleurs, tu peux aussi pousser "COMPANY.{id}.*" ici.
        // ex: if (employment?.isManager) perms.add(`COMPANY.${companyId}.*`);
    }

    return perms;
}

/* ================== Middleware permission ================== */
const checkPermission = (requiredPermissionTemplate, hierarchy = {}) => {
    return async (request, reply) => {
        // Clé API authentifiée → les scopes (méthode HTTP) ont déjà été validés dans authenticateApiKey
        if (request.user?.isApiKey) return;

        try {
            const userId = request.user?.userId;
            if (!userId) return reply.code(401).send({ message: 'Non authentifié.' });

            const companyId = parseCompanyId(request);

            // Si le template requiert {companyId} mais qu’on n’en a pas
            if (requiredPermissionTemplate?.includes('{companyId}') && !companyId) {
                return reply.code(400).send({
                    message: "ID d'entreprise manquant pour la vérification de permission.",
                });
            }

            const requiredPermission = companyId
                ? requiredPermissionTemplate.replace('{companyId}', String(companyId))
                : requiredPermissionTemplate;

            // Agrège TOUTES les permissions (user + rôles + rang d’entreprise)
            const userPermissions = await buildEffectiveCompanyPermissions(userId, companyId);

            // Gérant de l’entreprise -> bypass générique
            if (companyId && (userPermissions.has(`COMPANY.${companyId}.*`) || userPermissions.has('ADMIN.*'))) {
                return; // ok, on laisse la route continuer
            }

            if (!hasPermission(userPermissions, requiredPermission, hierarchy)) {
                return reply.code(403).send({ message: `Accès interdit: '${requiredPermission}' requis.` });
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('[auth] checkPermission error:', error?.message || error);
            return reply.code(500).send({ message: 'Erreur lors de la vérification des permissions.' });
        }
    };
};

/**
 * Vérifie si la compta de l'entreprise est suspendue.
 * - Si suspendue et utilisateur non-dirigeant → 403
 * - Si suspendue et dirigeant → lecture seule (GET uniquement)
 * - Les routes admin (prefix /admin) sont exemptées.
 */
const checkSuspension = async (request, reply) => {
    try {
        // Exempter les routes admin
        const rawUrl = request.url || '';
        if (rawUrl.startsWith('/admin')) return;

        // Lire company ID depuis query ou header uniquement (pas params, pour éviter de capter /admin/companies/:id)
        let companyId = null;
        const ctxType = String(request.query?.contextType || '').toUpperCase();
        const ctxId = Number.parseInt(request.query?.contextId, 10);
        if (ctxType === 'COMPANY' && Number.isInteger(ctxId) && ctxId > 0) {
            companyId = ctxId;
        } else {
            const headerId = Number.parseInt(request.headers?.['x-company-id'], 10);
            if (Number.isInteger(headerId) && headerId > 0) companyId = headerId;
        }
        if (!companyId) return;

        const company = await prisma.company.findUnique({
            where: { id: companyId },
            select: { accountingSuspendedAt: true },
        });
        if (!company?.accountingSuspendedAt) return;
        if (company.accountingSuspendedAt > new Date()) return;

        // Compta suspendue — décoder le JWT manuellement (authenticate n'a pas encore tourné)
        let userId = request.user?.userId ?? null;
        if (!userId) {
            const authz = request.headers?.authorization;
            if (authz) {
                try {
                    const token = authz.replace('Bearer ', '');
                    const decoded = jwt.verify(token, JWT_SECRET);
                    if (decoded?.type === 'access') userId = decoded.userId;
                } catch { /* token invalide — userId reste null */ }
            }
        }

        if (!userId) {
            return reply.code(403).send({ message: 'Accès suspendu : la comptabilité de cette entreprise est suspendue.', suspended: true });
        }

        const userPermissions = await buildEffectiveCompanyPermissions(userId, companyId);
        const isDirigeant = userPermissions.has(`COMPANY.${companyId}.*`) || userPermissions.has('ADMIN.*');

        if (isDirigeant) {
            if (request.method !== 'GET') {
                return reply.code(403).send({ message: 'Comptabilité suspendue : seule la lecture est autorisée pour le dirigeant.', suspended: true });
            }
            return;
        }

        return reply.code(403).send({ message: 'Accès suspendu : la comptabilité de cette entreprise est suspendue.', suspended: true });
    } catch (error) {
        console.error('[auth] checkSuspension error:', error?.message || error);
        return;
    }
};

const checkModuleAccess = (moduleName) => {
    return async (request, reply) => {
        try {
            const moduleRegistry = require('../lib/moduleRegistry');
            const moduleNameLower = String(moduleName || '').toLowerCase();

            // Si le module est marqué comme par défaut, on autorise l'accès sans check BDD
            if (moduleRegistry.isDefault(moduleNameLower)) {
                return;
            }

            const companyId = parseCompanyId(request);
            if (!companyId) return reply.code(400).send({ message: "ID de l'entreprise manquant." });

            const access = await prisma.companyModule.findFirst({
                where: { companyId, module: { name: moduleNameLower } },
            });
            if (!access) {
                return reply
                    .code(403)
                    .send({ message: `Accès refusé: le module '${moduleName}' n'est pas activé pour cette entreprise.` });
            }
        } catch (error) {
            return reply.code(500).send({ message: "Erreur serveur lors de la vérification de l'accès au module." });
        }
    };
};

module.exports = {
    authenticate,
    checkPermission,
    hasPermission,
    checkModuleAccess,
    checkSuspension,
    buildEffectiveCompanyPermissions,
};
