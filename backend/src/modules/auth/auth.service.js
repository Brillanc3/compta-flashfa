const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const prisma = require('../../db');

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SALT = process.env.REFRESH_TOKEN_SALT || 'refresh_salt_default';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
const REFRESH_TOKEN_TTL_DAYS = 30; // 30 jours

// ------------------------------------------------------
// Helpers
// ------------------------------------------------------

function hashRefreshToken(token) {
    return crypto.createHash('sha256').update(token + REFRESH_SALT).digest('hex');
}

function generateOpaqueToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

function generateAccessToken(payload) {
    const now = Math.floor(Date.now() / 1000);

    const tokenPayload = {
        ...payload,
        type: 'access',
        iat: now,
        exp: now + ACCESS_TOKEN_TTL_SECONDS,
    };

    return jwt.sign(tokenPayload, JWT_SECRET);
}

function getRefreshExpiryDate() {
    const now = new Date();
    now.setDate(now.getDate() + REFRESH_TOKEN_TTL_DAYS);
    return now;
}

/**
 * Récupère modules actifs d’une company
 * (si tu as déjà une table companyModule → module.name)
 */
async function getCompanyModules(companyId) {
    try {
        const { getActiveModulesForCompany } = require('../../lib/moduleUtils');
        const rows = await getActiveModulesForCompany(companyId);

        const toSlug = (name) => String(name || '')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

        return rows.map(r => toSlug(r.module?.name)).filter(Boolean);
    } catch {
        return [];
    }
}

function withCompanyId(template, companyId) {
    return String(template || '').replaceAll('{companyId}', String(companyId));
}

function collectDirectUserPermissions(user) {
    const set = new Set();
    (user.roles || []).forEach(role =>
        (role.permissions || []).forEach(p => set.add(String(p.action)))
    );
    (user.permissions || []).forEach(p => set.add(String(p.action)));
    return set;
}

function resolveRankTemplatesToActions(rank, companyId) {
    const out = new Set();
    const templates = rank?.permissionTemplates || [];
    for (const t of templates) {
        const raw = t?.action || t?.code || t?.pattern || '';
        if (!raw) continue;
        out.add(withCompanyId(raw, companyId));
    }
    return out;
}

/**
 * Ici on reste simple et strict:
 * - On ne déplie pas "COMPANY.{id}.*" en milliers d’actions,
 *   sauf si tu as absolument besoin de l’expansion complète.
 * - On garde les patterns et on les traite côté UI/guard.
 *
 * Si tu veux l’expansion totale, on pourra la réintroduire ensuite.
 */
function filterCompanyScoped(perms, companyId) {
    const prefix = `COMPANY.${companyId}.`;
    const out = new Set();
    for (const p of perms) {
        const s = String(p);
        if (s === `${prefix}*` || s.startsWith(prefix)) out.add(s);
    }
    return out;
}

const loadModulePermissions = require('../../lib/loadModulePermissions');
const expandCompanyOwnerPermissions = require('../../lib/expandCompanyOwnerPermissions');
const MODULE_PERMISSIONS = loadModulePermissions();

async function getPermissionsForCompany({ userId, companyId }) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            roles: { include: { permissions: true } },
            permissions: true,
            employments: {
                where: { status: 'ACTIVE' },
                include: {
                    rank: { include: { permissionTemplates: true } },
                },
            },
        },
    });

    if (!user) throw new Error("Utilisateur introuvable");

    /**
     * 1️⃣ Permissions directes (user + roles)
     */
    const directPermissions = collectDirectUserPermissions(user);

    /**
     * 2️⃣ Séparation global vs company-scoped
     */
    const globalPermissions = new Set();
    const companyScopedPermissions = new Set();

    for (const perm of directPermissions) {
        if (perm.startsWith('COMPANY.')) {
            companyScopedPermissions.add(perm);
        } else {
            globalPermissions.add(perm);
        }
    }

    /**
     * 3️⃣ Filtrage company uniquement sur les scoped
     */
    const scopedForCompany = filterCompanyScoped(companyScopedPermissions, companyId);

    /**
     * 4️⃣ Permissions issues du rank (toujours scopées)
     */
    const employment = user.employments.find(
        e => Number(e.companyId) === Number(companyId) && e.status === 'ACTIVE'
    );

    if (employment?.rank) {
        const rankPerms = resolveRankTemplatesToActions(employment.rank, companyId);
        rankPerms.forEach(p => scopedForCompany.add(p));
    }

    /**
     * 5️⃣ Union finale
     */
    let  finalPermissions = new Set([
        ...globalPermissions,
        ...scopedForCompany,
    ]);

    const companyModules = await getCompanyModules(companyId);

    finalPermissions = expandCompanyOwnerPermissions({
        permissions: finalPermissions,
        companyId,
        companyModules,
        modulePermissionsMap: MODULE_PERMISSIONS,
    });

    return {
        companyId: Number(companyId),
        permissions: Array.from(finalPermissions),
        companyModules,
    };
}

// ------------------------------------------------------
// Authentification utilisateur (login)
// ------------------------------------------------------

async function authenticateUser({ username, password }) {
    const user = await prisma.user.findUnique({
        where: { username },
    });

    if (!user) return null;

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return null;

    if (user.status !== 'ACTIVE') {
        throw new Error('User not active');
    }

    return user;
}

// ------------------------------------------------------
// Création d'une session persistante
// ------------------------------------------------------

async function createSessionForUser(user, deviceIdInput) {
    const deviceId =
        deviceIdInput?.trim()?.length > 0 ? deviceIdInput : `dev_${crypto.randomUUID()}`;

    const refreshToken = generateOpaqueToken(32);
    const refreshTokenHash = hashRefreshToken(refreshToken);

    const expiresAt = getRefreshExpiryDate();

    await prisma.refreshSession.create({
        data: {
            userId: user.id,
            deviceId,
            refreshTokenHash,
            expiresAt,
        },
    });

    const accessToken = generateAccessToken({
        userId: user.id,
        username: user.username,
        characterId: user.characterId,
    });

    return {
        accessToken,
        refreshToken,
        deviceId,
        user,
    };
}

// ------------------------------------------------------
// Refresh (rotation des tokens)
// ------------------------------------------------------

async function refreshSession({ refreshToken, deviceId }) {
    const refreshTokenHash = hashRefreshToken(refreshToken);

    const existing = await prisma.refreshSession.findFirst({
        where: {
            deviceId,
            refreshTokenHash,
            revokedAt: null,
            expiresAt: { gt: new Date() },
        },
        include: { user: true },
    });

    if (!existing || !existing.user) {
        throw new Error('Invalid or expired refresh token');
    }

    // Révoquer l'ancienne session
    await prisma.refreshSession.update({
        where: { id: existing.id },
        data: { revokedAt: new Date(), lastUsedAt: new Date() },
    });

    const user = existing.user;

    const newRefreshToken = generateOpaqueToken(32);
    const newRefreshTokenHash = hashRefreshToken(newRefreshToken);

    const newExpiresAt = getRefreshExpiryDate();

    await prisma.refreshSession.create({
        data: {
            userId: user.id,
            deviceId,
            refreshTokenHash: newRefreshTokenHash,
            expiresAt: newExpiresAt,
        },
    });

    const accessToken = generateAccessToken({
        userId: user.id,
        username: user.username,
        characterId: user.characterId,
    });

    return {
        accessToken,
        refreshToken: newRefreshToken,
        deviceId,
        user,
    };
}

// ------------------------------------------------------
// Logout (révocation d'une session)
// ------------------------------------------------------

async function revokeSession({ refreshToken, deviceId }) {
    const refreshTokenHash = hashRefreshToken(refreshToken);
    await prisma.refreshSession.updateMany({
        where: { deviceId, refreshTokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
    });
}

// ------------------------------------------------------

async function getUserById(id) {
    return prisma.user.findUnique({
        where: { id },
    });
}

/**
 * Vérifie un token de reset mot de passe
 */
async function verifyPasswordResetToken({ username, token }) {
    const user = await prisma.user.findFirst({
        where: {
            username,
            tempPasswordToken: token,
            tempPasswordExpiresAt: {
                gt: new Date(),
            },
        },
        select: {
            id: true,
            username: true,
            name: true,
        },
    });

    if (!user) {
        throw new Error("Invalid or expired reset token");
    }

    return {
        userId: user.id,
        username: user.username,
        name: user.name,
    };
}

/**
 * Applique le reset du mot de passe
 */
async function resetPasswordWithToken({ username, token, newPassword }) {
    const user = await prisma.user.findFirst({
        where: {
            username,
            tempPasswordToken: token,
            tempPasswordExpiresAt: {
                gt: new Date(),
            },
        },
        select: { id: true },
    });

    if (!user) {
        throw new Error("Invalid or expired reset token");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
        where: { id: user.id },
        data: {
            password: hashedPassword,
            tempPasswordToken: null,
            tempPasswordExpiresAt: null,
        },
    });
}

module.exports = {
    authenticateUser,
    createSessionForUser,
    refreshSession,
    revokeSession,
    getUserById,
    getPermissionsForCompany,
    resetPasswordWithToken,
    verifyPasswordResetToken
};
