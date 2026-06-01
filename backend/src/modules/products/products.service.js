// /backend/src/modules/products/products.service.js

const prisma = require('../../db');
const { Prisma } = require("@prisma/client");

/**
 * Utilitaires
 */
function parseRemunConfig(remunerationConfig) {
    if (!remunerationConfig) return {};
    try {
        return typeof remunerationConfig === 'string'
            ? JSON.parse(remunerationConfig)
            : remunerationConfig;
    } catch {
        return {};
    }
}

function computeAmountFromRule({ price, rule }) {
    const fixed = Number(rule?.fixed || 0);
    const percent = Number(rule?.percent || 0);
    const percentValue = price > 0 && percent > 0 ? (price * percent) / 100 : 0;
    const total = Math.round((fixed + percentValue) * 100) / 100;
    return { total, fixed, percent, percentValue: Math.round(percentValue * 100) / 100 };
}

/** =========================================================================
 * CRUD PRODUITS
 * ========================================================================= */

async function createProduct(companyId, data) {
    const cId = Number(companyId);
    if (!cId) throw { status: 400, message: "companyId invalide." };

    const name = String(data?.name ?? "").trim();
    if (!name) throw { status: 400, message: "Le nom du produit est obligatoire." };

    const payload = {
        companyId: cId,
        name,
        // Decimal: idéalement string -> Decimal (évite les erreurs de précision)
        price: new Prisma.Decimal(String(data?.price ?? 0)),
        isActive: data?.isActive !== false,
        description: data?.description ? String(data.description) : null,
    };

    try {
        return await prisma.product.create({ data: payload });
    } catch (err) {
        // Unique constraint violation
        if (err?.code === "P2002") {
            // sur ta contrainte @@unique([companyId, name])
            throw { status: 409, message: "Un produit avec ce nom existe déjà dans cette entreprise." };
        }
        throw err;
    }
}

async function listProducts(companyId, { activeOnly = true } = {}) {
    const where = { companyId };

    const isActiveOnly =
        typeof activeOnly === 'string'
            ? activeOnly === 'true'
            : Boolean(activeOnly);

    if (isActiveOnly) where.isActive = true;

    const products = await prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        select: {
            id: true,
            name: true,
            price: true,
            isActive: true,
            description: true,
        },
    });

    return products;
}
async function updateProduct(companyId, productId, data) {
    // Sécurité : contrôle d'appartenance
    const found = await prisma.product.findUnique({ where: { id: productId } });
    if (!found || found.companyId !== companyId) {
        throw new Error('Produit introuvable dans cette entreprise.');
    }

    const updated = await prisma.product.update({
        where: { id: productId },
        data: {
            name: data.name ?? found.name,
            price: data.price !== undefined ? Number(data.price) : found.price,
            isActive: data.isActive !== undefined ? !!data.isActive : found.isActive,
            description: data.description ?? found.description,
            metadata: data.metadata ? JSON.stringify(data.metadata) : found.metadata,
        },
    });
    return updated;
}

async function deactivateProduct(companyId, productId) {
    const found = await prisma.product.findUnique({ where: { id: productId } });
    if (!found || found.companyId !== companyId) {
        throw new Error('Produit introuvable dans cette entreprise.');
    }
    await prisma.product.update({
        where: { id: productId },
        data: { isActive: false, deactivatedAt: new Date() },
    });
    return true;
}

/** =========================================================================
 * DÉCLARATIONS
 * ========================================================================= */

/**
 * Crée une déclaration de “vente / production” d’un produit par un employé
 * et calcule immédiatement la rémunération due selon le rang.
 *
 * ⬅️ FIX: utilise le paramètre "quantity" (pas "qty") et applique bien la quantité
 */
async function createDeclaration({ companyId, productId, employeeId, quantity }) {
    const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, price: true, isActive: true, companyId: true },
    });

    if (!product || product.companyId !== companyId)
        throw new Error('Produit introuvable.');
    if (!product.isActive)
        throw new Error('Produit inactif.');

    const employee = await prisma.companyEmployee.findUnique({
        where: { id: employeeId },
        include: { rank: true },
    });
    if (!employee || employee.companyId !== companyId)
        throw new Error('Employé introuvable.');

    // ✔️ quantité validée
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
        throw new Error('Quantité invalide.');
    }

    // Règles de rémunération du rang
    const cfg = parseRemunConfig(employee.rank?.remunerationConfig);
    const rules = cfg?.productRemunerations || {};

    // Supporte clés string ou numériques, ou tableau d'entrées
    let rule = null;
    if (Array.isArray(rules)) {
        rule = rules.find(r => Number(r?.id) === product.id) || null;
    } else {
        rule = rules[String(product.id)] || rules[product.id] || null;
    }
    if (!rule || rule.visible === false)
        throw new Error('Ce produit n’est pas accessible pour votre rang.');

    const unitPrice = Number(product.price || 0);
    const fixed = Number(rule.fixed || 0);
    const percent = Number(rule.percent || 0);
    const percentValuePerUnit = (unitPrice * percent) / 100;
    const remunerationPerUnit = fixed + percentValuePerUnit;

    // 👉 IMPORTANT : on applique bien la QUANTITÉ (arrondi 2 décimales)
    const total = Math.round((remunerationPerUnit * qty) * 100) / 100;

    const declaration = await prisma.productDeclaration.create({
        data: {
            companyId,
            productId,
            employeeId,
            quantity: new Prisma.Decimal(qty),                 // 🔒 quantité stockée telle quelle
            amount: new Prisma.Decimal(total),                 // total rémunéré
            fixedPart: new Prisma.Decimal(fixed),              // par unité (trace)
            percentPart: new Prisma.Decimal(percent),          // %
            percentValue: new Prisma.Decimal(percentValuePerUnit * qty), // valeur % totale pour cette déclaration
            priceAtSale: new Prisma.Decimal(unitPrice),
            productNameSnapshot: product.name,
        },
    });

    // Pour cohérence avec ton controller
    return { declaration, amount: total, percent };
}

/**
 * Liste paginée des déclarations produits.
 * Si employeeId est fourni → filtre sur l’employé ; sinon toutes (mode admin).
 */
async function listDeclarations({
                                    companyId,
                                    employeeId = null,
                                    page = 1,
                                    pageSize = 15,
                                    startDate = null,
                                    endDate = null,

                                    // NEW filters
                                    productId = null,
                                    productStatus = 'ALL', // ALL | ACTIVE | INACTIVE
                                    quantityMin = null,
                                    quantityMax = null,
                                }) {
    const where = { companyId };

    if (employeeId) where.employeeId = employeeId;

    if (startDate || endDate) {
        where.declaredAt = {};
        if (startDate) where.declaredAt.gte = new Date(startDate);
        if (endDate) where.declaredAt.lte = new Date(endDate);
    }

    if (productId) where.productId = productId;

    if (quantityMin !== null || quantityMax !== null) {
        where.quantity = {};
        if (quantityMin !== null) where.quantity.gte = quantityMin;
        if (quantityMax !== null) where.quantity.lte = quantityMax;
    }

    // Statut produit via relation
    if (productStatus === 'ACTIVE') where.product = { isActive: true };
    if (productStatus === 'INACTIVE') where.product = { isActive: false };

    const skip = (Math.max(1, page) - 1) * Math.max(1, pageSize);
    const take = Math.max(1, Math.min(100, pageSize));

    const [totalCount, items] = await Promise.all([
        prisma.productDeclaration.count({ where }),
        prisma.productDeclaration.findMany({
            where,
            orderBy: { declaredAt: 'desc' },
            skip,
            take,
            include: {
                product: { select: { id: true, name: true, isActive: true } },
                employee: {
                    select: {
                        id: true,
                        user: { select: { id: true, name: true } },
                    },
                },
            },
        }),
    ]);

    return {
        items,
        pagination: {
            totalCount,
            page: Math.max(1, page),
            pageSize: take,
            totalPages: Math.ceil(totalCount / take),
        },
    };
}

async function listDeclarationEmployees(companyId) {
    const employees = await prisma.companyEmployee.findMany({
        where: { companyId },
        orderBy: { id: 'asc' },
        select: {
            id: true,
            status: true,
            user: { select: { id: true, name: true } },
        },
    });

    return employees.map(e => ({
        id: e.id,
        status: e.status,
        userId: e.user?.id || null,
        name: e.user?.name || 'Utilisateur',
    }));
}

/** =========================================================================
 * WIDGETS
 * ========================================================================= */

/**
 * Données pour le widget "Déclarer un produit" :
 * - Liste des produits visibles pour le rang de l’utilisateur
 * - Avec (optionnel) les taux/paramètres de rémunération pré-remplis
 */
async function getWidgetData_DeclareProductWidget(userId, companyId, config = {}) {

    if (!userId || !companyId) {
        console.warn('⚠️ getWidgetData_DeclareProductWidget appelé sans userId ou companyId', { userId, companyId });
        return { products: [] };
    }

    // Récupérer l’employé + rang
    const employee = await prisma.companyEmployee.findFirst({
        where: { userId, companyId },
        include: { rank: true },
    });
    if (!employee) return { products: [] };

    const cfg = parseRemunConfig(employee.rank?.remunerationConfig);
    const rules = cfg?.productRemunerations || {};

    // Charger tous les produits actifs (tri alpha)
    const all = await prisma.product.findMany({
        where: { companyId, isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, price: true },
    });

    // Filtrer par visibilité du rang
    const visible = all
        .filter(p => {
            const r = rules[String(p.id)] || rules[p.id];
            return r && (r.visible !== false);
        })
        .map(p => {
            const r = rules[String(p.id)] || rules[p.id] || {};
            return {
                id: p.id,
                name: p.name,
                price: Number(p.price || 0),
                preset: {
                    fixed: Number(r.fixed || 0),
                    percent: Number(r.percent || 0),
                },
            };
        });

    return { products: visible };
}

/** =========================================================================
 * SALARY CALCULATOR (utilisé par employees.service → salary breakdown)
 * ========================================================================= */

async function calculateProductRemuneration(employee, dateRange) {
    if (!employee?.id) return { key: 'productRemunerations', value: 0, templateVariables: {} };

    const from = new Date(dateRange.from);
    const to = new Date(dateRange.to);

    // Additionne les montants déjà calculés à la déclaration
    const declarations = await prisma.productDeclaration.findMany({
        where: {
            employeeId: employee.id,
            declaredAt: { gte: from, lte: to },
        },
        select: {
            amount: true,
            fixedPart: true,
            percentPart: true,
            percentValue: true,
            productNameSnapshot: true,
            quantity: true,
            declaredAt: true
        },
    });

    const value = Math.round(
        declarations.reduce((acc, d) => acc + Number(d.amount || 0), 0) * 100
    ) / 100;

    const details = declarations.map(d => ({
        date: d.declaredAt,
        label: `${d.productNameSnapshot} (x${Number(d.quantity)})`,
        value: Number(d.amount)
    }));

    // (optionnel) agréger des détails pour la vue breakdown
    const fixedSum = Math.round(
        declarations.reduce((acc, d) => acc + Number(d.fixedPart || 0), 0) * 100
    ) / 100;
    const percentValueSum = Math.round(
        declarations.reduce((acc, d) => acc + Number(d.percentValue || 0), 0) * 100
    ) / 100;

    return {
        key: 'productRemunerations',
        value,
        templateVariables: {
            fixed: fixedSum,
            percentValue: percentValueSum,
            calculatedValue: value,
        },
        details
    };
}

async function updateDeclarationQuantity({ companyId, declarationId, quantity }) {
    const decl = await prisma.productDeclaration.findUnique({
        where: { id: declarationId },
        select: {
            id: true,
            companyId: true,
            quantity: true,
            priceAtSale: true,
            fixedPart: true,
            percentPart: true,
        },
    });

    if (!decl || decl.companyId !== companyId) {
        throw { status: 404, message: "Déclaration introuvable dans cette entreprise." };
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty < 0) {
        throw { status: 400, message: "Quantité invalide." };
    }

    const unitPrice = Number(decl.priceAtSale || 0);
    const fixedPerUnit = Number(decl.fixedPart || 0);
    const percent = Number(decl.percentPart || 0);

    // valeur % totale + total rémunération
    const percentValueTotal = Math.round(((unitPrice * percent) / 100) * qty * 100) / 100;
    const amountTotal = Math.round((fixedPerUnit * qty + percentValueTotal) * 100) / 100;

    return prisma.productDeclaration.update({
        where: { id: declarationId },
        data: {
            quantity: new Prisma.Decimal(String(qty)),
            percentValue: new Prisma.Decimal(String(percentValueTotal)),
            amount: new Prisma.Decimal(String(amountTotal)),
        },
        include: {
            product: { select: { id: true, name: true, isActive: true } },
            employee: { select: { id: true, user: { select: { id: true, name: true } } } },
        },
    });
}

async function getDeclarationsWeeklySummary({ companyId, employeeId = null, startAt, endAt }) {
    const where = {
        companyId,
        declaredAt: { gte: startAt, lte: endAt },
    };
    if (employeeId) where.employeeId = employeeId;

    // Agrégation DB
    const grouped = await prisma.productDeclaration.groupBy({
        by: ['employeeId', 'productId'],
        where,
        _sum: { quantity: true },
    });

    const employeeIds = [...new Set(grouped.map(g => g.employeeId))];
    const productIds = [...new Set(grouped.map(g => g.productId))];

    // Enrichissement en bulk
    const [employees, products] = await Promise.all([
        prisma.companyEmployee.findMany({
            where: { id: { in: employeeIds }, companyId },
            select: { id: true, user: { select: { name: true, username: true } } },
        }),
        prisma.product.findMany({
            where: { id: { in: productIds }, companyId },
            select: { id: true, name: true, isActive: true },
        }),
    ]);

    const empMap = new Map(employees.map(e => [
        e.id,
        e.user?.name || e.user?.username || `Employé #${e.id}`,
    ]));

    const prodMap = new Map(products.map(p => [
        p.id,
        { name: p.name || `Produit #${p.id}`, isActive: !!p.isActive },
    ]));

    return grouped.map(g => {
        const p = prodMap.get(g.productId);
        return {
            employeeId: g.employeeId,
            employeeName: empMap.get(g.employeeId) || `Employé #${g.employeeId}`,
            productId: g.productId,
            productName: p?.name || `Produit #${g.productId}`,
            productIsActive: p?.isActive ?? true,
            totalQuantity: g._sum?.quantity ?? new Prisma.Decimal(0),
        };
    });
}

module.exports = {
    // Produits
    createProduct,
    listProducts,
    updateProduct,
    deactivateProduct,
    updateDeclarationQuantity,

    // Déclarations
    createDeclaration,
    listDeclarations,
    listDeclarationEmployees,
    getDeclarationsWeeklySummary,

    // Widgets
    getWidgetData_DeclareProductWidget,

    // Salary calculator
    calculateProductRemuneration,
};
