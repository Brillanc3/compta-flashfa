// /backend/src/modules/mecano/mecano.service.js

const prisma = require('../../db');

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function toNumber(v) {
    if (v === null || v === undefined) return 0;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
}

function round2(n) {
    return Math.round((toNumber(n) + Number.EPSILON) * 100) / 100;
}

function isPaidBillStatus(status) {
    return status === 'PAID_CASH' || status === 'PAID_CARD';
}

function includesCustomVehicleReason(reason) {
    if (!reason) return false;
    return String(reason).toLowerCase().includes('custom véhicule');
}

/**
 * Base par facture = min(montant/2, limit)
 * limit est capé à 10 000 maximum (règle métier), même si la config dépasse.
 */
function computeBasePerBill(amount, limit) {
    const half = toNumber(amount) / 2;
    return Math.min(half, toNumber(limit));
}

/**
 * La matrix peut être persistée sous différents formats selon le front.
 * On supporte:
 *  - Array: [{ id: 'customVehicle', limit, commission, fixed }]
 *  - Map object: { customVehicle: { limit, commission, fixed } }
 */
function getMatrixRow(remunerationConfig) {
    const rows = remunerationConfig?.customVehicleRemuneration;
    if (!rows) return null;

    if (Array.isArray(rows)) {
        return rows.find((r) => r?.id === 'customVehicle') || rows[0] || null;
    }

    if (typeof rows === 'object' && rows.customVehicle && typeof rows.customVehicle === 'object') {
        return { id: 'customVehicle', ...rows.customVehicle };
    }

    return null;
}

function extractDateRange(dateRange) {
    const from =
        dateRange?.from ??
        dateRange?.start ??
        dateRange?.startDate ??
        dateRange?.dateFrom ??
        dateRange?.periodStart ??
        null;

    const to =
        dateRange?.to ??
        dateRange?.end ??
        dateRange?.endDate ??
        dateRange?.dateTo ??
        dateRange?.periodEnd ??
        null;

    return { from, to };
}

function safeDate(d) {
    if (!d) return null;
    const dt = d instanceof Date ? d : new Date(d);
    return Number.isNaN(dt.getTime()) ? null : dt;
}

/* -------------------------------------------------------------------------- */
/* DB QUERY                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Fallback si aucun préfetch n’est disponible.
 * Récupère les factures PAYÉES de l’employé (authorId=userId) sur période,
 * dont la raison contient "Custom véhicule".
 */
async function fetchPaidCustomBills({ companyId, userId, from, to }) {
    if (!companyId || !userId) return [];

    const where = {
        companyId,
        authorId: userId,
        status: { in: ['PAID_CASH', 'PAID_CARD'] },
        reason: { contains: 'Custom véhicule' },
    };

    const fromDt = safeDate(from);
    const toDt = safeDate(to);

    if (fromDt || toDt) {
        where.date = {};
        if (fromDt) where.date.gte = fromDt;
        if (toDt) where.date.lte = toDt;
    }

    return prisma.bill.findMany({
        where,
        select: { id: true, authorId: true, amount: true, reason: true, status: true, date: true },
    });
}

/* -------------------------------------------------------------------------- */
/* MAIN CALCULATOR                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Signature attendue par le moteur:
 * calculateCustomVehicleSalary(employee, dateRange) -> { key, value, templateVariables }
 *
 * Calcul:
 * - détection des bills payées avec reason contenant "Custom véhicule"
 * - base par facture = min(amount/2, limit) avec limit <= 10 000
 * - commissionValue = somme(base) * commission%
 * - fixedValue = customCount * fixed
 * - total = commissionValue + fixedValue
 *
 * Préfetch supporté:
 * - si employee.__prefetchedCustomVehicleBills est un array, on l’utilise et on évite toute requête SQL.
 */
async function calculateCustomVehicleSalary(employee, dateRange) {
    // Guard: si pas de config, pas de calcul (évite toute query inutile si appelé par erreur)
    const remunerationConfig = employee?.rank?.remunerationConfig || {};
    if (!remunerationConfig || typeof remunerationConfig !== 'object') {
        return { key: 'customVehicleRemuneration', value: 0, templateVariables: {} };
    }
    if (remunerationConfig.customVehicleRemuneration === undefined) {
        return { key: 'customVehicleRemuneration', value: 0, templateVariables: {} };
    }

    const row = getMatrixRow(remunerationConfig) || {};

    // Paramètres de la matrix
    const limitConfigured = toNumber(row.limit ?? 10000);
    const customLimit = Math.min(limitConfigured, 10000); // cap métier
    const customCommission = toNumber(row.commission ?? 0);
    const customFixed = toNumber(row.fixed ?? 0);

    const companyId = employee?.companyId;
    const userId = employee?.userId;

    const { from, to } = extractDateRange(dateRange);

    // Bills: préfetch si présent, sinon SQL
    const bills = Array.isArray(employee?.__prefetchedCustomVehicleBills)
        ? employee.__prefetchedCustomVehicleBills
        : await fetchPaidCustomBills({ companyId, userId, from, to });

    // Robustesse: même si préfetch, on refiltre
    const eligible = (bills || []).filter(
        (b) => b && isPaidBillStatus(b.status) && includesCustomVehicleReason(b.reason),
    );

    const items = eligible.map((b) => {
        const amount = toNumber(b.amount);
        const base = computeBasePerBill(amount, customLimit);
        return {
            billId: b.id ?? null,
            amount: round2(amount),
            base: round2(base),
        };
    });

    const customCount = items.length;
    const customBaseTotal = round2(items.reduce((sum, it) => sum + toNumber(it.base), 0));

    const commissionValue = round2((customBaseTotal * customCommission) / 100);
    const fixedValue = round2(customCount * customFixed);
    const total = round2(commissionValue + fixedValue);

    const details = items.map((it, idx) => {
        const bill = eligible[idx];
        return {
            date: bill?.date,
            label: `Custom: Facture #${bill?.id || it.billId}`,
            value: round2(it.base * (customCommission / 100) + customFixed)
        };
    });

    return {
        key: 'customVehicleRemuneration',
        value: total,
        templateVariables: {
            customCount,
            customLimit,
            customBaseTotal,
            customCommission,
            customFixed,
            commissionValue,
            fixedValue,
            calculatedValue: total,
        },
        details
    };
}

module.exports = {
    calculateCustomVehicleSalary,
};
