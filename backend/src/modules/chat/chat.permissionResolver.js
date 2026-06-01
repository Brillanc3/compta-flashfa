// backend/src/modules/chat/chat.permissionResolver.js
'use strict';

const prismaDefault = require('../../db');

const {
    buildEffectiveCompanyPermissions,
    hasPermission,
} = require('../../middleware/auth');

// -----------------------------------------
// 1. Permission flags (bitfield)
// -----------------------------------------
const ChatPermissionFlags = {
    VIEW_CHANNEL:              1n << 0n,
    SEND_MESSAGES:             1n << 1n,
    SEND_ATTACHMENTS:          1n << 2n,
    MANAGE_MESSAGES:           1n << 3n,
    MANAGE_CHANNEL:            1n << 4n,
    ADD_MEMBERS:               1n << 5n,
    REMOVE_MEMBERS:            1n << 6n,
    PIN_MESSAGES:              1n << 7n,
    MENTION_EVERYONE:          1n << 8n,
    MANAGE_CATEGORY_CHANNELS:  1n << 9n,
};

const ALL_FLAGS = Object.values(ChatPermissionFlags);
const ADMIN_MASK = ALL_FLAGS.reduce((acc, f) => acc | f, 0n);

// -----------------------------------------
// 2. Helpers bitfield
// -----------------------------------------
function hasBits(mask, flag) {
    return (mask & flag) === flag;
}

function applyAllow(baseMask, allowMask) {
    return baseMask | allowMask;
}

function applyDeny(baseMask, denyMask) {
    return baseMask & ~denyMask;
}

function isAdminRank(rankBits) {
    return hasBits(rankBits, ChatPermissionFlags.MANAGE_CHANNEL);
}

function safeBigInt(v) {
    if (v == null) return 0n;
    try { return BigInt(v); } catch { return 0n; }
}

/**
 * Aggregate a list of overrides (each {allowBits, denyBits}) into a single { allowBits, denyBits }.
 * Returns null if list empty.
 */
function aggregateOverrides(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return null;
    let allow = 0n;
    let deny = 0n;
    for (const o of rows) {
        allow |= safeBigInt(o.allowBits);
        deny  |= safeBigInt(o.denyBits);
    }
    return { allowBits: allow, denyBits: deny };
}

function applyOverrideStep(mask, override) {
    if (!override) return mask;
    let m = mask;
    m = applyDeny(m, override.denyBits || 0n);
    m = applyAllow(m, override.allowBits || 0n);
    return m;
}

// -----------------------------------------
// 3. Resolve channel permissions (pure)
// Discord cascade order:
//   rankBits (global rank)
//   → category rank overrides (if channel has parent category)
//   → category user override (if channel has parent category)
//   → channel rank overrides   (only if NOT syncedWithCategory)
//   → channel user override    (only if NOT syncedWithCategory)
//   → ADMIN bypass everything
// -----------------------------------------
function resolveChannelPermissions({
    rankBits = 0n,
    categoryRankOverride = null,
    categoryUserOverride = null,
    channelRankOverride = null,
    channelUserOverride = null,
    syncedWithCategory = true,
    isAdmin = false,
}) {
    if (isAdmin) {
        return { mask: ADMIN_MASK, can: maskToCan(ADMIN_MASK) };
    }

    let mask = rankBits;

    // Category cascade — applies whether synced or not (Discord behavior)
    mask = applyOverrideStep(mask, categoryRankOverride);
    mask = applyOverrideStep(mask, categoryUserOverride);

    // Channel cascade — only if channel desynced from its category
    if (!syncedWithCategory) {
        mask = applyOverrideStep(mask, channelRankOverride);
        mask = applyOverrideStep(mask, channelUserOverride);
    }

    return { mask, can: maskToCan(mask) };
}

// -----------------------------------------
// 5. Convert mask → booleans pour le frontend
// -----------------------------------------
function maskToCan(mask) {
    return {
        viewChannel:             hasBits(mask, ChatPermissionFlags.VIEW_CHANNEL),
        sendMessages:            hasBits(mask, ChatPermissionFlags.SEND_MESSAGES),
        sendAttachments:         hasBits(mask, ChatPermissionFlags.SEND_ATTACHMENTS),
        manageMessages:          hasBits(mask, ChatPermissionFlags.MANAGE_MESSAGES),
        manageChannel:           hasBits(mask, ChatPermissionFlags.MANAGE_CHANNEL),
        addMembers:              hasBits(mask, ChatPermissionFlags.ADD_MEMBERS),
        removeMembers:           hasBits(mask, ChatPermissionFlags.REMOVE_MEMBERS),
        pinMessages:             hasBits(mask, ChatPermissionFlags.PIN_MESSAGES),
        mentionEveryone:         hasBits(mask, ChatPermissionFlags.MENTION_EVERYONE),
        manageCategoryChannels:  hasBits(mask, ChatPermissionFlags.MANAGE_CATEGORY_CHANNELS),
    };
}

function checkPermission(mask, flag) {
    return hasBits(mask, flag);
}

// -----------------------------------------
// 7. Résolution complète via Prisma + ADMIN GLOBAL
// -----------------------------------------
async function resolvePermissionsForChannel({ userId, channelId, prisma }) {
    const db = prisma || prismaDefault;

    const channel = await db.chatChannel.findUnique({
        where: { id: BigInt(channelId) },
        select: {
            id: true,
            companyId: true,
            categoryId: true,
            syncedWithCategory: true,
        },
    });
    if (!channel) {
        throw new Error('Channel not found');
    }

    const companyId = Number(channel.companyId);
    const userIdNum = Number(userId);

    // 1) Global company permissions (CHAT.ADMINISTRATOR / wildcard)
    let userPermissions = [];
    try {
        userPermissions = await buildEffectiveCompanyPermissions(userIdNum, companyId);
    } catch (err) {
        console.error('❌ buildEffectiveCompanyPermissions failed:', err);
        throw err;
    }

    const hasChatAdmin = hasPermission(userPermissions, 'CHAT.ADMINISTRATOR');
    const hasCompanyWildcard = hasPermission(userPermissions, `COMPANY.${companyId}.*`);
    const isGlobalAdmin = hasChatAdmin || hasCompanyWildcard;

    // 2) Ranks user
    const ranks = await db.rank.findMany({
        where: {
            employees: { some: { userId: userIdNum, companyId } },
        },
        select: { id: true, chatPermissionsBits: true },
    });

    let rankBits = 0n;
    let isRankAdmin = false;
    for (const r of ranks) {
        const bits = safeBigInt(r.chatPermissionsBits);
        rankBits |= bits;
        if (isAdminRank(bits)) isRankAdmin = true;
    }
    const isAdmin = isGlobalAdmin || isRankAdmin;
    const rankIds = ranks.map((r) => r.id);

    // 3) Category overrides (rank + user) — only if channel has a category
    let categoryRankOverride = null;
    let categoryUserOverride = null;

    if (channel.categoryId != null) {
        if (rankIds.length > 0) {
            const rows = await db.chatCategoryRankOverride.findMany({
                where: {
                    categoryId: channel.categoryId,
                    rankId: { in: rankIds },
                },
                select: { allowBits: true, denyBits: true },
            });
            categoryRankOverride = aggregateOverrides(rows);
        }

        const userRow = await db.chatCategoryUserOverride.findUnique({
            where: {
                categoryId_userId: {
                    categoryId: channel.categoryId,
                    userId: userIdNum,
                },
            },
            select: { allowBits: true, denyBits: true },
        });
        if (userRow) {
            categoryUserOverride = {
                allowBits: safeBigInt(userRow.allowBits),
                denyBits: safeBigInt(userRow.denyBits),
            };
        }
    }

    // 4) Channel-level overrides — only meaningful if channel is desynced
    let channelRankOverride = null;
    let channelUserOverride = null;

    if (!channel.syncedWithCategory) {
        if (rankIds.length > 0) {
            const rows = await db.chatChannelRankOverride.findMany({
                where: {
                    channelId: BigInt(channelId),
                    rankId: { in: rankIds },
                },
                select: { allowBits: true, denyBits: true },
            });
            channelRankOverride = aggregateOverrides(rows);
        }

        const userRow = await db.chatChannelUserOverride.findUnique({
            where: {
                channelId_userId: {
                    channelId: BigInt(channelId),
                    userId: userIdNum,
                },
            },
            select: { allowBits: true, denyBits: true },
        });
        if (userRow) {
            channelUserOverride = {
                allowBits: safeBigInt(userRow.allowBits),
                denyBits: safeBigInt(userRow.denyBits),
            };
        }
    }

    return resolveChannelPermissions({
        rankBits,
        categoryRankOverride,
        categoryUserOverride,
        channelRankOverride,
        channelUserOverride,
        syncedWithCategory: channel.syncedWithCategory,
        isAdmin,
    });
}

/**
 * Resolves permissions at the category level (rankBits → category overrides).
 * Used to check MANAGE_CATEGORY_CHANNELS when creating/updating/deleting channels.
 */
async function resolvePermissionsForCategory({ userId, categoryId, prisma }) {
    const db = prisma || prismaDefault;

    const category = await db.chatCategory.findUnique({
        where: { id: BigInt(categoryId) },
        select: { id: true, companyId: true },
    });
    if (!category) throw new Error('Category not found');

    const companyId = Number(category.companyId);
    const userIdNum = Number(userId);

    let userPermissions = [];
    try {
        userPermissions = await buildEffectiveCompanyPermissions(userIdNum, companyId);
    } catch (err) {
        throw err;
    }

    const hasChatAdmin = hasPermission(userPermissions, 'CHAT.ADMINISTRATOR');
    const hasCompanyWildcard = hasPermission(userPermissions, `COMPANY.${companyId}.*`);
    const isGlobalAdmin = hasChatAdmin || hasCompanyWildcard;

    const ranks = await db.rank.findMany({
        where: { employees: { some: { userId: userIdNum, companyId } } },
        select: { id: true, chatPermissionsBits: true },
    });

    let rankBits = 0n;
    let isRankAdmin = false;
    for (const r of ranks) {
        const bits = safeBigInt(r.chatPermissionsBits);
        rankBits |= bits;
        if (isAdminRank(bits)) isRankAdmin = true;
    }
    const isAdmin = isGlobalAdmin || isRankAdmin;

    if (isAdmin) {
        return { mask: ADMIN_MASK, can: maskToCan(ADMIN_MASK) };
    }

    const rankIds = ranks.map((r) => r.id);

    let categoryRankOverride = null;
    if (rankIds.length > 0) {
        const rows = await db.chatCategoryRankOverride.findMany({
            where: { categoryId: BigInt(categoryId), rankId: { in: rankIds } },
            select: { allowBits: true, denyBits: true },
        });
        categoryRankOverride = aggregateOverrides(rows);
    }

    const userRow = await db.chatCategoryUserOverride.findUnique({
        where: { categoryId_userId: { categoryId: BigInt(categoryId), userId: userIdNum } },
        select: { allowBits: true, denyBits: true },
    });
    const categoryUserOverride = userRow
        ? { allowBits: safeBigInt(userRow.allowBits), denyBits: safeBigInt(userRow.denyBits) }
        : null;

    let mask = rankBits;
    mask = applyOverrideStep(mask, categoryRankOverride);
    mask = applyOverrideStep(mask, categoryUserOverride);

    return { mask, can: maskToCan(mask) };
}

async function ensureCanViewChannel(userId, channelId, prisma) {
    const perms = await resolvePermissionsForChannel({ userId, channelId, prisma });
    if (!perms.can.viewChannel) {
        const err = new Error('Missing VIEW_CHANNEL');
        err.code = 'MISSING_VIEW_CHANNEL';
        throw err;
    }
    return perms;
}

module.exports = {
    ChatPermissionFlags,
    ALL_FLAGS,
    ADMIN_MASK,

    hasBits,
    applyAllow,
    applyDeny,
    isAdminRank,
    aggregateOverrides,

    resolveChannelPermissions,
    resolvePermissionsForChannel,
    resolvePermissionsForCategory,
    ensureCanViewChannel,

    maskToCan,
    checkPermission,
};
