// /backend/src/modules/boxs/boxs.service.js

const prisma = require('../../db');

function toNumber(v) {
    if (v === null || v === undefined) return 0;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
}

function round2(n) {
    return Math.round((toNumber(n) + Number.EPSILON) * 100) / 100;
}

function safeDate(value) {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

function isDateOnlyString(v) {
    return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function parseDateOnlyUtcMidnight(s) {
    // Interprète YYYY-MM-DD en UTC minuit
    return new Date(`${s}T00:00:00.000Z`);
}

function buildDateWhere(query) {
    // compat: accepte startDate/endDate ET from/to
    const startRaw = query.startDate ?? query.from;
    const endRaw = query.endDate ?? query.to;

    const startDate = isDateOnlyString(startRaw) ? parseDateOnlyUtcMidnight(startRaw) : safeDate(startRaw);
    const endDate = isDateOnlyString(endRaw) ? parseDateOnlyUtcMidnight(endRaw) : safeDate(endRaw);

    if (!startDate && !endDate) return undefined;

    const out = {};
    if (startDate) out.gte = startDate;

    // Si endDate est "date-only", on inclut toute la journée => occurredAt < (endDate + 1 jour)
    if (endDate && isDateOnlyString(endRaw)) {
        const next = new Date(endDate);
        next.setUTCDate(next.getUTCDate() + 1);
        out.lt = next;
    } else if (endDate) {
        out.lte = endDate;
    }

    return out;
}

function parsePagination(query) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(query.limit ?? '25', 10) || 25));
    return { page, limit };
}

async function getCartonSales(companyId, query) {
    if (!Number.isFinite(companyId)) throw new Error("companyId invalide.");

    const { page, limit } = parsePagination(query);
    const occurredAt = buildDateWhere(query);

    const employeeId = query.companyEmployeeId ? parseInt(query.companyEmployeeId, 10) : null;
    const redistributionNumber = typeof query.redistributionNumber === 'string' ? query.redistributionNumber.trim() : null;

    const where = {
        companyId,
        occurredAt: occurredAt ? occurredAt : undefined,
        companyEmployeeId: Number.isFinite(employeeId) ? employeeId : undefined,
        redistributionNumber: redistributionNumber ? { contains: redistributionNumber } : undefined,
    };

    const [totalCount, data] = await prisma.$transaction([
        prisma.cartonSale.count({ where }),
        prisma.cartonSale.findMany({
            where,
            orderBy: { occurredAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
            select: {
                id: true,
                occurredAt: true,
                amount: true,
                cartonCount: true,
                reason: true,
                redistributionNumber: true,
                transactionId: true,
                companyEmployeeId: true,
                companyEmployee: {
                    select: {
                        id: true,
                        user: { select: { id: true, name: true } },
                        rank: { select: { id: true, name: true } },
                    },
                },
            },
        }),
    ]);

    return {
        data,
        pagination: {
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
            currentPage: page,
            limit,
        },
    };
}

async function getCartonSalesSummary(companyId, query) {
    if (!Number.isFinite(companyId)) throw new Error("companyId invalide.");

    const occurredAt = buildDateWhere(query);
    const employeeId = query.companyEmployeeId ? parseInt(query.companyEmployeeId, 10) : null;

    const where = {
        companyId,
        occurredAt: occurredAt ? occurredAt : undefined,
        companyEmployeeId: Number.isFinite(employeeId) ? employeeId : undefined,
    };

    const agg = await prisma.cartonSale.aggregate({
        where,
        _sum: { cartonCount: true, amount: true },
        _count: { _all: true },
    });

    return {
        count: agg?._count?._all || 0,
        totalCartons: agg?._sum?.cartonCount || 0,
        totalAmount: round2(agg?._sum?.amount || 0),
    };
}

async function updateCartonSale(companyId, cartonSaleId, patch) {
    if (!Number.isFinite(companyId)) throw { status: 400, message: "companyId invalide." };
    if (!Number.isFinite(cartonSaleId)) throw { status: 400, message: "cartonSaleId invalide." };

    const sale = await prisma.cartonSale.findUnique({
        where: { id: cartonSaleId },
        select: { id: true, companyId: true },
    });

    if (!sale || sale.companyId !== companyId) {
        throw { status: 404, message: "Vente carton introuvable." };
    }

    const data = {};

    if (patch.cartonCount !== undefined) {
        const c = parseInt(patch.cartonCount, 10);
        if (!Number.isFinite(c) || c < 0) throw { status: 400, message: "cartonCount invalide." };
        data.cartonCount = c;
    }

    if (patch.reason !== undefined) {
        const s = typeof patch.reason === 'string' ? patch.reason.trim() : '';
        if (!s) throw { status: 400, message: "reason invalide." };
        data.reason = s.slice(0, 255);
    }

    if (patch.redistributionNumber !== undefined) {
        const s = typeof patch.redistributionNumber === 'string' ? patch.redistributionNumber.trim() : '';
        data.redistributionNumber = s ? s.slice(0, 80) : null;
    }

    // Important: on NE modifie PAS amount/transactionId/companyEmployeeId via cette route (sécurité)
    const updated = await prisma.cartonSale.update({
        where: { id: cartonSaleId },
        data,
        select: {
            id: true,
            occurredAt: true,
            amount: true,
            cartonCount: true,
            reason: true,
            redistributionNumber: true,
            transactionId: true,
            companyEmployeeId: true,
        },
    });

    return updated;
}

/**
 * Salary calculator (utilisé par le système de salaire global)
 * remunerationConfig.boxsSalaryPerCarton (currency) => salaire = cartons * taux
 */
async function calculateBoxsSalary(employee, dateRange) {
    const rate = toNumber(employee?.rank?.remunerationConfig?.boxsSalaryPerCarton);

    if (!rate || rate <= 0) {
        return {
            key: 'boxsSalaryPerCarton',
            value: 0,
            templateVariables: {
                cartonCount: 0,
                boxsSalaryPerCarton: 0,
                calculatedValue: 0,
            },
        };
    }

    const from = safeDate(dateRange?.from);
    const to = safeDate(dateRange?.to);

    const where = {
        companyId: employee.companyId,
        companyEmployeeId: employee.id,
        occurredAt: {
            gte: from || new Date(0),
            lte: to || new Date(),
        },
    };

    const agg = await prisma.cartonSale.aggregate({
        where,
        _sum: { cartonCount: true, amount: true },
    });

    const cartonCount = agg?._sum?.cartonCount || 0;
    const totalAmount = round2(agg?._sum?.amount || 0);
    const calculatedValue = round2(cartonCount * rate);

    return {
        key: 'boxsSalaryPerCarton',
        value: calculatedValue,
        templateVariables: {
            cartonCount,
            totalAmount,
            boxsSalaryPerCarton: rate,
            calculatedValue,
        },
    };
}

/**
 * Colonnes employee list - cartons vendus (Map employeeId -> cartonCount)
 */
async function getCartonCountsForEmployeeList(employees, dateRange) {
    const map = new Map();
    employees.forEach((e) => map.set(e.id, 0));

    if (!employees.length) return map;

    const from = safeDate(dateRange?.from);
    const to = safeDate(dateRange?.to);

    const employeeIds = employees.map((e) => e.id);
    const companyId = employees[0].companyId;

    const grouped = await prisma.cartonSale.groupBy({
        by: ['companyEmployeeId'],
        where: {
            companyId,
            companyEmployeeId: { in: employeeIds },
            occurredAt: {
                gte: from || new Date(0),
                lte: to || new Date(),
            },
        },
        _sum: { cartonCount: true },
    });

    for (const g of grouped) {
        map.set(g.companyEmployeeId, g._sum.cartonCount || 0);
    }

    return map;
}

/**
 * Colonnes employee list - total ventes cartons (Map employeeId -> totalAmount)
 */
async function getCartonSalesTotalsForEmployeeList(employees, dateRange) {
    const map = new Map();
    employees.forEach((e) => map.set(e.id, 0));

    if (!employees.length) return map;

    const from = safeDate(dateRange?.from);
    const to = safeDate(dateRange?.to);

    const employeeIds = employees.map((e) => e.id);
    const companyId = employees[0].companyId;

    const grouped = await prisma.cartonSale.groupBy({
        by: ['companyEmployeeId'],
        where: {
            companyId,
            companyEmployeeId: { in: employeeIds },
            occurredAt: {
                gte: from || new Date(0),
                lte: to || new Date(),
            },
        },
        _sum: { amount: true },
    });

    for (const g of grouped) {
        map.set(g.companyEmployeeId, round2(g._sum.amount || 0));
    }

    return map;
}

/**
 * Salary list page helper (Map employeeId -> [salaryComponent])
 * On évite N requêtes : on groupBy cartonCount, puis on multiplie par le taux du rang.
 */
async function getSalariesForEmployeeList(employees, dateRange) {
    const salaryMap = new Map();
    employees.forEach((e) => salaryMap.set(e.id, []));

    if (!employees.length) return salaryMap;

    const from = safeDate(dateRange?.from);
    const to = safeDate(dateRange?.to);

    const employeeIds = employees.map((e) => e.id);
    const companyId = employees[0].companyId;

    const grouped = await prisma.cartonSale.groupBy({
        by: ['companyEmployeeId'],
        where: {
            companyId,
            companyEmployeeId: { in: employeeIds },
            occurredAt: {
                gte: from || new Date(0),
                lte: to || new Date(),
            },
        },
        _sum: { cartonCount: true, amount: true },
    });

    const byEmployee = new Map(grouped.map(g => [
        g.companyEmployeeId,
        {
            cartonCount: g._sum.cartonCount || 0,
            totalAmount: round2(g._sum.amount || 0),
        }
    ]));

    for (const employee of employees) {
        const rate = toNumber(employee?.rank?.remunerationConfig?.boxsSalaryPerCarton);
        const stats = byEmployee.get(employee.id) || { cartonCount: 0, totalAmount: 0 };

        const calculatedValue = rate > 0 ? round2(stats.cartonCount * rate) : 0;

        salaryMap.get(employee.id).push({
            key: 'boxsSalaryPerCarton',
            value: calculatedValue,
            templateVariables: {
                cartonCount: stats.cartonCount,
                totalAmount: stats.totalAmount,
                boxsSalaryPerCarton: rate,
                calculatedValue,
            },
        });
    }

    return salaryMap;
}

module.exports = {
    getCartonSales,
    getCartonSalesSummary,
    updateCartonSale,
    calculateBoxsSalary,
    getCartonCountsForEmployeeList,
    getCartonSalesTotalsForEmployeeList,
    getSalariesForEmployeeList,
};
