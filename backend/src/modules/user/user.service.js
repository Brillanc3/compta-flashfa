// /backend/src/modules/user/user.service.js

const prisma = require('../../db');
const { compare, hash } = require('bcrypt');

const ELECTRONIC_SIGNATURE_COOLDOWN_DAYS = 30;
const ELECTRONIC_SIGNATURE_COOLDOWN_MS = ELECTRONIC_SIGNATURE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
const MAX_SIGNATURE_SVG_LENGTH = 50000;
const SIGNATURE_HISTORY_LIMIT = 5;

function createHttpError(message, statusCode = 400, details = null) {
    const error = new Error(message);
    error.statusCode = statusCode;
    if (details) error.details = details;
    return error;
}

function computeNextChangeAllowedAt(createdAt) {
    if (!createdAt) return null;
    return new Date(new Date(createdAt).getTime() + ELECTRONIC_SIGNATURE_COOLDOWN_MS);
}

function computeDaysUntil(date) {
    if (!date) return 0;
    const diff = new Date(date).getTime() - Date.now();
    if (diff <= 0) return 0;
    return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

function stripSvgPreamble(rawSvg) {
    let svg = rawSvg.replace(/^﻿/, '').trim();

    svg = svg.replace(/^<\?xml[\s\S]*?\?>\s*/i, '');
    svg = svg.replace(/^<!doctype[\s\S]*?>\s*/i, '');

    while (/^<!--[\s\S]*?-->\s*/.test(svg)) {
        svg = svg.replace(/^<!--[\s\S]*?-->\s*/i, '');
    }

    return svg.trim();
}

function normalizeSvg(rawSvg) {
    if (typeof rawSvg !== 'string') {
        throw createHttpError('Le SVG de signature est requis.');
    }

    const raw = rawSvg.trim();
    if (!raw) {
        throw createHttpError('Le SVG de signature est requis.');
    }

    if (raw.length > MAX_SIGNATURE_SVG_LENGTH) {
        throw createHttpError(`Le SVG de signature est trop volumineux (max ${MAX_SIGNATURE_SVG_LENGTH} caractères).`);
    }

    const svg = stripSvgPreamble(raw);
    if (!svg) {
        throw createHttpError('Le format de signature électronique est invalide : un document SVG complet est attendu.');
    }

    return svg;
}

function validateSvg(svg) {
    const lower = svg.toLowerCase();

    if (!lower.startsWith('<svg') || !/<\/svg>\s*$/i.test(svg)) {
        throw createHttpError('Le format de signature électronique est invalide : un document SVG complet est attendu.');
    }

    if (!/<svg\b[^>]*>/i.test(svg)) {
        throw createHttpError('Le SVG de signature est invalide.');
    }

    if (!/(viewBox|width=|height=)/i.test(svg)) {
        throw createHttpError('Le SVG de signature doit définir un viewBox ou des dimensions explicites.');
    }

    if (/<script\b/i.test(svg)) {
        throw createHttpError('Le SVG de signature contient du script interdit.');
    }

    if (/<foreignObject\b/i.test(svg)) {
        throw createHttpError('Le SVG de signature contient un élément interdit.');
    }

    if (/\son[a-z]+\s*=/i.test(svg)) {
        throw createHttpError('Le SVG de signature contient des attributs évènementiels interdits.');
    }

    if (/(href|xlink:href)\s*=\s*["']\s*(javascript:|data:text\/html)/i.test(svg)) {
        throw createHttpError('Le SVG de signature contient un lien interdit.');
    }

    if (!/<(path|polyline|line|rect|circle|ellipse|g)\b/i.test(svg)) {
        throw createHttpError('Le SVG de signature ne contient aucun tracé exploitable.');
    }
}

function serializeSignatureVersion(version, activeId = null) {
    if (!version) return null;

    return {
        id: version.id,
        svg: version.svg,
        createdAt: version.createdAt,
        isActive: activeId != null ? version.id === activeId : false,
    };
}

function buildElectronicSignaturePayload(versions) {
    const sorted = Array.isArray(versions) ? versions : [];
    const active = sorted.length > 0 ? sorted[0] : null;
    const nextChangeAllowedAt = computeNextChangeAllowedAt(active?.createdAt || null);
    const canChangeNow = !nextChangeAllowedAt || nextChangeAllowedAt.getTime() <= Date.now();

    return {
        cooldownDays: ELECTRONIC_SIGNATURE_COOLDOWN_DAYS,
        canChangeNow,
        nextChangeAllowedAt,
        daysUntilNextChange: canChangeNow ? 0 : computeDaysUntil(nextChangeAllowedAt),
        activeSignature: serializeSignatureVersion(active, active?.id ?? null),
        history: sorted.map((item) => serializeSignatureVersion(item, active?.id ?? null)).map((item) => ({
            id: item.id,
            createdAt: item.createdAt,
            isActive: item.isActive,
        })),
    };
}

async function getLatestElectronicSignatureVersions(userId) {
    return prisma.userElectronicSignatureVersion.findMany({
        where: { userId },
        orderBy: [
            { createdAt: 'desc' },
            { id: 'desc' },
        ],
        take: SIGNATURE_HISTORY_LIMIT,
    });
}

async function ensureUserExists(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
    });

    if (!user) {
        throw createHttpError('Utilisateur introuvable.', 404);
    }
}

/**
 * Récupère les préférences pour une page spécifique d'un utilisateur.
 */
async function getPreferences(userId, pageKey) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { preferences: true },
        });

        return user?.preferences?.[pageKey] || null;
    } catch (error) {
        console.error('❌ [ERREUR PRISMA] La requête pour récupérer les préférences a échoué. Erreur:', error.message);
        throw error;
    }
}

/**
 * Sauvegarde les préférences pour une page spécifique d'un utilisateur.
 */
async function savePreferences(userId, pageKey, value) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { preferences: true },
    });

    const currentPreferences =
        user.preferences && typeof user.preferences === 'object'
            ? user.preferences
            : {};

    const updatedPreferences = {
        ...currentPreferences,
        [pageKey]: value,
    };

    if ('preferences' in updatedPreferences) {
        Object.assign(updatedPreferences, updatedPreferences.preferences);
        delete updatedPreferences.preferences;
    }

    console.log('[savePreferences] updatedPreferences:', updatedPreferences);

    const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { preferences: updatedPreferences },
    });

    return updatedUser.preferences[pageKey];
}

/**
 * Met à jour les informations de profil d'un utilisateur
 * @param {number} userId
 * @param {{ phoneNumber?:string, iban?:string, discordId?:string, characterId?:number }} data
 */
async function updateUserProfile(userId, data) {
    if (!userId) throw new Error('Utilisateur non authentifié.');

    const updates = {};

    if (data.phoneNumber) {
        if (!/^[0-9+() -]{3,8}$/.test(data.phoneNumber)) {
            throw new Error('Numéro de téléphone invalide.');
        }
        updates.phoneNumber = data.phoneNumber;
    }

    if (data.iban) {
        if (!/^([0-9A-Z]{2,8})$/.test(data.iban.replace(/\s/g, ''))) {
            throw new Error('IBAN invalide.');
        }
        updates.iban = data.iban.replace(/\s/g, '');
    }

    if (data.discordId) {
        if (!/^[0-9]{17,20}$/.test(data.discordId)) {
            throw new Error(`Discord ID invalide (17-20 chiffres attendus). Envoyé : ${data.discordId}`);
        }
        updates.discordId = data.discordId;
    }

    if (data.characterId) {
        const parsed = parseInt(data.characterId, 10);
        if (isNaN(parsed)) throw new Error('Character ID invalide.');
        updates.characterId = parsed;
    }

    if (Object.keys(updates).length === 0) {
        throw new Error('Aucune donnée valide à mettre à jour.');
    }

    const updated = await prisma.user.update({
        where: { id: userId },
        data: updates,
        select: {
            id: true,
            name: true,
            phoneNumber: true,
            iban: true,
            discordId: true,
            characterId: true,
        },
    });

    return updated;
}

async function getRankHistory(userId) {
    if (!userId) throw new Error('Utilisateur non authentifié.');

    const employments = await prisma.companyEmployee.findMany({
        where: { userId },
        select: {
            id: true,
            company: { select: { id: true, name: true } },
            rank: { select: { id: true, name: true, position: true } },
            createdAt: true,
            status: true,
            rankHistory: {
                select: {
                    id: true,
                    assignedAt: true,
                    leaveAt: true,
                    rankName: true,
                    rank: { select: { id: true, name: true } },
                },
                orderBy: { assignedAt: 'desc' },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    const liveItems = employments.map((e) => ({
        companyName: e.company?.name || 'Inconnue',
        currentRank: e.rank?.name || 'Aucun rang',
        currentPosition: e.rank?.position || 0,
        status: e.status,
        hiredAt: e.createdAt,
        history: (e.rankHistory || []).map((h) => ({
            id: h.id,
            rankName: h.rankName,
            rankId: h.rank?.id || null,
            assignedAt: h.assignedAt,
            leaveAt: h.leaveAt,
        })),
        _sortDate: (e.rankHistory && e.rankHistory.length > 0) ? e.rankHistory[0].assignedAt : e.createdAt,
    }));

    const archivedRows = await prisma.rankHistoryArchive.findMany({
        where: { userId },
        select: {
            id: true,
            companyId: true,
            companyName: true,
            rankId: true,
            rankName: true,
            assignedAt: true,
            leaveAt: true,
        },
        orderBy: { assignedAt: 'desc' },
    });

    const groups = new Map();
    for (const row of archivedRows) {
        const key = row.companyId != null ? `cid:${row.companyId}` : `cname:${row.companyName}`;
        if (!groups.has(key)) {
            groups.set(key, {
                companyId: row.companyId ?? null,
                companyName: row.companyName || 'Entreprise supprimée',
                rows: [],
            });
        }
        groups.get(key).rows.push(row);
    }

    const archivedItems = Array.from(groups.values()).map((g) => {
        const rows = g.rows.sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime());
        const oldest = rows[rows.length - 1];
        const newest = rows[0];

        return {
            companyName: g.companyName,
            currentRank: newest?.rankName || 'Aucun rang',
            currentPosition: 0,
            status: 'ARCHIVED',
            hiredAt: oldest?.assignedAt || newest?.assignedAt || null,
            history: rows.map((h) => ({
                id: h.id,
                rankName: h.rankName,
                rankId: h.rankId ?? null,
                assignedAt: h.assignedAt,
                leaveAt: h.leaveAt,
            })),
            _sortDate: newest?.assignedAt || oldest?.assignedAt || null,
        };
    });

    const merged = [...liveItems, ...archivedItems];
    merged.sort((a, b) => {
        const ad = a._sortDate ? new Date(a._sortDate).getTime() : 0;
        const bd = b._sortDate ? new Date(b._sortDate).getTime() : 0;
        return bd - ad;
    });

    return merged.map(({ _sortDate, ...rest }) => rest);
}

async function changePassword(userId, oldPassword, newPassword) {
    if (!userId) throw new Error('Utilisateur non authentifié.');
    if (!oldPassword || !newPassword) throw new Error('Les deux mots de passe sont requis.');
    if (newPassword.length < 8) throw new Error('Le mot de passe doit contenir au moins 8 caractères.');

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { password: true } });
    if (!user) throw new Error('Utilisateur introuvable.');

    const match = await compare(oldPassword, user.password);
    if (!match) {
        const err = new Error('Ancien mot de passe incorrect.');
        err.statusCode = 403;
        throw err;
    }

    const hashed = await hash(newPassword, 10);
    await prisma.user.update({
        where: { id: userId },
        data: { password: hashed },
    });
}

async function getElectronicSignatureProfile(userId) {
    if (!userId) throw createHttpError('Utilisateur non authentifié.', 401);

    await ensureUserExists(userId);

    const versions = await getLatestElectronicSignatureVersions(userId);
    return buildElectronicSignaturePayload(versions);
}

async function updateElectronicSignature(userId, payload) {
    if (!userId) throw createHttpError('Utilisateur non authentifié.', 401);

    await ensureUserExists(userId);

    const svg = normalizeSvg(payload?.svg);
    validateSvg(svg);

    const latestVersion = await prisma.userElectronicSignatureVersion.findFirst({
        where: { userId },
        orderBy: [
            { createdAt: 'desc' },
            { id: 'desc' },
        ],
    });

    const nextChangeAllowedAt = computeNextChangeAllowedAt(latestVersion?.createdAt || null);
    if (latestVersion && nextChangeAllowedAt && nextChangeAllowedAt.getTime() > Date.now()) {
        throw createHttpError(
            'Vous ne pouvez modifier votre signature électronique qu’une fois tous les 30 jours.',
            409,
            {
                nextChangeAllowedAt,
                daysUntilNextChange: computeDaysUntil(nextChangeAllowedAt),
                cooldownDays: ELECTRONIC_SIGNATURE_COOLDOWN_DAYS,
            }
        );
    }

    await prisma.userElectronicSignatureVersion.create({
        data: {
            userId,
            svg,
        },
    });

    const versions = await getLatestElectronicSignatureVersions(userId);
    return buildElectronicSignaturePayload(versions);
}

module.exports = {
    getPreferences,
    savePreferences,
    updateUserProfile,
    getRankHistory,
    changePassword,
    getElectronicSignatureProfile,
    updateElectronicSignature,
};
