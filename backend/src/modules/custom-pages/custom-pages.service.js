// /backend/src/modules/customPage/custom-pages.service.js
const prisma = require("../../db");

const { buildEffectiveCompanyPermissions } = require("../../middleware/auth");

/**
 * IMPORTANT:
 * - Le service ne lit PAS x-company-id : il reçoit companyId déjà validé par le controller.
 * - Aucun check de permissions "CUSTOM_PAGES.*" ici (géré au niveau routes/middlewares).
 * - On conserve la logique métier d'accès (ACL) + override COMPANY.{companyId}.* / ADMIN.*
 */

function httpError(statusCode, message) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
}

function uniqInts(arr) {
    if (!Array.isArray(arr)) return [];
    const out = [];
    const seen = new Set();
    for (const v of arr) {
        const n = Number(v);
        if (!Number.isSafeInteger(n) || n <= 0) continue;
        if (seen.has(n)) continue;
        seen.add(n);
        out.push(n);
    }
    return out;
}

function slugify(input) {
    const s = String(input ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    const slug = s
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+/, "")
        .replace(/-+$/, "")
        .replace(/-{2,}/g, "-");

    return slug || "page";
}

function normalizeType(type) {
    const t = String(type || "").toUpperCase().trim();
    if (t !== "IFRAME" && t !== "CUSTOM") {
        throw httpError(400, "Invalid page type (expected IFRAME or CUSTOM)");
    }
    return t;
}

function normalizeInclude(query) {
    const v = String(query?.version || "").toLowerCase();
    if (!v) return "published";
    if (v === "published" || v === "draft" || v === "both") return v;
    throw httpError(400, "Invalid include version (expected published|draft|both)");
}

function validateDraftPayloadForType(type, payload) {
    if (type === "IFRAME") {
        if ("iframeUrl" in payload) {
            const url = String(payload.iframeUrl || "").trim();
            if (!url) throw httpError(400, "iframeUrl is required for IFRAME pages");
            if (!/^https?:\/\//i.test(url)) {
                throw httpError(400, "iframeUrl must start with http:// or https://");
            }
        }
    } else if (type === "CUSTOM") {
        if ("content" in payload) {
            const content = payload.content;
            if (content !== null && content !== undefined && typeof content !== "string") {
                throw httpError(400, "content must be a string");
            }
        }
    }
}

function validateSidebarFields(payload) {
    if (!payload || typeof payload !== "object") return;

    if ("navTitle" in payload && payload.navTitle !== null && payload.navTitle !== undefined) {
        if (typeof payload.navTitle !== "string") throw httpError(400, "navTitle must be a string");
        if (payload.navTitle.trim().length === 0) throw httpError(400, "navTitle cannot be empty");
    }

    if ("navIcon" in payload && payload.navIcon !== null && payload.navIcon !== undefined) {
        if (typeof payload.navIcon !== "string") throw httpError(400, "navIcon must be a string");
        if (payload.navIcon.trim().length === 0) throw httpError(400, "navIcon cannot be empty");
        if (!/^[A-Za-z0-9_]+$/.test(payload.navIcon.trim())) {
            throw httpError(400, "navIcon contains invalid characters");
        }
    }

    if ("showInSidebar" in payload && typeof payload.showInSidebar !== "boolean") {
        throw httpError(400, "showInSidebar must be a boolean");
    }

    if ("navOrder" in payload && payload.navOrder !== null && payload.navOrder !== undefined) {
        const n = Number(payload.navOrder);
        if (!Number.isSafeInteger(n)) throw httpError(400, "navOrder must be an integer");
    }

    if ("navGroup" in payload && payload.navGroup !== null && payload.navGroup !== undefined) {
        if (typeof payload.navGroup !== "string") throw httpError(400, "navGroup must be a string");
        if (payload.navGroup.trim().length === 0) throw httpError(400, "navGroup cannot be empty");
    }
}

function pickVersionView(version) {
    if (!version) return null;
    return {
        id: version.id,
        kind: version.kind,
        content: version.content ?? null,
        iframeUrl: version.iframeUrl ?? null,
        updatedAt: version.updatedAt,
        createdAt: version.createdAt,
        updatedById: version.updatedById,
    };
}

function pickPageListView(page) {
    return {
        id: page.id,
        companyId: page.companyId,
        type: page.type,
        slug: page.slug,
        title: page.title,

        navTitle: page.navTitle ?? null,
        navIcon: page.navIcon ?? null,
        showInSidebar: Boolean(page.showInSidebar),
        navOrder: Number(page.navOrder || 0),
        navGroup: page.navGroup ?? null,

        isPublic: page.isPublic,
        publishedAt: page.publishedAt ?? null,
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
        hasDraft: Boolean(page.draftVersionId),
        hasPublished: Boolean(page.publishedVersionId),
    };
}

function pickPageDetailView(page, { includeDraft, includePublished }) {
    return {
        id: page.id,
        companyId: page.companyId,
        type: page.type,
        slug: page.slug,
        title: page.title,

        navTitle: page.navTitle ?? null,
        navIcon: page.navIcon ?? null,
        showInSidebar: Boolean(page.showInSidebar),
        navOrder: Number(page.navOrder || 0),
        navGroup: page.navGroup ?? null,

        isPublic: page.isPublic,
        publishedAt: page.publishedAt ?? null,
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
        access: {
            users: (page.accesses || [])
                .filter((a) => a.kind === "USER" && a.userId)
                .map((a) => a.userId),
            ranks: (page.accesses || [])
                .filter((a) => a.kind === "RANK" && a.rankId)
                .map((a) => a.rankId),
        },
        draft: includeDraft ? pickVersionView(page.draftVersion) : undefined,
        published: includePublished ? pickVersionView(page.publishedVersion) : undefined,
    };
}

async function findPageOrThrow({ companyId, id = null, slug = null, includeAccess = true }) {
    const where =
        id !== null
            ? { companyId, id }
            : { companyId, slug: String(slug || "").trim() };

    const page = await prisma.customPage.findFirst({
        where,
        include: {
            accesses: includeAccess ? true : false,
            draftVersion: true,
            publishedVersion: true,
        },
    });

    if (!page) throw httpError(404, "Page not found");
    return page;
}

/* -------------------------------------------------------------------------- */
/* PERMISSIONS & RANK HELPERS (FIXED) */
/* -------------------------------------------------------------------------- */

function isWildcard(permsSet, companyId) {
    if (!permsSet || typeof permsSet.has !== "function") return false;
    return permsSet.has(`COMPANY.${companyId}.*`) || permsSet.has("ADMIN.*");
}

/**
 * Extraction tolérante des rankIds depuis user (si présents) + fallback DB.
 * Objectif: ne JAMAIS dépendre uniquement du JWT pour les ranks.
 */
async function getUserRankIdsForCompany(user, companyId) {
    const ids = new Set();
    const cid = Number(companyId);
    if (!Number.isInteger(cid) || cid <= 0) return [];

    // 1) Token / user payload (tolérant)
    const direct = Number(user?.rankId);
    if (Number.isInteger(direct) && direct > 0) ids.add(direct);

    const ceRank = Number(user?.companyEmployee?.rankId);
    const ceCompanyId = Number(user?.companyEmployee?.companyId);
    if (Number.isInteger(ceRank) && ceRank > 0 && Number.isInteger(ceCompanyId) && ceCompanyId === cid) {
        ids.add(ceRank);
    }

    if (Array.isArray(user?.companyEmployees)) {
        for (const ce of user.companyEmployees) {
            const c = Number(ce?.companyId);
            const r = Number(ce?.rankId);
            if (Number.isInteger(c) && c === cid && Number.isInteger(r) && r > 0) ids.add(r);
        }
    }

    if (Array.isArray(user?.ranks)) {
        for (const r of user.ranks) {
            const c = Number(r?.companyId);
            const rid = Number(r?.id);
            if (Number.isInteger(c) && c === cid && Number.isInteger(rid) && rid > 0) ids.add(rid);
        }
    }

    // 2) Fallback DB (source de vérité)
    const userId = Number(user?.userId);
    if (Number.isInteger(userId) && userId > 0) {
        const employment = await prisma.companyEmployee.findUnique({
            where: { companyId_userId: { companyId: cid, userId } },
            select: { rankId: true, status: true },
        });

        // Par défaut: on ne prend le rank que si ACTIVE (cohérent avec votre logique existante)
        const dbRankId =
            employment?.status === "ACTIVE" && Number.isInteger(employment?.rankId) && employment.rankId > 0
                ? employment.rankId
                : null;

        if (dbRankId) ids.add(dbRankId);
    }

    return Array.from(ids);
}

async function getSecurityContext(user, companyId) {
    const cid = Number(companyId);
    if (!Number.isInteger(cid) || cid <= 0) throw httpError(400, "Invalid companyId");

    const userId = Number(user?.userId);
    const permsSet =
        Number.isInteger(userId) && userId > 0
            ? await buildEffectiveCompanyPermissions(userId, cid)
            : new Set();

    const wildcard = isWildcard(permsSet, cid);
    const rankIds = await getUserRankIdsForCompany(user, cid);

    return { userId, permsSet, wildcard, rankIds };
}

/**
 * ACL de lecture:
 * - isPublic => OK
 * - sinon userId ou rankId présent dans CustomPageAccess
 * - override total: COMPANY.{companyId}.* / ADMIN.*
 */
function assertViewAccessOrThrow({ companyId, page, userId, wildcard, rankIds }) {
    if (!page) throw httpError(404, "Page not found");
    if (wildcard) return;
    if (page.isPublic === true) return;

    if (Number.isInteger(userId) && userId > 0 && Array.isArray(page.accesses)) {
        for (const a of page.accesses) {
            if (a?.kind === "USER" && Number(a?.userId) === userId) return;
        }
    }

    const set = new Set(rankIds || []);
    if (set.size > 0 && Array.isArray(page.accesses)) {
        for (const a of page.accesses) {
            if (a?.kind === "RANK") {
                const rid = Number(a?.rankId);
                if (Number.isInteger(rid) && set.has(rid)) return;
            }
        }
    }

    throw httpError(403, "Forbidden");
}

async function buildUniqueSlug({ companyId, baseSlug, excludeId = null }) {
    let slug = baseSlug;
    for (let i = 0; i < 50; i++) {
        const where = { companyId, slug };
        const existing = await prisma.customPage.findFirst({
            where: excludeId ? { ...where, NOT: { id: excludeId } } : where,
            select: { id: true },
        });
        if (!existing) return slug;
        slug = `${baseSlug}-${i + 2}`;
    }
    return `${baseSlug}-${Date.now()}`;
}

/* -------------------------------------------------------------------------- */
/* CRUD */
/* -------------------------------------------------------------------------- */

async function list({ companyId, user, query }) {
    normalizeInclude(query);

    const { userId, wildcard, rankIds } = await getSecurityContext(user, companyId);

    let where = { companyId };

    // Si wildcard => voit tout (y compris pages non publiques sans ACL)
    if (!wildcard) {
        const ors = [{ isPublic: true }];

        if (Number.isInteger(userId) && userId > 0) {
            ors.push({ accesses: { some: { kind: "USER", userId } } });
        }
        if (Array.isArray(rankIds) && rankIds.length > 0) {
            ors.push({ accesses: { some: { kind: "RANK", rankId: { in: rankIds } } } });
        }

        where = { companyId, OR: ors };
    }

    const pages = await prisma.customPage.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        select: {
            id: true,
            companyId: true,
            type: true,
            slug: true,
            title: true,

            navTitle: true,
            navIcon: true,
            showInSidebar: true,
            navOrder: true,
            navGroup: true,

            isPublic: true,
            publishedAt: true,
            createdAt: true,
            updatedAt: true,
            draftVersionId: true,
            publishedVersionId: true,
        },
    });

    return { data: pages.map(pickPageListView) };
}

async function getById({ companyId, user, id, include }) {
    const includeMode = normalizeInclude(include);
    const page = await findPageOrThrow({ companyId, id });

    const { userId, wildcard, rankIds } = await getSecurityContext(user, companyId);
    assertViewAccessOrThrow({ companyId, page, userId, wildcard, rankIds });

    const includeDraft = includeMode === "draft" || includeMode === "both";
    const includePublished = includeMode === "published" || includeMode === "both";

    return pickPageDetailView(page, { includeDraft, includePublished });
}

async function getBySlug({ companyId, user, slug, include }) {
    const includeMode = normalizeInclude(include);
    const page = await findPageOrThrow({ companyId, slug });

    const { userId, wildcard, rankIds } = await getSecurityContext(user, companyId);
    assertViewAccessOrThrow({ companyId, page, userId, wildcard, rankIds });

    const includeDraft = includeMode === "draft" || includeMode === "both";
    const includePublished = includeMode === "published" || includeMode === "both";

    return pickPageDetailView(page, { includeDraft, includePublished });
}

async function create({ companyId, user, payload }) {
    const userId = Number(user?.userId);
    if (!Number.isInteger(userId) || userId <= 0) throw httpError(401, "Unauthorized");

    const type = normalizeType(payload?.type);

    const title = String(payload?.title || "").trim();
    if (!title) throw httpError(400, "title is required");

    validateSidebarFields(payload);

    const requestedSlug = String(payload?.slug || "").trim();
    const baseSlug = slugify(requestedSlug || title);

    const draftData = {
        content: payload?.content ?? null,
        iframeUrl: payload?.iframeUrl ?? null,
    };
    validateDraftPayloadForType(type, draftData);

    const isPublic = Boolean(payload?.isPublic);

    const accessUserIds = uniqInts(payload?.access?.userIds || payload?.accessUserIds);
    const accessRankIds = uniqInts(payload?.access?.rankIds || payload?.accessRankIds);

    const uniqueSlug = await buildUniqueSlug({ companyId, baseSlug });

    const createdId = await prisma.$transaction(async (tx) => {
        const page = await tx.customPage.create({
            data: {
                companyId,
                type,
                slug: uniqueSlug,
                title,

                navTitle: payload?.navTitle ?? null,
                navIcon: payload?.navIcon ?? null,
                showInSidebar: Boolean(payload?.showInSidebar),
                navOrder: Number.isInteger(Number(payload?.navOrder)) ? Number(payload.navOrder) : 0,
                navGroup: payload?.navGroup ?? null,

                isPublic,
                createdById: userId,
                updatedById: userId,
            },
            select: { id: true },
        });

        const draft = await tx.customPageVersion.create({
            data: {
                pageId: page.id,
                kind: "DRAFT",
                content: type === "CUSTOM" ? String(draftData.content ?? "") : null,
                iframeUrl: type === "IFRAME" ? String(draftData.iframeUrl ?? "") : null,
                updatedById: userId,
            },
            select: { id: true },
        });

        await tx.customPage.update({
            where: { id: page.id },
            data: { draftVersionId: draft.id },
        });

        if (isPublic === false) {
            const accessCreates = [];
            for (const uid of accessUserIds) accessCreates.push({ pageId: page.id, kind: "USER", userId: uid });
            for (const rid of accessRankIds) accessCreates.push({ pageId: page.id, kind: "RANK", rankId: rid });

            if (accessCreates.length > 0) {
                await tx.customPageAccess.createMany({ data: accessCreates });
            }
        }

        return page.id;
    });

    return getById({ companyId, user, id: createdId, include: { version: "both" } });
}

/**
 * Update SETTINGS (meta/sidebar/slug/title/type) sans toucher au contenu (draft version).
 */
async function updateSettings({ companyId, user, id, payload }) {
    const userId = Number(user?.userId);
    if (!Number.isInteger(userId) || userId <= 0) throw httpError(401, "Unauthorized");

    const page = await findPageOrThrow({ companyId, id, includeAccess: false });

    validateSidebarFields(payload);

    const nextType = payload?.type ? normalizeType(payload.type) : page.type;

    const nextTitle = "title" in (payload || {}) ? String(payload.title || "").trim() : page.title;
    if (!nextTitle) throw httpError(400, "title cannot be empty");

    let nextSlug = page.slug;
    if ("slug" in (payload || {}) || "title" in (payload || {})) {
        const requestedSlug = String(payload?.slug || "").trim();
        const base = slugify(requestedSlug || nextTitle);
        nextSlug = await buildUniqueSlug({ companyId, baseSlug: base, excludeId: page.id });
    }

    const data = {
        type: nextType,
        title: nextTitle,
        slug: nextSlug,
        updatedById: userId,
    };

    if ("navTitle" in (payload || {})) data.navTitle = payload.navTitle ?? null;
    if ("navIcon" in (payload || {})) data.navIcon = payload.navIcon ?? null;
    if ("showInSidebar" in (payload || {})) data.showInSidebar = Boolean(payload.showInSidebar);
    if ("navOrder" in (payload || {})) data.navOrder = Number(payload.navOrder || 0);
    if ("navGroup" in (payload || {})) data.navGroup = payload.navGroup ?? null;

    await prisma.customPage.update({
        where: { id: page.id },
        data,
    });

    return getById({ companyId, user, id: page.id, include: { version: "both" } });
}

async function updateDraft({ companyId, user, id, payload }) {
    const userId = Number(user?.userId);
    if (!Number.isInteger(userId) || userId <= 0) throw httpError(401, "Unauthorized");

    const page = await findPageOrThrow({ companyId, id });

    const nextType = payload?.type ? normalizeType(payload.type) : page.type;

    const nextTitle = "title" in (payload || {}) ? String(payload.title || "").trim() : page.title;
    if (!nextTitle) throw httpError(400, "title cannot be empty");

    let nextSlug = page.slug;
    if ("slug" in (payload || {}) || "title" in (payload || {})) {
        const requestedSlug = String(payload?.slug || "").trim();
        const base = slugify(requestedSlug || nextTitle);
        nextSlug = await buildUniqueSlug({ companyId, baseSlug: base, excludeId: page.id });
    }

    const draftPatch = {
        content: payload?.content,
        iframeUrl: payload?.iframeUrl,
    };
    validateDraftPayloadForType(nextType, draftPatch);

    const updatedId = await prisma.$transaction(async (tx) => {
        let draftVersionId = page.draftVersionId;

        if (!draftVersionId) {
            const createdDraft = await tx.customPageVersion.create({
                data: {
                    pageId: page.id,
                    kind: "DRAFT",
                    content: nextType === "CUSTOM" ? "" : null,
                    iframeUrl: nextType === "IFRAME" ? "" : null,
                    updatedById: userId,
                },
                select: { id: true },
            });

            draftVersionId = createdDraft.id;

            await tx.customPage.update({
                where: { id: page.id },
                data: { draftVersionId },
            });
        }

        await tx.customPage.update({
            where: { id: page.id },
            data: {
                type: nextType,
                title: nextTitle,
                slug: nextSlug,
                updatedById: userId,
            },
        });

        const data = { updatedById: userId };

        if (nextType === "CUSTOM") {
            if ("content" in (payload || {})) data.content = String(payload.content ?? "");
            data.iframeUrl = null;
        } else {
            if ("iframeUrl" in (payload || {})) data.iframeUrl = String(payload.iframeUrl ?? "");
            data.content = null;
        }

        await tx.customPageVersion.update({
            where: { id: draftVersionId },
            data,
        });

        return page.id;
    });

    return getById({ companyId, user, id: updatedId, include: { version: "both" } });
}

async function publish({ companyId, user, id }) {
    const userId = Number(user?.userId);
    if (!Number.isInteger(userId) || userId <= 0) throw httpError(401, "Unauthorized");

    const page = await findPageOrThrow({ companyId, id });

    if (!page.draftVersionId || !page.draftVersion) {
        throw httpError(400, "No draft to publish");
    }

    const resultId = await prisma.$transaction(async (tx) => {
        const published = await tx.customPageVersion.create({
            data: {
                pageId: page.id,
                kind: "PUBLISHED",
                content: page.type === "CUSTOM" ? String(page.draftVersion.content ?? "") : null,
                iframeUrl: page.type === "IFRAME" ? String(page.draftVersion.iframeUrl ?? "") : null,
                updatedById: userId,
            },
            select: { id: true },
        });

        await tx.customPage.update({
            where: { id: page.id },
            data: {
                publishedVersionId: published.id,
                publishedAt: new Date(),
                updatedById: userId,
            },
        });

        return page.id;
    });

    return getById({ companyId, user, id: resultId, include: { version: "both" } });
}

async function updateAccess({ companyId, user, id, payload }) {
    const userId = Number(user?.userId);
    if (!Number.isInteger(userId) || userId <= 0) throw httpError(401, "Unauthorized");

    const page = await findPageOrThrow({ companyId, id });

    const isPublic =
        "isPublic" in (payload || {})
            ? Boolean(payload.isPublic)
            : "public" in (payload || {})
                ? Boolean(payload.public)
                : page.isPublic;

    const accessUserIds = uniqInts(payload?.access?.userIds || payload?.accessUserIds);
    const accessRankIds = uniqInts(payload?.access?.rankIds || payload?.accessRankIds);

    await prisma.$transaction(async (tx) => {
        await tx.customPage.update({
            where: { id: page.id },
            data: { isPublic, updatedById: userId },
        });

        await tx.customPageAccess.deleteMany({ where: { pageId: page.id } });

        if (isPublic === false) {
            const data = [];
            for (const uid of accessUserIds) data.push({ pageId: page.id, kind: "USER", userId: uid });
            for (const rid of accessRankIds) data.push({ pageId: page.id, kind: "RANK", rankId: rid });

            if (data.length > 0) {
                await tx.customPageAccess.createMany({ data });
            }
        }
    });

    return getById({ companyId, user, id: page.id, include: { version: "both" } });
}

async function remove({ companyId, user, id }) {
    const userId = Number(user?.userId);
    if (!Number.isInteger(userId) || userId <= 0) throw httpError(401, "Unauthorized");

    const page = await prisma.customPage.findFirst({
        where: { companyId, id },
        select: { id: true },
    });
    if (!page) throw httpError(404, "Page not found");

    await prisma.$transaction(async (tx) => {
        await tx.customPageAccess.deleteMany({ where: { pageId: page.id } });
        await tx.customPageVersion.deleteMany({ where: { pageId: page.id } });
        await tx.customPage.delete({ where: { id: page.id } });
    });

    return true;
}

async function listPublishedNav({ companyId, user }) {
    const { userId, wildcard, rankIds } = await getSecurityContext(user, companyId);

    if (!Number.isInteger(userId) || userId <= 0) {
        throw httpError(401, "Unauthorized");
    }

    let where = {
        companyId,
        showInSidebar: true,
        publishedVersionId: { not: null },
    };

    if (!wildcard) {
        const OR = [{ isPublic: true }, { accesses: { some: { kind: "USER", userId } } }];
        if (rankIds.length > 0) OR.push({ accesses: { some: { kind: "RANK", rankId: { in: rankIds } } } });
        where = { ...where, OR };
    }

    const pages = await prisma.customPage.findMany({
        where,
        select: {
            id: true,
            slug: true,
            title: true,
            navTitle: true,
            navIcon: true,
            navOrder: true,
            navGroup: true,
            publishedAt: true,
        },
        orderBy: [{ navOrder: "asc" }, { id: "asc" }],
    });

    // Grouping
    const groupsMap = new Map(); // key: navGroup|null -> items[]
    for (const p of pages) {
        const group = p.navGroup ? String(p.navGroup).trim() : null;
        const key = group || null;

        if (!groupsMap.has(key)) groupsMap.set(key, []);
        groupsMap.get(key).push({
            id: p.id,
            slug: p.slug,
            title: p.title,
            navTitle: p.navTitle ?? null,
            navIcon: p.navIcon ?? null,
            navOrder: Number(p.navOrder || 0),
            navGroup: group,
            publishedAt: p.publishedAt ?? null,
        });
    }

    const data = Array.from(groupsMap.entries()).map(([group, items]) => {
        items.sort((a, b) => {
            const ao = Number(a.navOrder || 0);
            const bo = Number(b.navOrder || 0);
            if (ao !== bo) return ao - bo;
            const at = String(a.navTitle || a.title || "");
            const bt = String(b.navTitle || b.title || "");
            return at.localeCompare(bt, "fr");
        });

        return { group, items };
    });

    data.sort((a, b) => {
        if (a.group === null && b.group === null) return 0;
        if (a.group === null) return 1;
        if (b.group === null) return -1;
        return String(a.group).localeCompare(String(b.group), "fr");
    });

    return { data };
}

module.exports = {
    list,
    getById,
    getBySlug,
    create,
    updateSettings,
    updateDraft,
    publish,
    updateAccess,
    remove,
    listPublishedNav,
};
