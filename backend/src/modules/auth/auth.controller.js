const {
    authenticateUser,
    createSessionForUser,
    refreshSession,
    revokeSession,
    getUserById,
    getPermissionsForCompany,
    verifyPasswordResetToken,
    resetPasswordWithToken
} = require('./auth.service');
const bcrypt = require("bcrypt");

/**
 * POST /auth/login
 */
async function login(req, reply) {
    try {
        const { username, password, deviceId } = req.body;
        if (!username || !password) {
            return reply.code(400).send({ message: 'username et password requis' });
        }

        const user = await authenticateUser({ username, password });
        if (!user) {
            return reply.code(401).send({ message: 'Identifiants invalides' });
        }

        const session = await createSessionForUser(user, deviceId);

        return reply.send({
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            deviceId: session.deviceId,
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                status: user.status,
            },
        });
    } catch (err) {
        console.error('[auth] login error:', err);
        return reply.code(500).send({ message: 'Erreur interne auth/login' });
    }
}

function resolveCompanyIdFromRequest(req, fallbackCompanyId) {
    const header = req.headers['x-company-id'];
    if (header && /^\d+$/.test(String(header))) return Number(header);
    return fallbackCompanyId || null;
}



/**
 * POST /auth/reset/verify
 */
async function verifyResetToken(req, reply) {
    try {
        const { username, token } = req.body;
        if (!username || !token) {
            return reply.code(400).send({
                message: "Username et token requis",
            });
        }

        const user = await verifyPasswordResetToken({ username, token });

        return reply.send({
            valid: true,
            user,
        });
    } catch {
        return reply.code(401).send({
            valid: false,
            message: "Token invalide ou expiré",
        });
    }
}

/**
 * POST /auth/reset/confirm
 */
async function confirmResetPassword(req, reply) {
    try {
        const { username, token, newPassword } = req.body;

        if (!username || !token || !newPassword) {
            return reply.code(400).send({
                message: "Données manquantes",
            });
        }

        await resetPasswordWithToken({ username, token, newPassword });

        return reply.send({ success: true });
    } catch (err) {
        console.error("[auth] reset password error:", err);
        return reply.code(401).send({
            message: "Token invalide ou expiré",
        });
    }
}

/**
 * GET /auth/permissions
 * Headers:
 * - Authorization: Bearer <accessToken>
 * - x-company-id: <companyId> (optionnel)
 */
async function permissions(req, reply) {
    const rid = `perm_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    try {
        const { userId } = req.user;
        req.log.info({ rid, userId }, "[auth/permissions] start");

        // 0) Charger user + permissions (directes + rôles) pour déduire COMPANY.<id>.*
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                permissions: true,
                roles: { include: { permissions: true } },
            },
        });

        if (!user) {
            return reply.code(403).send({ message: "Accès interdit: Utilisateur non trouvé." });
        }

        const allPermissionActions = new Set();
        (user.permissions || []).forEach((p) => allPermissionActions.add(p.action));
        (user.roles || []).forEach((r) =>
            (r.permissions || []).forEach((p) => allPermissionActions.add(p.action))
        );

        const isAdmin = allPermissionActions.has("ADMIN.*");

        const companyIdsFromDirectPerms = new Set();
        for (const action of allPermissionActions) {
            const m = /^COMPANY\.(\d+)\.\*$/.exec(action);
            if (m) companyIdsFromDirectPerms.add(Number(m[1]));
        }

        // 1) Liste des companies accessibles via CompanyEmployee ACTIVE
        const employments = await prisma.companyEmployee.findMany({
            where: { userId, status: "ACTIVE" },
            select: { companyId: true },
        });

        const employmentCompanyIds = employments.map((e) => Number(e.companyId));

        // ✅ Union: employments + permissions COMPANY.<id>.*
        const accessibleCompanyIds = Array.from(
            new Set([...employmentCompanyIds, ...companyIdsFromDirectPerms])
        );

        // ✅ Fallback: si pas d’employment, on peut tomber sur une company issue des perms directes
        const fallbackCompanyId = accessibleCompanyIds.length ? accessibleCompanyIds[0] : null;

        const companyId = resolveCompanyIdFromRequest(req, fallbackCompanyId);

        req.log.info(
            {
                rid,
                companyId,
                fallbackCompanyId,
                accessibleCompanyIds,
                employmentCompanyIds,
                directPermCompanyIds: Array.from(companyIdsFromDirectPerms),
                isAdmin,
            },
            "[auth/permissions] company resolution"
        );

        if (!companyId) {
            // Pour un admin sans header, on ne peut pas deviner la company
            return reply.code(403).send({
                message: isAdmin
                    ? "Veuillez fournir x-company-id pour récupérer les permissions."
                    : "Aucune entreprise accessible.",
            });
        }

        // 2) Sécurité: interdit d’obtenir les perms d’une autre company
        // ✅ Admin bypass
        if (!isAdmin && !accessibleCompanyIds.includes(Number(companyId))) {
            return reply.code(403).send({ message: "Accès refusé à cette entreprise." });
        }

        // 3) Calcul des permissions de CETTE company
        const result = await getPermissionsForCompany({ userId, companyId });

        req.log.info(
            {
                rid,
                userId,
                companyId,
                permCount: result.permissions?.length || 0,
                modules: result.companyModules,
            },
            "[auth/permissions] done"
        );

        return reply.send(result);
    } catch (err) {
        console.error("[auth/permissions] error:", err);
        req.log.error({ rid, err }, "[auth/permissions] error");
        return reply.code(500).send({ message: "Erreur interne auth/permissions" });
    }
}


async function register(req, reply) {
    try {
        const { username, password, name } = req.body;

        if (!username || !password || !name) {
            return reply.code(400).send({ message: "Champs manquants" });
        }

        // Vérifier si user existe déjà
        const existing = await prisma.user.findUnique({
            where: { username }
        });

        if (existing) {
            return reply.code(409).send({ message: "Nom d'utilisateur déjà pris" });
        }

        const hashed = await bcrypt.hash(password, 10);

        // Création utilisateur
        const user = await prisma.user.create({
            data: {
                username,
                password: hashed,
                name,
                status: "ACTIVE",
            }
        });

        // Le register NE doit PAS générer de tokens !
        // L'utilisateur fera ensuite un login normal.
        return reply.send({ success: true, message: "Inscription réussie." });

    } catch (err) {
        console.error("[auth] register error:", err);
        return reply.code(500).send({ message: "Erreur interne register" });
    }
}

/**
 * POST /auth/refresh
 */
async function refreshToken(req, reply) {
    try {
        const { refreshToken, deviceId } = req.body;

        if (!refreshToken || !deviceId) {
            return reply.code(400).send({ message: 'refreshToken et deviceId requis' });
        }

        const session = await refreshSession({ refreshToken, deviceId });

        return reply.send({
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            deviceId: session.deviceId,
            user: {
                id: session.user.id,
                username: session.user.username,
                name: session.user.name,
                status: session.user.status,
            },
        });
    } catch (err) {
        console.error('[auth] refresh error:', err);
        return reply.code(401).send({ message: 'Refresh token invalide ou expiré' });
    }
}

/**
 * POST /auth/logout
 */
async function logout(req, reply) {
    try {
        const { refreshToken, deviceId } = req.body;
        if (refreshToken && deviceId) {
            await revokeSession({ refreshToken, deviceId });
        }
        return reply.send({ success: true });
    } catch (err) {
        console.error('[auth] logout error:', err);
        return reply.code(500).send({ message: 'Erreur interne auth/logout' });
    }
}

/**
 * GET /auth/me
 * (protégé par middleware authenticate → req.user.userId)
 */
async function me(req, reply) {
    try {
        const { userId } = req.user;

        // ✅ Inclure permissions + rôles(+permissions) pour détecter COMPANY.<id>.*
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                permissions: true,
                roles: { include: { permissions: true } },
            },
        });

        if (!user) {
            return reply.code(404).send({ message: "Utilisateur introuvable" });
        }

        // Récupère uniquement les employments ACTIFS
        const employments = await prisma.companyEmployee.findMany({
            where: {
                userId,
                status: "ACTIVE",
            },
            include: {
                company: true,
                rank: true,
            },
        });

        // 1) Base: companies depuis les employments actifs
        const companiesMap = new Map();
        employments.forEach((e) => {
            companiesMap.set(e.company.id, {
                id: e.company.id,
                name: e.company.name,
                rank: {
                    id: e.rank?.id ?? null,
                    name: e.rank?.name ?? "Employé",
                },
                permissions: {},
            });
        });

        // 2) Extraire les companyIds depuis les permissions (directes + via rôles)
        const allPermissionActions = new Set();

        (user.permissions || []).forEach((p) => allPermissionActions.add(p.action));
        (user.roles || []).forEach((r) =>
            (r.permissions || []).forEach((p) => allPermissionActions.add(p.action))
        );

        const companyIdsFromDirectPerms = new Set();
        for (const action of allPermissionActions) {
            const m = /^COMPANY\.(\d+)\.\*$/.exec(action);
            if (m) companyIdsFromDirectPerms.add(parseInt(m[1], 10));
        }

        // 3) Charger les companies manquantes et les ajouter à companies[]
        const missingCompanyIds = Array.from(companyIdsFromDirectPerms).filter(
            (id) => !companiesMap.has(id)
        );

        if (missingCompanyIds.length > 0) {
            const extraCompanies = await prisma.company.findMany({
                where: { id: { in: missingCompanyIds } },
                select: { id: true, name: true },
            });

            extraCompanies.forEach((c) => {
                companiesMap.set(c.id, {
                    id: c.id,
                    name: c.name,
                    // ⚠️ On met un rank "virtuel" pour éviter de casser le front qui attend rank.id/name
                    rank: {
                        id: null,
                        name: "Accès direct",
                    },
                    permissions: {},
                });
            });
        }

        const companies = Array.from(companiesMap.values());

        return reply.send({
            id: user.id,
            username: user.username,
            name: user.name,
            discordId: user.discordId,
            characterId: user.characterId,
            phoneNumber: user.phoneNumber,
            iban: user.iban,
            imageUrl: user.imageUrl,
            status: user.status,
            permissions: Array.from(allPermissionActions).filter(p => !p.startsWith('COMPANY.')),
            companies, // le front choisira la company active
        });
    } catch (err) {
        req.log.error({ err }, "[auth] me error");
        return reply.code(500).send({ message: "Erreur interne auth/me" });
    }
}


async function forgotPassword(req, reply) {
    try {
        const { username } = req.body;
        if (!username) {
            return reply.code(400).send({ message: "Nom d'utilisateur requis" });
        }

        // Appel au master pour gérer l'envoi Discord
        // On utilise l'URL interne du master (port 9090 par défaut)
        const MASTER_PORT = process.env.MASTER_PORT || 9090;
        const MASTER_URL = `http://127.0.0.1:${MASTER_PORT}`;
        const secret = process.env.DISCORD_REPORT_SECRET || "";

        // On ne fait pas de await bloquant sur l'échec potentiel du master 
        // pour ne pas ralentir la réponse au client et éviter les timing attacks.
        // Mais ici on le fait pour logger correctement.
        try {
            await fetch(`${MASTER_URL}/status/discord/forgot-password`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-report-secret": secret,
                },
                body: JSON.stringify({ username }),
            });
        } catch (masterErr) {
            console.error("[auth] Master forgot-password call failed:", masterErr.message);
        }

        return reply.send({
            success: true,
            message: "Si un compte Discord est associé à cet utilisateur, un message privé a été envoyé.",
        });
    } catch (err) {
        console.error("[auth] forgotPassword error:", err);
        return reply.code(500).send({ message: "Erreur interne" });
    }
}

module.exports = {
    login,
    refreshToken,
    logout,
    me,
    register,
    permissions,
    confirmResetPassword,
    verifyResetToken,
    forgotPassword
};

