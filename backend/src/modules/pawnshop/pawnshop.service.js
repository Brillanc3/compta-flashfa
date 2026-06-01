// backend/src/modules/pawnshop/pawnshop.service.js

const { cpuUsage } = require("process");
const prisma = require("../../db");
const { PawnshopPurchaseStatus } = require("@prisma/client");
const { cp } = require("fs");

/**
 * NOTE SALAIRE (mode “production / matrix”)
 * - La rémunération n’est PAS portée par PawnshopProduct.
 * - Elle est définie via paymentSchemasLoader (matrix) sur la clé:
 *   - pawnshopProductRemunerations
 * - Ce service expose calculatePawnshopProductRemuneration() qui consomme cette matrix
 *   (format tolérant: array/object) et calcule la rémunération à partir des achats VALIDATED
 *   (basé sur le prix de revente).
 */

const PURCHASE_STATUS = {
    DRAFT: "DRAFT",
    VALIDATED: "VALIDATED",
    CANCELED: "CANCELED",
};

function createError(statusCode, code, message, details) {
    const err = new Error(message || "Erreur.");
    err.statusCode = statusCode;
    err.code = code || "ERROR";
    if (details) err.details = details;
    return err;
}

function isNonEmptyString(v) {
    return typeof v === "string" && v.trim().length > 0;
}


function normalizeSearchable(str) {
    return String(str || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function isPrismaUniqueError(error) {
    return error && (error.code === "P2002" || error?.meta?.target);
}

function extractClientIban(client) {
    if (!client) return null;
    const candidates = [client.iban, client.IBAN, client.ibanValue, client.ibanNumber, client.iban_number];
    const v = candidates.find((x) => isNonEmptyString(x));
    return v ? String(v).trim() : null;
}

function extractClientPhone(client) {
    if (!client) return null;
    const candidates = [
        client.phone,
        client.phoneNumber,
        client.phone_number,
        client.telephone,
        client.tel,
        client.mobile,
        client.mobilePhone,
    ];
    const v = candidates.find((x) => isNonEmptyString(x));
    return v ? String(v).trim() : null;
}

function normalizeStatus(s) {
    if (!s) return null;
    const v = String(s).trim().toUpperCase();
    if (v === "DRAFT" || v === "VALIDATED" || v === "CANCELED") return v;
    return null;
}

function toNumber(v, fallback = null) {
    if (v === undefined || v === null) return fallback;
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : fallback;
}

function roundMoney(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

function roundQty(n) {
    return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

function computeItemDerived({ quantity, unitBuyPrice, unitResalePrice }) {
    const q = roundQty(Number(quantity));
    const buy = Number(unitBuyPrice);
    const resale = Number(unitResalePrice);

    if (!Number.isFinite(q) || q <= 0) throw createError(400, "VALIDATION_ERROR", "Quantité invalide.");
    if (!Number.isFinite(buy) || buy < 0) throw createError(400, "VALIDATION_ERROR", "Prix d’achat invalide.");
    if (!Number.isFinite(resale) || resale < 0) throw createError(400, "VALIDATION_ERROR", "Prix de revente invalide.");

    const lineTotal = roundMoney(q * buy);
    const resaleLineTotal = roundMoney(q * resale);

    return { quantity: q, unitBuyPrice: buy, unitResalePrice: resale, lineTotal, resaleLineTotal };
}

/**
 * Matrix rémunération: supporte plusieurs formes:
 * 1) Array: [{ id/value/productId, visible, fixed, percent }, ...]
 * 2) Object map: { [productId]: { visible, fixed, percent }, ... }
 */
function normalizeRemunerationMatrix(matrix) {
    if (!matrix) return new Map();

    // Array
    if (Array.isArray(matrix)) {
        const m = new Map();
        for (const row of matrix) {
            const pidRaw = row?.productId ?? row?.value ?? row?.id ?? row?.key;
            const pid = Number(pidRaw);
            if (!Number.isFinite(pid) || pid <= 0) continue;

            const visible = row?.visible !== false; // default true
            const fixed = Math.max(0, toNumber(row?.fixed, 0));
            const percent = Math.max(0, toNumber(row?.percent, 0));

            m.set(pid, { visible, fixed, percent });
        }
        return m;
    }

    // Object map
    if (typeof matrix === "object") {
        const m = new Map();
        for (const [k, row] of Object.entries(matrix)) {
            const pid = Number(k);
            if (!Number.isFinite(pid) || pid <= 0) continue;

            const visible = row?.visible !== false; // default true
            const fixed = Math.max(0, toNumber(row?.fixed, 0));
            const percent = Math.max(0, toNumber(row?.percent, 0));

            m.set(pid, { visible, fixed, percent });
        }
        return m;
    }

    return new Map();
}

function computeSalaryFromAgg({ aggByProductId, matrixMap }) {
    let total = 0;
    const lines = [];
    for (const [productId, agg] of aggByProductId.entries()) {
        const cfg = matrixMap.get(productId);
        if (!cfg) continue;
        if (cfg.visible === false) continue;

        let qty = Number(agg.quantity || 0);

        const fixedPart = roundMoney(qty * Number(cfg.fixed || 0));

        const resaleTotal = Number(agg.resaleTotal || 0);
        const percentPart = roundMoney((resaleTotal * Number(cfg.percent || 0)) / 100);

        const calculatedValue = roundMoney(fixedPart + percentPart);

        total += calculatedValue;

        lines.push({
            productId,
            quantity: qty,
            resaleTotal,
            fixed: Number(cfg.fixed || 0),
            percent: Number(cfg.percent || 0),
            fixedPart,
            percentPart,
            calculatedValue,
        });
    }

    return { total: roundMoney(total), lines };
}

async function assertPurchaseAccessOrThrow({ companyId, actorEmployeeId, canViewAll, id }) {
    const purchase = await prisma.pawnshopPurchase.findUnique({
        where: { id },
        include: { items: true },
    });

    if (!purchase) throw createError(404, "NOT_FOUND", "Feuille d’achat introuvable.");
    if (purchase.companyId !== companyId) throw createError(404, "NOT_FOUND", "Feuille d’achat introuvable.");

    if (!canViewAll && purchase.createdByEmployeeId !== actorEmployeeId) {
        throw createError(403, "FORBIDDEN", "Accès refusé à cette feuille d’achat.");
    }

    return purchase;
}

function assertDraftOrThrow(purchase) {
    if (purchase.status !== PURCHASE_STATUS.DRAFT) {
        throw createError(409, "PURCHASE_NOT_DRAFT", "Action impossible : la feuille d’achat n’est pas en brouillon.", {
            status: purchase.status,
        });
    }
}

async function getEffectiveBuyPrice({ companyId, partnerId, product }) {
    if (partnerId) {
        const row = await prisma.pawnshopPartnerBuyPrice.findFirst({
            where: { companyId, partnerId, productId: product.id },
        });
        if (row && toNumber(row.buyPrice, null) !== null) return Number(row.buyPrice);
    }
    return Number(product.buyPrice || 0);
}

/* ------------------------- Purchases ------------------------- */

async function listPurchases({ companyId, actorEmployeeId, canViewAll, query }) {
    const status = normalizeStatus(query?.status);
    const clientId = query?.clientId ? Number(query.clientId) : null;
    const partnerId = query?.partnerId ? Number(query.partnerId) : null;
    const employeeId = query?.employeeId ? Number(query.employeeId) : null;
    const includeItems = !!query?.includeItems;
    const search = query?.search ? String(query.search).trim() : null;
    const dateStart = query?.dateStart ? new Date(query.dateStart) : null;
    const dateEnd = query?.dateEnd ? new Date(query.dateEnd) : null;

    const pageSize = Math.min(Math.max(Number(query?.pageSize || 25), 1), 100);
    const cursorId = query?.cursor ? Number(query.cursor) : null;
    const page = query?.page ? Number(query.page) : 1;

    const where = {
        companyId,
        ...(status ? { status } : {}),
        ...(clientId ? { clientId } : {}),
        ...(partnerId ? { partnerId } : {}),
        ...(employeeId ? { createdByEmployeeId: employeeId } : {}),
        ...(!canViewAll ? { createdByEmployeeId: actorEmployeeId } : {}),
    };

    if (search) {
        const searchAsId = Number(search);
        const searchConditions = [
            { client: { name: { contains: search } } },
        ];
        if (Number.isFinite(searchAsId) && searchAsId > 0) {
            searchConditions.push({ id: searchAsId });
        }
        where.OR = searchConditions;
    }

    if (dateStart || dateEnd) {
        where.createdAt = {};
        if (dateStart) where.createdAt.gte = dateStart;
        if (dateEnd) where.createdAt.lte = dateEnd;
    }

    const include = includeItems
        ? {
            client: true,
            partner: true,
            createdByEmployee: { include: { user: { select: { id: true, name: true, username: true } } } },
            items: { include: { product: true } },
        }
        : {
            client: true,
            partner: true,
            createdByEmployee: { include: { user: { select: { id: true, name: true, username: true } } } },
        };

    if (cursorId && Number.isFinite(cursorId) && cursorId > 0) {
        const items = await prisma.pawnshopPurchase.findMany({
            where,
            orderBy: { id: "desc" },
            take: pageSize,
            skip: 1,
            cursor: { id: cursorId },
            include,
        });

        const nextCursor = items.length === pageSize ? items[items.length - 1].id : null;
        return { items, nextCursor };
    }

    const skip = (Math.max(page, 1) - 1) * pageSize;

    const [total, items] = await prisma.$transaction([
        prisma.pawnshopPurchase.count({ where }),
        prisma.pawnshopPurchase.findMany({
            where,
            orderBy: { id: "desc" },
            skip,
            take: pageSize,
            include,
        }),
    ]);

    return { items, total, page: Math.max(page, 1), pageSize };
}

async function createPurchase({ companyId, actorEmployeeId, clientId, partnerId, notes }) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw createError(400, "CLIENT_NOT_FOUND", "Client introuvable.");

    if (partnerId) {
        const partner = await prisma.pawnshopPartner.findUnique({ where: { id: partnerId } });
        if (!partner || partner.companyId !== companyId) throw createError(400, "PARTNER_NOT_FOUND", "Partenaire introuvable.");
    }

    return prisma.pawnshopPurchase.create({
        data: {
            companyId,
            clientId,
            partnerId: partnerId || null,
            createdByEmployeeId: actorEmployeeId,
            status: PURCHASE_STATUS.DRAFT,
            notes: notes || null,
        },
        include: {
            client: true,
            partner: true,
            createdByEmployee: { include: { user: { select: { id: true, name: true, username: true } } } },
            items: { include: { product: true } },
        },
    });
}

async function getPurchase({ companyId, actorEmployeeId, canViewAll, id }) {
    const purchase = await prisma.pawnshopPurchase.findUnique({
        where: { id },
        include: {
            client: true,
            partner: true,
            createdByEmployee: true,
            items: { include: { product: true } },
        },
    });

    if (!purchase) throw createError(404, "NOT_FOUND", "Feuille d’achat introuvable.");
    if (purchase.companyId !== companyId) throw createError(404, "NOT_FOUND", "Feuille d’achat introuvable.");

    if (!canViewAll && purchase.createdByEmployeeId !== actorEmployeeId) {
        throw createError(403, "FORBIDDEN", "Accès refusé à cette feuille d’achat.");
    }

    return purchase;
}

async function updatePurchase({ companyId, actorEmployeeId, canViewAll, id, patch }) {
    const purchase = await assertPurchaseAccessOrThrow({ companyId, actorEmployeeId, canViewAll, id });
    assertDraftOrThrow(purchase);

    const data = {};

    if (patch.clientId !== undefined) {
        if (!patch.clientId) throw createError(400, "VALIDATION_ERROR", "clientId invalide.");
        const client = await prisma.client.findUnique({ where: { id: patch.clientId } });
        if (!client) throw createError(400, "CLIENT_NOT_FOUND", "Client introuvable.");
        data.clientId = patch.clientId;
    }

    if (patch.partnerId !== undefined) {
        if (patch.partnerId === null) {
            data.partnerId = null;
        } else {
            const partner = await prisma.pawnshopPartner.findUnique({ where: { id: patch.partnerId } });
            if (!partner || partner.companyId !== companyId) throw createError(400, "PARTNER_NOT_FOUND", "Partenaire introuvable.");
            data.partnerId = patch.partnerId;
        }
    }

    if (patch.notes !== undefined) data.notes = patch.notes || null;

    return prisma.pawnshopPurchase.update({
        where: { id },
        data,
        include: {
            client: true,
            partner: true,
            createdByEmployee: true,
            items: { include: { product: true } },
        },
    });
}

async function deletePurchase({ companyId, actorEmployeeId, canViewAll, id }) {
    const purchase = await assertPurchaseAccessOrThrow({ companyId, actorEmployeeId, canViewAll, id });
    assertDraftOrThrow(purchase);

    await prisma.$transaction([
        prisma.pawnshopPurchaseItem.deleteMany({ where: { purchaseId: id } }),
        prisma.pawnshopPurchase.delete({ where: { id } }),
    ]);

    return { ok: true };
}

async function addPurchaseItem({
    companyId,
    actorEmployeeId,
    canViewAll,
    purchaseId,
    productId,
    quantity,
    unitBuyPrice,
    unitResalePrice,
}) {
    const purchase = await assertPurchaseAccessOrThrow({ companyId, actorEmployeeId, canViewAll, id: purchaseId });
    assertDraftOrThrow(purchase);

    const product = await prisma.pawnshopProduct.findUnique({ where: { id: productId } });
    if (!product || product.companyId !== companyId) throw createError(400, "PRODUCT_NOT_FOUND", "Produit introuvable.");
    if (product.isActive === false) throw createError(409, "PRODUCT_INACTIVE", "Produit désactivé.");

    const buy =
        unitBuyPrice != null ? Number(unitBuyPrice) : await getEffectiveBuyPrice({ companyId, partnerId: purchase.partnerId, product });

    const resale = unitResalePrice != null ? Number(unitResalePrice) : Number(product.resalePrice || 0);

    const derived = computeItemDerived({
        quantity,
        unitBuyPrice: buy,
        unitResalePrice: resale,
    });

    return prisma.pawnshopPurchaseItem.create({
        data: {
            purchaseId,
            productId,
            quantity: derived.quantity,
            unitBuyPrice: derived.unitBuyPrice,
            unitResalePrice: derived.unitResalePrice,
            lineTotal: derived.lineTotal,
            resaleLineTotal: derived.resaleLineTotal,
            // salaryLineTotal: optionnel / calculé via payroll (matrix)
        },
        include: { product: true },
    });
}

async function updatePurchaseItem({ companyId, actorEmployeeId, canViewAll, purchaseId, itemId, patch }) {
    const purchase = await assertPurchaseAccessOrThrow({ companyId, actorEmployeeId, canViewAll, id: purchaseId });
    assertDraftOrThrow(purchase);

    const item = await prisma.pawnshopPurchaseItem.findUnique({
        where: { id: itemId },
        include: { product: true },
    });
    if (!item || item.purchaseId !== purchaseId) throw createError(404, "NOT_FOUND", "Ligne introuvable.");

    const data = {};
    if (patch.quantity !== undefined) data.quantity = Number(patch.quantity);
    if (patch.unitBuyPrice !== undefined) data.unitBuyPrice = Number(patch.unitBuyPrice);
    if (patch.unitResalePrice !== undefined) data.unitResalePrice = Number(patch.unitResalePrice);

    const nextQuantity = data.quantity !== undefined ? data.quantity : Number(item.quantity);
    const nextBuy = data.unitBuyPrice !== undefined ? data.unitBuyPrice : Number(item.unitBuyPrice);
    const nextResale = data.unitResalePrice !== undefined ? data.unitResalePrice : Number(item.unitResalePrice);

    const derived = computeItemDerived({
        quantity: nextQuantity,
        unitBuyPrice: nextBuy,
        unitResalePrice: nextResale,
    });

    data.quantity = derived.quantity;
    data.unitBuyPrice = derived.unitBuyPrice;
    data.unitResalePrice = derived.unitResalePrice;
    data.lineTotal = derived.lineTotal;
    data.resaleLineTotal = derived.resaleLineTotal;

    return prisma.pawnshopPurchaseItem.update({
        where: { id: itemId },
        data,
        include: { product: true },
    });
}

async function deletePurchaseItem({ companyId, actorEmployeeId, canViewAll, purchaseId, itemId }) {
    const purchase = await assertPurchaseAccessOrThrow({ companyId, actorEmployeeId, canViewAll, id: purchaseId });
    assertDraftOrThrow(purchase);

    const item = await prisma.pawnshopPurchaseItem.findUnique({ where: { id: itemId } });
    if (!item || item.purchaseId !== purchaseId) throw createError(404, "NOT_FOUND", "Ligne introuvable.");

    await prisma.pawnshopPurchaseItem.delete({ where: { id: itemId } });
    return { ok: true };
}

async function validatePurchase({ companyId, actorEmployeeId, canViewAll, id }) {
    return prisma.$transaction(async (tx) => {
        const purchase = await tx.pawnshopPurchase.findUnique({
            where: { id },
            include: {
                client: true,
                partner: true,
                createdByEmployee: true,
                items: { include: { product: true } },
            },
        });

        if (!purchase) throw createError(404, "NOT_FOUND", "Feuille d’achat introuvable.");
        if (purchase.companyId !== companyId) throw createError(404, "NOT_FOUND", "Feuille d’achat introuvable.");

        if (!canViewAll && purchase.createdByEmployeeId !== actorEmployeeId) {
            throw createError(403, "FORBIDDEN", "Accès refusé à cette feuille d’achat.");
        }

        if (purchase.status !== PURCHASE_STATUS.DRAFT) {
            throw createError(409, "PURCHASE_NOT_DRAFT", "Validation impossible : pas en brouillon.", { status: purchase.status });
        }
        if (!purchase.items || purchase.items.length === 0) {
            throw createError(409, "PURCHASE_EMPTY", "Validation impossible : aucune ligne produit.");
        }

        const iban = extractClientIban(purchase.client);
        const phone = extractClientPhone(purchase.client);
        if (!iban || !phone) {
            throw createError(
                409,
                "CLIENT_MISSING_REQUIRED_FIELDS",
                "Validation impossible : le client doit avoir un IBAN et un numéro de téléphone.",
                { missing: { iban: !iban, phone: !phone } }
            );
        }

        let totalBuy = 0;
        let totalResale = 0;

        for (const it of purchase.items) {
            const q = Number(it.quantity);
            const buy = Number(it.unitBuyPrice);
            const resale = Number(it.unitResalePrice);

            const derived = computeItemDerived({
                quantity: q,
                unitBuyPrice: buy,
                unitResalePrice: resale,
            });

            totalBuy += derived.lineTotal;
            totalResale += derived.resaleLineTotal;

            await tx.pawnshopPurchaseItem.update({
                where: { id: it.id },
                data: {
                    quantity: derived.quantity,
                    unitBuyPrice: derived.unitBuyPrice,
                    unitResalePrice: derived.unitResalePrice,
                    lineTotal: derived.lineTotal,
                    resaleLineTotal: derived.resaleLineTotal,
                },
            });
        }

        totalBuy = roundMoney(totalBuy);
        totalResale = roundMoney(totalResale);

        const updated = await tx.pawnshopPurchase.update({
            where: { id },
            data: {
                status: PURCHASE_STATUS.VALIDATED,
                validatedAt: new Date(),
                totalBuyAmount: totalBuy,
                totalResaleAmount: totalResale,
            },
            include: {
                client: true,
                partner: true,
                createdByEmployee: true,
                items: { include: { product: true } },
            },
        });

        await linkPurchaseItemsToInventory(tx, { companyId, purchaseId: id, items: updated.items });

        return updated;
    });
}

async function markPurchasePaid({ companyId, actorEmployeeId, canViewAll, id }) {
    const purchase = await assertPurchaseAccessOrThrow({ companyId, actorEmployeeId, canViewAll, id });

    if (purchase.status !== PURCHASE_STATUS.VALIDATED) {
        throw createError(409, "PURCHASE_NOT_VALIDATED", "Paiement impossible : la feuille doit être validée.", { status: purchase.status });
    }

    return prisma.pawnshopPurchase.update({
        where: { id },
        data: {
            paymentStatus: "PAID_TRANSFER",
            paidAt: new Date(),
        },
        include: {
            client: true,
            partner: true,
            createdByEmployee: { include: { user: { select: { id: true, name: true, username: true } } } },
            items: { include: { product: true } },
        },
    });
}

async function changeOwner({ companyId, actorEmployeeId, canViewAll, id, newEmployeeId }) {
    const purchase = await assertPurchaseAccessOrThrow({ companyId, actorEmployeeId, canViewAll, id });
    assertDraftOrThrow(purchase);

    const newEmployee = await prisma.companyEmployee.findFirst({
        where: { id: newEmployeeId, companyId, status: "ACTIVE" },
        select: { id: true },
    });
    if (!newEmployee) throw createError(400, "EMPLOYEE_NOT_FOUND", "Employé introuvable ou inactif.");

    return prisma.pawnshopPurchase.update({
        where: { id },
        data: { createdByEmployeeId: newEmployeeId },
        include: {
            client: true,
            partner: true,
            createdByEmployee: { include: { user: { select: { id: true, name: true, username: true } } } },
            items: { include: { product: true } },
        },
    });
}

async function deleteCanceledPurchase({ companyId, actorEmployeeId, canViewAll, id }) {
    const purchase = await assertPurchaseAccessOrThrow({ companyId, actorEmployeeId, canViewAll, id });

    if (purchase.status !== PURCHASE_STATUS.CANCELED) {
        throw createError(409, "PURCHASE_NOT_CANCELED", "Cette action ne s'applique qu'aux feuilles annulées.", { status: purchase.status });
    }

    await prisma.$transaction([
        prisma.pawnshopPurchaseItem.deleteMany({ where: { purchaseId: id } }),
        prisma.pawnshopPurchase.delete({ where: { id } }),
    ]);

    return { ok: true };
}

async function getPurchaseStatsByEmployee({ companyId, dateStart, dateEnd }) {
    const where = {
        companyId,
        status: PURCHASE_STATUS.VALIDATED,
    };

    if (dateStart || dateEnd) {
        where.validatedAt = {};
        if (dateStart) where.validatedAt.gte = new Date(dateStart);
        if (dateEnd) {
            const end = new Date(dateEnd);
            end.setHours(23, 59, 59, 999);
            where.validatedAt.lte = end;
        }
    }

    const purchases = await prisma.pawnshopPurchase.findMany({
        where,
        select: {
            id: true,
            createdByEmployeeId: true,
            totalBuyAmount: true,
            totalResaleAmount: true,
            validatedAt: true,
            createdByEmployee: {
                select: { id: true, user: { select: { id: true, name: true, username: true } } },
            },
        },
    });

    const byEmployee = new Map();
    for (const p of purchases) {
        const eid = p.createdByEmployeeId;
        if (!byEmployee.has(eid)) {
            byEmployee.set(eid, {
                employeeId: eid,
                employee: p.createdByEmployee,
                purchaseCount: 0,
                totalBuyAmount: 0,
                totalResaleAmount: 0,
            });
        }
        const row = byEmployee.get(eid);
        row.purchaseCount += 1;
        row.totalBuyAmount = roundMoney(row.totalBuyAmount + Number(p.totalBuyAmount || 0));
        row.totalResaleAmount = roundMoney(row.totalResaleAmount + Number(p.totalResaleAmount || 0));
    }

    return Array.from(byEmployee.values()).sort((a, b) => b.totalBuyAmount - a.totalBuyAmount);
}

async function cancelPurchase({ companyId, actorEmployeeId, canViewAll, id, reason }) {
    const purchase = await assertPurchaseAccessOrThrow({ companyId, actorEmployeeId, canViewAll, id });

    if (purchase.status === PURCHASE_STATUS.CANCELED) {
        throw createError(409, "PURCHASE_ALREADY_CANCELED", "La feuille d’achat est déjà annulée.");
    }

    return prisma.pawnshopPurchase.update({
        where: { id },
        data: {
            status: PURCHASE_STATUS.CANCELED,
            canceledAt: new Date(),
            cancelReason: reason || null,
        },
        include: {
            client: true,
            partner: true,
            createdByEmployee: true,
            items: { include: { product: true } },
        },
    });
}


/* ------------------------- Clients ------------------------- */

async function listClients({ companyId, query }) {
    const page = Math.max(Number(query?.page || 1), 1);
    const pageSize = Math.min(Math.max(Number(query?.limit || query?.pageSize || 15), 1), 100);
    const search = String(query?.search || "").trim();

    const where = { companyId };

    if (search) {
        const normalizedSearch = normalizeSearchable(search);
        const searchWords = normalizedSearch.split(" ").filter(Boolean);

        if (searchWords.length > 0) {
            where.AND = searchWords.map((word) => ({
                OR: [
                    { nameSearchable: { contains: word } },
                    { name: { contains: search } },
                    { phoneNumber: { contains: search } },
                    { iban: { contains: search } },
                ],
            }));
        }
    }

    const skip = (page - 1) * pageSize;

    const [total, items] = await prisma.$transaction([
        prisma.client.count({ where }),
        prisma.client.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: [{ name: "asc" }, { id: "asc" }],
            select: {
                id: true,
                name: true,
                phoneNumber: true,
                address: true,
                iban: true,
                cni: true,
                companyId: true,
                createdAt: true,
            },
        }),
    ]);

    return {
        items,
        total,
        page,
        pageSize,
    };
}

async function getClient({ companyId, id }) {
    const client = await prisma.client.findFirst({
        where: { id, companyId },
        include: {
            cards: {
                select: {
                    id: true,
                    publicLink: true,
                    stampCount: true,
                    status: true,
                    createdAt: true,
                    templateId: true,
                },
                orderBy: { id: "desc" },
            },
            pawnshopPurchases: {
                select: {
                    id: true,
                    status: true,
                    createdAt: true,
                    totalBuyAmount: true,
                    totalResaleAmount: true,
                },
                orderBy: { id: "desc" },
                take: 20,
            },
        },
    });

    if (!client) {
        throw createError(404, "NOT_FOUND", "Client introuvable.");
    }

    return client;
}

async function createClient({ companyId, payload }) {
    const name = String(payload?.name || "").trim();
    if (!name) throw createError(400, "VALIDATION_ERROR", "name invalide.");

    const data = {
        companyId,
        name,
        nameSearchable: normalizeSearchable(name),
        phoneNumber: isNonEmptyString(payload?.phoneNumber) ? String(payload.phoneNumber).trim() : null,
        address: isNonEmptyString(payload?.address) ? String(payload.address).trim() : null,
        iban: isNonEmptyString(payload?.iban) ? String(payload.iban).trim() : null,
        cni: isNonEmptyString(payload?.cni) ? String(payload.cni).trim() : null,
    };

    try {
        return await prisma.client.create({ data });
    } catch (error) {
        if (isPrismaUniqueError(error)) {
            throw createError(409, "CLIENT_ALREADY_EXISTS", "Un client avec ce nom existe déjà pour cette entreprise.");
        }
        throw error;
    }
}

async function updateClient({ companyId, id, patch }) {
    const client = await prisma.client.findFirst({ where: { id, companyId } });
    if (!client) throw createError(404, "NOT_FOUND", "Client introuvable.");

    const data = {};

    if (patch.name !== undefined) {
        const name = String(patch.name || "").trim();
        if (!name) throw createError(400, "VALIDATION_ERROR", "name invalide.");
        data.name = name;
        data.nameSearchable = normalizeSearchable(name);
    }

    if (patch.phoneNumber !== undefined) {
        data.phoneNumber = isNonEmptyString(patch.phoneNumber) ? String(patch.phoneNumber).trim() : null;
    }

    if (patch.address !== undefined) {
        data.address = isNonEmptyString(patch.address) ? String(patch.address).trim() : null;
    }

    if (patch.iban !== undefined) {
        data.iban = isNonEmptyString(patch.iban) ? String(patch.iban).trim() : null;
    }

    if (patch.cni !== undefined) {
        data.cni = isNonEmptyString(patch.cni) ? String(patch.cni).trim() : null;
    }

    try {
        return await prisma.client.update({ where: { id }, data });
    } catch (error) {
        if (isPrismaUniqueError(error)) {
            throw createError(409, "CLIENT_ALREADY_EXISTS", "Un client avec ce nom existe déjà pour cette entreprise.");
        }
        throw error;
    }
}

/* ------------------------- Products ------------------------- */

async function listProducts({ companyId, query }) {
    const includeInactive = !!query?.includeInactive;
    const search = (query?.search || "").toString().trim();

    const where = {
        companyId,
        ...(includeInactive ? {} : { isActive: true }),
        ...(search
            ? {
                OR: [{ name: { contains: search } }, { sku: { contains: search } }],
            }
            : {}),
    };

    const items = await prisma.pawnshopProduct.findMany({
        where,
        orderBy: { id: "desc" },
    });

    return { items };
}


async function listPurchaseCatalog({ companyId, query }) {
    const includeInactive = !!query?.includeInactive;
    const search = String(query?.search || "").trim();

    const where = {
        companyId,
        ...(includeInactive ? {} : { isActive: true }),
        ...(search
            ? {
                OR: [{ name: { contains: search } }, { sku: { contains: search } }],
            }
            : {}),
    };

    const items = await prisma.pawnshopProduct.findMany({
        where,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: {
            id: true,
            name: true,
            sku: true,
            buyPrice: true,
            isActive: true,
        },
    });

    return { items };
}

async function createProduct({ companyId, name, sku, buyPrice, resalePrice, isActive, inventoryOwner }) {
    const bp = toNumber(buyPrice, null);
    const rp = toNumber(resalePrice, null);
    if (bp === null || bp < 0) throw createError(400, "VALIDATION_ERROR", "buyPrice invalide.");
    if (rp === null || rp < 0) throw createError(400, "VALIDATION_ERROR", "resalePrice invalide.");

    return prisma.pawnshopProduct.create({
        data: {
            companyId,
            name,
            sku: sku || null,
            isActive: isActive !== false,
            inventoryOwner: inventoryOwner ? String(inventoryOwner).trim() : null,
            buyPrice: bp,
            resalePrice: rp,
        },
    });
}

async function updateProduct({ companyId, id, patch }) {
    const product = await prisma.pawnshopProduct.findUnique({ where: { id } });
    if (!product || product.companyId !== companyId) throw createError(404, "NOT_FOUND", "Produit introuvable.");

    const data = {};

    if (patch.name !== undefined) {
        const n = (patch.name || "").toString().trim();
        if (!n) throw createError(400, "VALIDATION_ERROR", "name invalide.");
        data.name = n;
    }
    if (patch.sku !== undefined) data.sku = patch.sku ? String(patch.sku).trim() : null;

    if (patch.buyPrice !== undefined) {
        const bp = toNumber(patch.buyPrice, null);
        if (bp === null || bp < 0) throw createError(400, "VALIDATION_ERROR", "buyPrice invalide.");
        data.buyPrice = bp;
    }
    if (patch.resalePrice !== undefined) {
        const rp = toNumber(patch.resalePrice, null);
        if (rp === null || rp < 0) throw createError(400, "VALIDATION_ERROR", "resalePrice invalide.");
        data.resalePrice = rp;
    }

    if (patch.isActive !== undefined) data.isActive = patch.isActive === true;
    if (patch.inventoryOwner !== undefined) data.inventoryOwner = patch.inventoryOwner ? String(patch.inventoryOwner).trim() : null;

    return prisma.pawnshopProduct.update({ where: { id }, data });
}

async function deleteProduct({ companyId, id }) {
    const product = await prisma.pawnshopProduct.findUnique({ where: { id } });
    if (!product || product.companyId !== companyId) throw createError(404, "NOT_FOUND", "Produit introuvable.");

    await prisma.pawnshopProduct.delete({ where: { id } });
    return { ok: true };
}

/* ------------------------- Partners + Prices ------------------------- */

async function listPartners({ companyId, query }) {
    const includeInactive = !!query?.includeInactive;
    const search = (query?.search || "").toString().trim();

    const where = {
        companyId,
        ...(includeInactive ? {} : { isActive: true }),
        ...(search ? { name: { contains: search } } : {}),
    };

    const items = await prisma.pawnshopPartner.findMany({
        where,
        orderBy: { id: "desc" },
    });

    return { items };
}

async function createPartner({ companyId, name, notes, isActive }) {
    return prisma.pawnshopPartner.create({
        data: {
            companyId,
            name,
            notes: notes || null,
            isActive: isActive !== false,
        },
    });
}

async function updatePartner({ companyId, id, patch }) {
    const partner = await prisma.pawnshopPartner.findUnique({ where: { id } });
    if (!partner || partner.companyId !== companyId) throw createError(404, "NOT_FOUND", "Partenaire introuvable.");

    const data = {};
    if (patch.name !== undefined) {
        const n = (patch.name || "").toString().trim();
        if (!n) throw createError(400, "VALIDATION_ERROR", "name invalide.");
        data.name = n;
    }
    if (patch.notes !== undefined) data.notes = patch.notes ? String(patch.notes).trim() : null;
    if (patch.isActive !== undefined) data.isActive = patch.isActive === true;

    return prisma.pawnshopPartner.update({ where: { id }, data });
}

async function deletePartner({ companyId, id }) {
    const partner = await prisma.pawnshopPartner.findUnique({ where: { id } });
    if (!partner || partner.companyId !== companyId) throw createError(404, "NOT_FOUND", "Partenaire introuvable.");

    await prisma.$transaction([
        prisma.pawnshopPartnerBuyPrice.deleteMany({ where: { partnerId: id } }),
        prisma.pawnshopPartner.delete({ where: { id } }),
    ]);

    return { ok: true };
}

async function getPartnerPrices({ companyId, partnerId }) {
    const partner = await prisma.pawnshopPartner.findUnique({ where: { id: partnerId } });
    if (!partner || partner.companyId !== companyId) throw createError(404, "NOT_FOUND", "Partenaire introuvable.");

    const rows = await prisma.pawnshopPartnerBuyPrice.findMany({
        where: { companyId, partnerId },
        include: { product: true },
        orderBy: { id: "desc" },
    });

    return { items: rows };
}

async function putPartnerPrices({ companyId, partnerId, items }) {
    const partner = await prisma.pawnshopPartner.findUnique({ where: { id: partnerId } });
    if (!partner || partner.companyId !== companyId) throw createError(404, "NOT_FOUND", "Partenaire introuvable.");

    const productIds = Array.from(new Set((items || []).map((x) => Number(x.productId)).filter((x) => x > 0)));

    if (productIds.length === 0) {
        await prisma.pawnshopPartnerBuyPrice.deleteMany({ where: { companyId, partnerId } });
        return { ok: true, items: [] };
    }

    const products = await prisma.pawnshopProduct.findMany({
        where: { companyId, id: { in: productIds } },
        select: { id: true },
    });

    const found = new Set(products.map((p) => p.id));
    const missing = productIds.filter((id) => !found.has(id));
    if (missing.length) throw createError(400, "PRODUCT_NOT_FOUND", "Certains produits sont introuvables.", { missing });

    const upserts = items.map((it) => {
        const productId = Number(it.productId);
        const buyPrice = toNumber(it.buyPrice ?? it.unitBuyPrice, null);

        if (!Number.isFinite(productId) || productId <= 0) {
            throw createError(400, "VALIDATION_ERROR", "productId invalide.", { productId: it.productId });
        }
        if (buyPrice === null || buyPrice < 0) {
            throw createError(400, "VALIDATION_ERROR", "buyPrice invalide.", { productId });
        }

        return prisma.pawnshopPartnerBuyPrice.upsert({
            where: { partnerId_productId: { partnerId, productId } },
            create: { companyId, partnerId, productId, buyPrice },
            update: { buyPrice, updatedAt: new Date() },
        });
    });

    await prisma.$transaction([
        prisma.pawnshopPartnerBuyPrice.deleteMany({ where: { companyId, partnerId, productId: { notIn: productIds } } }),
        ...upserts,
    ]);

    const rows = await prisma.pawnshopPartnerBuyPrice.findMany({
        where: { companyId, partnerId },
        include: { product: true },
        orderBy: { id: "desc" },
    });

    return { ok: true, items: rows };
}

/* ------------------------- Salary integration (matrix) ------------------------- */

/**
 * ServiceFunction utilisée par salaryCalculators (clé: pawnshopProductRemunerations)
 *
 * Attendu:
 * - args.companyId
 * - args.employeeId (ou companyEmployeeId)
 * - args.from / args.to (ou startDate/endDate/dateFrom/dateTo)
 * - args.paymentValue / args.paymentValues / args.payments contenant la matrix
 *
 * Retour (tolérant): { total, lines }
 * - total: number
 * - lines: [{ productId, quantity, resaleTotal, fixed, percent, calculatedValue, ... }]
 */
async function calculatePawnshopProductRemuneration(employee, dateRange) {
    if (!employee?.id) {
        return { key: "pawnshopProductRemunerations", value: 0, templateVariables: { lines: [], calculatedValue: 0 } };
    }

    const companyId = Number(employee.companyId);
    const employeeId = Number(employee.id);

    if (!Number.isFinite(companyId) || companyId <= 0) {
        throw createError(400, "VALIDATION_ERROR", "companyId requis.");
    }
    if (!Number.isFinite(employeeId) || employeeId <= 0) {
        throw createError(400, "VALIDATION_ERROR", "employeeId requis.");
    }

    const from = new Date(dateRange?.from);
    const to = new Date(dateRange?.to);

    if (!dateRange?.from || Number.isNaN(from.getTime())) {
        throw createError(400, "VALIDATION_ERROR", "dateRange.from invalide.");
    }
    if (!dateRange?.to || Number.isNaN(to.getTime())) {
        throw createError(400, "VALIDATION_ERROR", "dateRange.to invalide.");
    }

    // Matrice depuis Rank -> remunerationConfig (d'après ton payload)
    const matrix = employee?.rank?.remunerationConfig?.pawnshopProductRemunerations ?? null;
    const matrixMap = normalizeRemunerationMatrix(matrix);

    const purchases = await prisma.pawnshopPurchase.findMany({
        where: {
            companyId,
            createdByEmployeeId: employeeId,
            status: PURCHASE_STATUS.VALIDATED,
            validatedAt: { gte: from, lte: to },
        },
        select: {
            id: true,
            status: true,
            validatedAt: true,
            items: {
                select: {
                    productId: true,
                    quantity: true,
                    resaleLineTotal: true,
                },
            },
        },
        orderBy: { id: "desc" },
    });

    const aggByProductId = new Map();

    for (const p of purchases) {
        for (const it of p.items || []) {
            const pid = Number(it.productId);
            if (!Number.isFinite(pid) || pid <= 0) continue;

            // Decimal Prisma -> number robuste
            const qty = Number(it.quantity?.toString?.() ?? it.quantity ?? 0);
            const resaleTotal = Number(it.resaleLineTotal?.toString?.() ?? it.resaleLineTotal ?? 0);

            const cur = aggByProductId.get(pid) || { quantity: 0, resaleTotal: 0 };
            cur.quantity = roundQty(cur.quantity + qty);
            cur.resaleTotal = roundMoney(cur.resaleTotal + resaleTotal);
            aggByProductId.set(pid, cur);
        }
    }

    const { total, lines } = computeSalaryFromAgg({ aggByProductId, matrixMap });
    return {
        key: "pawnshopProductRemunerations",
        value: total,
        templateVariables: {
            lines,
            calculatedValue: total,
        },
    };
}

/**
 * Helper optionnel pour listes d’employés (si ton moteur lui passe déjà paymentValuesByEmployee).
 * - paymentValuesByEmployee: { [employeeId]: { pawnshopProductRemunerations: <matrix> } }
 */
async function getPawnshopSalariesForEmployeeList(args = {}) {
    const companyId = Number(args.companyId);
    const employeeIds = Array.isArray(args.employeeIds) ? args.employeeIds.map((x) => Number(x)).filter((x) => x > 0) : [];
    if (!Number.isFinite(companyId) || companyId <= 0) throw createError(400, "VALIDATION_ERROR", "companyId requis.");
    if (employeeIds.length === 0) return {};

    const out = {};
    for (const id of employeeIds) out[id] = 0;

    const paymentValuesByEmployee = args.paymentValuesByEmployee || null;
    if (!paymentValuesByEmployee) return out;

    for (const employeeId of employeeIds) {
        const pv = paymentValuesByEmployee[String(employeeId)] || paymentValuesByEmployee[employeeId] || null;
        const res = await calculatePawnshopProductRemuneration({
            companyId,
            employeeId,
            from: args.from ?? args.startDate ?? args.dateFrom ?? null,
            to: args.to ?? args.endDate ?? args.dateTo ?? null,
            paymentValues: pv || {},
        });
        out[employeeId] = Number(res?.total || 0);
    }

    return out;
}

/* ------------------------- CNI upload ------------------------- */

async function uploadClientCni({ companyId, clientId, fileBuffer, mimetype }) {
    const client = await prisma.client.findFirst({ where: { id: clientId, companyId } });
    if (!client) throw createError(404, "NOT_FOUND", "Client introuvable.");

    const path = require("path");
    const fs = require("fs");
    const crypto = require("crypto");
    const sharp = require("sharp");

    const UPLOADS_DIR = path.join(__dirname, "..", "..", "..", "uploads", "images");
    if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

    const newFilename = `${crypto.randomBytes(16).toString("hex")}.webp`;
    const filePath = path.join(UPLOADS_DIR, newFilename);

    await sharp(fileBuffer).resize(1200, 1200, { fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toFile(filePath);

    const image = await prisma.image.create({
        data: {
            filename: newFilename,
            mimetype: "image/webp",
            ownerType: "CLIENT_CNI",
            ownerId: clientId,
        },
    });

    await prisma.client.update({
        where: { id: clientId },
        data: { cniImagePublicId: image.publicId },
    });

    return { publicId: image.publicId, mimetype: image.mimetype };
}

async function deleteClientCni({ companyId, clientId }) {
    const client = await prisma.client.findFirst({ where: { id: clientId, companyId } });
    if (!client) throw createError(404, "NOT_FOUND", "Client introuvable.");
    if (!client.cniImagePublicId) throw createError(404, "NOT_FOUND", "Aucune CNI enregistrée pour ce client.");

    const image = await prisma.image.findUnique({ where: { publicId: client.cniImagePublicId } });
    if (image) {
        const path = require("path");
        const fs = require("fs");
        const UPLOADS_DIR = path.join(__dirname, "..", "..", "..", "uploads", "images");
        const filePath = path.join(UPLOADS_DIR, image.filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        await prisma.image.delete({ where: { id: image.id } });
    }

    await prisma.client.update({ where: { id: clientId }, data: { cniImagePublicId: null } });
    return { ok: true };
}

/* ------------------------- Estimation ------------------------- */

const ESTIMATION_STATUS = { OPEN: "OPEN", CONVERTED: "CONVERTED", REJECTED: "REJECTED" };

async function listEstimations({ companyId, actorEmployeeId, canViewAll, query }) {
    const status = query?.status || null;
    const page = Math.max(Number(query?.page || 1), 1);
    const pageSize = Math.min(Math.max(Number(query?.pageSize || 20), 1), 100);
    const skip = (page - 1) * pageSize;

    const where = {
        companyId,
        ...(!canViewAll ? { createdByEmployeeId: actorEmployeeId } : {}),
        ...(status ? { status } : {}),
    };

    const [total, items] = await prisma.$transaction([
        prisma.pawnshopEstimation.count({ where }),
        prisma.pawnshopEstimation.findMany({
            where,
            orderBy: { id: "desc" },
            skip,
            take: pageSize,
            include: {
                client: { select: { id: true, name: true, iban: true, phoneNumber: true, cniImagePublicId: true } },
                createdByEmployee: { include: { user: { select: { id: true, name: true } } } },
                items: { include: { product: { select: { id: true, name: true } } } },
            },
        }),
    ]);

    return { items, total, page, pageSize };
}

async function createEstimation({ companyId, actorEmployeeId, clientId, notes }) {
    if (clientId) {
        const client = await prisma.client.findFirst({ where: { id: clientId, companyId } });
        if (!client) throw createError(400, "CLIENT_NOT_FOUND", "Client introuvable.");
    }

    return prisma.pawnshopEstimation.create({
        data: {
            companyId,
            createdByEmployeeId: actorEmployeeId,
            clientId: clientId || null,
            notes: notes || null,
            status: ESTIMATION_STATUS.OPEN,
        },
        include: {
            client: { select: { id: true, name: true, iban: true, phoneNumber: true, cniImagePublicId: true } },
            createdByEmployee: { include: { user: { select: { id: true, name: true } } } },
            items: { include: { product: { select: { id: true, name: true } } } },
        },
    });
}

async function getEstimation({ companyId, id }) {
    const est = await prisma.pawnshopEstimation.findFirst({
        where: { id, companyId },
        include: {
            client: { select: { id: true, name: true, iban: true, phoneNumber: true, cniImagePublicId: true } },
            createdByEmployee: { include: { user: { select: { id: true, name: true } } } },
            items: { include: { product: true } },
        },
    });
    if (!est) throw createError(404, "NOT_FOUND", "Estimation introuvable.");
    return est;
}

async function updateEstimation({ companyId, id, patch }) {
    const est = await prisma.pawnshopEstimation.findFirst({ where: { id, companyId } });
    if (!est) throw createError(404, "NOT_FOUND", "Estimation introuvable.");
    if (est.status !== ESTIMATION_STATUS.OPEN) throw createError(409, "ESTIMATION_CLOSED", "Estimation déjà convertie/rejetée.");

    const data = {};
    if (patch.clientId !== undefined) {
        if (patch.clientId) {
            const c = await prisma.client.findFirst({ where: { id: patch.clientId, companyId } });
            if (!c) throw createError(400, "CLIENT_NOT_FOUND", "Client introuvable.");
        }
        data.clientId = patch.clientId || null;
    }
    if (patch.notes !== undefined) data.notes = patch.notes || null;

    return prisma.pawnshopEstimation.update({
        where: { id },
        data,
        include: {
            client: { select: { id: true, name: true, iban: true, phoneNumber: true, cniImagePublicId: true } },
            createdByEmployee: { include: { user: { select: { id: true, name: true } } } },
            items: { include: { product: true } },
        },
    });
}

async function addEstimationItem({ companyId, estimationId, productId, quantity, estimatedBuyPrice }) {
    const est = await prisma.pawnshopEstimation.findFirst({ where: { id: estimationId, companyId } });
    if (!est) throw createError(404, "NOT_FOUND", "Estimation introuvable.");
    if (est.status !== ESTIMATION_STATUS.OPEN) throw createError(409, "ESTIMATION_CLOSED", "Estimation déjà convertie/rejetée.");

    const product = await prisma.pawnshopProduct.findUnique({ where: { id: productId } });
    if (!product || product.companyId !== companyId) throw createError(400, "PRODUCT_NOT_FOUND", "Produit introuvable.");

    const buy = estimatedBuyPrice != null ? Number(estimatedBuyPrice) : Number(product.buyPrice || 0);
    const qty = roundQty(Number(quantity));
    if (!Number.isFinite(qty) || qty <= 0) throw createError(400, "VALIDATION_ERROR", "Quantité invalide.");

    return prisma.pawnshopEstimationItem.create({
        data: { estimationId, productId, quantity: qty, estimatedBuyPrice: buy },
        include: { product: true },
    });
}

async function deleteEstimationItem({ companyId, estimationId, itemId }) {
    const est = await prisma.pawnshopEstimation.findFirst({ where: { id: estimationId, companyId } });
    if (!est) throw createError(404, "NOT_FOUND", "Estimation introuvable.");
    if (est.status !== ESTIMATION_STATUS.OPEN) throw createError(409, "ESTIMATION_CLOSED", "Estimation déjà convertie/rejetée.");

    const item = await prisma.pawnshopEstimationItem.findUnique({ where: { id: itemId } });
    if (!item || item.estimationId !== estimationId) throw createError(404, "NOT_FOUND", "Ligne introuvable.");

    await prisma.pawnshopEstimationItem.delete({ where: { id: itemId } });
    return { ok: true };
}

async function rejectEstimation({ companyId, id }) {
    const est = await prisma.pawnshopEstimation.findFirst({ where: { id, companyId } });
    if (!est) throw createError(404, "NOT_FOUND", "Estimation introuvable.");
    if (est.status !== ESTIMATION_STATUS.OPEN) throw createError(409, "ESTIMATION_CLOSED", "Estimation déjà convertie/rejetée.");

    return prisma.pawnshopEstimation.update({
        where: { id },
        data: { status: ESTIMATION_STATUS.REJECTED },
        include: {
            client: { select: { id: true, name: true, iban: true, phoneNumber: true, cniImagePublicId: true } },
            createdByEmployee: { include: { user: { select: { id: true, name: true } } } },
            items: { include: { product: true } },
        },
    });
}

async function convertEstimationToPurchase({ companyId, actorEmployeeId, id }) {
    return prisma.$transaction(async (tx) => {
        const est = await tx.pawnshopEstimation.findFirst({
            where: { id, companyId },
            include: { items: { include: { product: true } } },
        });
        if (!est) throw createError(404, "NOT_FOUND", "Estimation introuvable.");
        if (est.status !== ESTIMATION_STATUS.OPEN) throw createError(409, "ESTIMATION_CLOSED", "Estimation déjà convertie/rejetée.");
        if (!est.clientId) throw createError(409, "CLIENT_REQUIRED", "Un client doit être associé avant de convertir.");
        if (!est.items || est.items.length === 0) throw createError(409, "ESTIMATION_EMPTY", "Aucune ligne dans l'estimation.");

        const client = await tx.client.findFirst({ where: { id: est.clientId, companyId } });
        if (!client) throw createError(400, "CLIENT_NOT_FOUND", "Client introuvable.");

        const purchase = await tx.pawnshopPurchase.create({
            data: {
                companyId,
                clientId: est.clientId,
                createdByEmployeeId: actorEmployeeId,
                status: PURCHASE_STATUS.DRAFT,
                notes: est.notes || null,
            },
        });

        for (const it of est.items) {
            const buy = Number(it.estimatedBuyPrice || it.product?.buyPrice || 0);
            const resale = Number(it.product?.resalePrice || 0);
            const qty = roundQty(Number(it.quantity));
            await tx.pawnshopPurchaseItem.create({
                data: {
                    purchaseId: purchase.id,
                    productId: it.productId,
                    quantity: qty,
                    unitBuyPrice: buy,
                    unitResalePrice: resale,
                    lineTotal: roundMoney(qty * buy),
                    resaleLineTotal: roundMoney(qty * resale),
                },
            });
        }

        const updated = await tx.pawnshopEstimation.update({
            where: { id },
            data: { status: ESTIMATION_STATUS.CONVERTED, convertedPurchaseId: purchase.id },
            include: {
                client: { select: { id: true, name: true, iban: true, phoneNumber: true, cniImagePublicId: true } },
                createdByEmployee: { include: { user: { select: { id: true, name: true } } } },
                items: { include: { product: true } },
                convertedPurchase: true,
            },
        });

        return updated;
    });
}

/* ------------------------- Inventory link (in validatePurchase) ------------------------- */

async function linkPurchaseItemsToInventory(tx, { companyId, purchaseId, items }) {
    for (const it of items) {
        const prod = it.product || await tx.pawnshopProduct.findUnique({ where: { id: it.productId } });
        const name = prod?.name || `Produit #${it.productId}`;
        // If the product has a fixed inventory owner (shared FiveM item), use it; else unique per item
        const owner = prod?.inventoryOwner
            ? String(prod.inventoryOwner).trim()
            : `pawnshop-purchase-${purchaseId}-item-${it.id}`;

        const inv = await tx.inventory.upsert({
            where: { companyId_owner: { companyId, owner } },
            create: { companyId, owner, name },
            update: { name },
        });

        await tx.pawnshopPurchaseItem.update({
            where: { id: it.id },
            data: { inventoryId: inv.id },
        });
    }
}

module.exports = {
    PURCHASE_STATUS,

    // purchases
    listPurchases,
    createPurchase,
    getPurchase,
    updatePurchase,
    deletePurchase,
    addPurchaseItem,
    updatePurchaseItem,
    deletePurchaseItem,
    validatePurchase,
    cancelPurchase,
    markPurchasePaid,
    changeOwner,
    deleteCanceledPurchase,
    getPurchaseStatsByEmployee,

    // clients
    listClients,
    getClient,
    createClient,
    updateClient,
    uploadClientCni,
    deleteClientCni,

    // estimations
    listEstimations,
    createEstimation,
    getEstimation,
    updateEstimation,
    addEstimationItem,
    deleteEstimationItem,
    rejectEstimation,
    convertEstimationToPurchase,

    // products
    listProducts,
    listPurchaseCatalog,
    createProduct,
    updateProduct,
    deleteProduct,

    // partners
    listPartners,
    createPartner,
    updatePartner,
    deletePartner,

    // prices
    getPartnerPrices,
    putPartnerPrices,

    // salary integration (matrix)
    calculatePawnshopProductRemuneration,
    getPawnshopSalariesForEmployeeList,
};
