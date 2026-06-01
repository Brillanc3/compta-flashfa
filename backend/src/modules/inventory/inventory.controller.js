'use strict';

const prisma = require('../../db');

/* -----------------------------------------------------
   Helpers
----------------------------------------------------- */
function normalizeList(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") return value.split(",").map(v => v.trim());
    return [];
}

/* -----------------------------------------------------
   Fuzzy Filters (MySQL Compatible)
----------------------------------------------------- */

// 🔹 Filter by COFFRE
function buildCoffreConditions(tags) {
    return tags.map(tag => ({
        OR: [
            { owner: { contains: tag } },
            { ownerRef: { name: { contains: tag } } },
        ]
    }));
}

// 🔹 Filter by USERS (fuzzy)
function buildUserConditions(tags) {
    return tags.map(tag => ({
        OR: [
            { user: { name: { contains: tag } } },
            { properName: { contains: tag } },
        ]
    }));
}

// 🔹 Filter by ITEMS
function buildItemConditions(tags) {
    return tags.map(tag => ({
        OR: [
            { itemCode: { contains: tag } },
            { itemLabel: { contains: tag } },
            { metadata: { contains: tag } }, // 👈 MySQL friendly
        ]
    }));
}

// 🔹 GLOBAL SEARCH TAGS
function buildGenericTagConditions(tags) {
    return tags.map(tag => ({
        OR: [
            { itemCode: { contains: tag } },
            { itemLabel: { contains: tag } },
            { properName: { contains: tag } },
            { owner: { contains: tag } },
            { ownerRef: { name: { contains: tag } } },
            { metadata: { contains: tag } }, // 👈 MySQL friendly
        ]
    }));
}


/* -----------------------------------------------------
   MAIN CONTROLLER
----------------------------------------------------- */
async function getInventory(request, reply) {
    const companyId = parseInt(request.headers["x-company-id"], 10);
    const userId = request.user.userId;
    const mode = request.inventoryViewMode; // SELF | ALL

    const {
        page = 1,
        pageSize = 50,
        types,
        coffre,
        users,
        items,
        tags,
        dateFrom,
        dateTo,
    } = request.query || {};

    const take = Number(pageSize) || 50;
    const currentPage = Number(page) || 1;
    const skip = (currentPage - 1) * take;

    const and = [];

    // SELF restriction
    if (mode === "SELF") {
        and.push({ userId });
    }

    /* -------------------------------------------------
       TYPE FILTER
    -------------------------------------------------- */
    if (types) {
        and.push({
            type: { in: normalizeList(types) }
        });
    }

    /* -------------------------------------------------
       DATE RANGE
    -------------------------------------------------- */
    if (dateFrom || dateTo) {
        const d = {};
        if (dateFrom) d.gte = new Date(dateFrom);
        if (dateTo) d.lte = new Date(dateTo);

        and.push({ occurredAt: d });
    }

    /* -------------------------------------------------
       COFFRE FILTER
    -------------------------------------------------- */
    if (coffre) {
        const cTags = normalizeList(coffre);
        const conds = buildCoffreConditions(cTags);
        if (conds.length > 0) and.push({ OR: conds });
    }

    /* -------------------------------------------------
       USER FILTER
    -------------------------------------------------- */
    if (users && mode === "ALL") {
        const uTags = normalizeList(users);
        const conds = buildUserConditions(uTags);
        if (conds.length > 0) and.push({ OR: conds });
    }

    /* -------------------------------------------------
       ITEM FILTER
    -------------------------------------------------- */
    if (items) {
        const iTags = normalizeList(items);
        const conds = buildItemConditions(iTags);
        if (conds.length > 0) and.push({ OR: conds });
    }

    /* -------------------------------------------------
       GLOBAL TAG SEARCH
    -------------------------------------------------- */
    if (tags) {
        const list = normalizeList(tags);
        const conds = buildGenericTagConditions(list);
        if (conds.length > 0) and.push({ OR: conds });
    }

    /* -------------------------------------------------
       QUERY
    -------------------------------------------------- */
    const where = { companyId };
    if (and.length > 0) {
        where.AND = and;
    }
    const [results, total] = await Promise.all([
        prisma.inventoryMovement.findMany({
            where,
            skip,
            take,
            orderBy: { occurredAt: "desc" },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        imageUrl: true,
                        characterId: true,
                        discordId: true,
                        phoneNumber: true,
                        iban: true,
                    }
                },
                ownerRef: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        }),
        prisma.inventoryMovement.count({ where }),
    ]);

    return reply.send({
        page: currentPage,
        pageSize: take,
        total,
        mode,
        results,
    });
}

module.exports = { getInventory };
