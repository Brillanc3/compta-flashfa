// backend/src/lib/permissions/getUserIdsByPermissions.js
const prisma = require('../../db');

/**
 * Génère les permissions candidates à rechercher en DB (match exact),
 * mais en tenant compte des permissions wildcard stockées en DB (ex: COMPANY.1.*).
 *
 * Logique alignée sur le frontend :
 * - Si un user possède "X.Y.*" alors il a tout ce qui commence par "X.Y."
 *   (front: startsWith(base)) :contentReference[oaicite:3]{index=3}
 *
 * Ici on ne fait pas de "LIKE", on génère les patterns wildcard attendus
 * et on fait un IN exact sur action (puisque les wildcards sont stockées littéralement).
 */
function buildPermissionCandidates(permissions, companyId) {
    const templates = Array.isArray(permissions) ? permissions : [permissions];
    const out = new Set();

    // Permissions “super company” : couvrent tous les modules d’une company
    out.add('COMPANY.{companyId}.*');
    out.add(`COMPANY.${companyId}.*`);

    for (const p of templates) {
        if (!p) continue;

        const template = String(p).trim();
        if (!template) continue;

        // Exact template
        out.add(template);

        // Exact résolue
        const resolved = template.includes('{companyId}')
            ? template.replace('{companyId}', String(companyId))
            : null;

        if (resolved) out.add(resolved);

        // Wildcards (template + résolue)
        for (const candidate of [template, resolved].filter(Boolean)) {
            const parts = String(candidate).split('.').filter(Boolean);

            // Ex: A.B.C.D => A.B.C.* ; A.B.* ; A.*
            for (let i = parts.length - 1; i >= 1; i--) {
                out.add(`${parts.slice(0, i).join('.') }.*`);
            }
        }
    }

    return Array.from(out);
}

/**
 * Résout les userId ayant une ou plusieurs permissions
 * pour une company donnée.
 *
 * IMPORTANT: on conserve le filtre ACTIVE (comme tu le demandes).
 */
async function getUserIdsByPermissions(permissions, companyId) {
    if (!companyId) {
        throw new Error('companyId est requis');
    }

    const permissionCandidates = buildPermissionCandidates(permissions, companyId);

    /* ============================================================
       1️⃣ Permissions directes utilisateur (ACTIVE uniquement)
       ============================================================ */
    const usersDirect = await prisma.user.findMany({
        where: {
            permissions: {
                some: {
                    action: { in: permissionCandidates },
                },
            },
            employments: {
                some: {
                    companyId,
                    status: 'ACTIVE',
                },
            },
        },
        select: { id: true },
    });

    /* ============================================================
       2️⃣ Permissions via rang (ACTIVE uniquement)
       ============================================================ */
    const usersViaRank = await prisma.companyEmployee.findMany({
        where: {
            companyId,
            status: 'ACTIVE',
            rank: {
                permissionTemplates: {
                    some: {
                        action: { in: permissionCandidates },
                    },
                },
            },
        },
        select: { userId: true },
    });

    /* ============================================================
       3️⃣ Fusion / déduplication
       ============================================================ */
    const userIds = new Set();
    for (const u of usersDirect) userIds.add(u.id);
    for (const e of usersViaRank) userIds.add(e.userId);

    return Array.from(userIds);
}

module.exports = {
    getUserIdsByPermissions,
};
