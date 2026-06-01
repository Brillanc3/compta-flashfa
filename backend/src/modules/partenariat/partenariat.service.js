// /backend/src/modules/partenariat/partenariat.service.js

/**
 * Service du module Partenariat
 * ------------------------------
 * Contient toute la logique métier :
 *  - Partenaires (CRUD soft-delete)
 *  - Services par partenaire (CRUD soft-delete)
 *  - Services rendus (prestations)
 *  - Résumés (totaux et totaux par employé)
 *  - Calculateur de rémunération pour le moteur de paie
 *
 * ⚠️ companyId est passé en paramètre par les handlers
 */

const prisma = require('../../db');

/* ========================================================================== */
/* 🧩 HELPER                                                                  */
/* ========================================================================== */

function toUtcStartOfDay(dateStr) {
    // Supporte "YYYY-MM-DD" et ISO date-time
    // Si c'est "YYYY-MM-DD", on force une date à minuit UTC pour éviter les ambiguïtés.
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [y, m, d] = dateStr.split("-").map(Number);
        return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
    }
    const dt = new Date(dateStr);
    return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(), 0, 0, 0, 0));
}

function addUtcDays(date, days) {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/* ========================================================================== */
/* 🧩 PARTENAIRES                                                             */
/* ========================================================================== */

async function createPartner({ companyId, userId, data }) {
    return prisma.partner.create({
        data: {
            companyId,
            name: data.name,
            description: data.description || null,
            logoUrl: data.logoUrl || null,
            isActive: true,
            createdBy: userId || null
        }
    });
}

async function updatePartner({ companyId, partnerId, data }) {
    return prisma.partner.update({
        where: { id: partnerId, companyId },
        data: {
            name: data.name ?? undefined,
            description: data.description ?? undefined,
            logoUrl: data.logoUrl ?? undefined
        }
    });
}

async function deactivatePartner({ companyId, partnerId }) {
    return prisma.partner.update({
        where: { id: partnerId, companyId },
        data: { isActive: false }
    });
}

async function activatePartner({ companyId, partnerId }) {
    return prisma.partner.update({
        where: { id: partnerId, companyId },
        data: { isActive: true }
    });
}

async function listPartners({ companyId, includeInactive }) {
    return prisma.partner.findMany({
        where: {
            companyId,
            ...(includeInactive ? {} : { isActive: true })
        },
        orderBy: { name: 'asc' }
    });
}

async function getPartnerById({ companyId, partnerId }) {
    return prisma.partner.findFirst({
        where: { id: partnerId, companyId }
    });
}

/* ========================================================================== */
/* 🧩 SERVICES PAR PARTENAIRE                                                 */
/* ========================================================================== */

async function createPartnerServiceType({ companyId, partnerId, data }) {
    return prisma.partnerServiceType.create({
        data: {
            companyId,
            partnerId,
            name: data.name,
            partnerPrice: parseFloat(data.price || 0),
            isActive: data.isActive !== undefined ? data.isActive : true
        }
    });
}

async function updatePartnerServiceType({ companyId, partnerId, serviceTypeId, data }) {
    return prisma.partnerServiceType.update({
        where: { id: serviceTypeId, companyId, partnerId },
        data: {
            name: data.name ?? undefined,
            partnerPrice: data.price !== undefined ? parseFloat(data.price) : undefined,
            isActive: data.isActive ?? undefined
        }
    });
}

async function deactivatePartnerServiceType({ companyId, partnerId, serviceTypeId }) {
    return prisma.partnerServiceType.update({
        where: { id: serviceTypeId, companyId, partnerId },
        data: { isActive: false }
    });
}

async function activatePartnerServiceType({ companyId, partnerId, serviceTypeId }) {
    return prisma.partnerServiceType.update({
        where: { id: serviceTypeId, companyId, partnerId },
        data: { isActive: true }
    });
}

async function listPartnerServiceTypes({ companyId, partnerId, includeInactive }) {
    return prisma.partnerServiceType.findMany({
        where: {
            companyId,
            partnerId,
            ...(includeInactive ? {} : { isActive: true })
        },
        orderBy: { name: 'asc' }
    });
}

/**
 * Liste globale des services actifs de tous les partenaires d'une entreprise.
 * Utilisé comme source dans paymentSchemasLoader.
 */
async function listAllActiveServicesForCompany({ companyId }) {
    const services = await prisma.partnerServiceType.findMany({
        where: {
            companyId,
            isActive: true
        },
        include: {
            partner: {
                select: { id: true, name: true }
            }
        },
        orderBy: { name: 'asc' }
    });

    return services.map(s => ({
        id: s.id,
        name: `${s.partner.name} - ${s.name}`,
        partnerId: s.partnerId
    }));
}

/* ========================================================================== */
/* 🧩 SERVICES RENDUS                                                         */
/* ========================================================================== */

async function createServiceRendered({ companyId, userId, data }) {
    // Vérifier que le service existe et est actif
    const serviceType = await prisma.partnerServiceType.findFirst({
        where: {
            id: data.serviceTypeId,
            partnerId: data.partnerId,
            companyId,
            isActive: true
        }
    });

    if (!serviceType) {
        const err = new Error("Service partenaire introuvable ou inactif.");
        err.statusCode = 400;
        throw err;
    }

    const qty = parseInt(data.quantity || 1, 10);
    const unitPrice = parseFloat(serviceType.partnerPrice);
    const total = unitPrice * qty;

    return prisma.partnerServiceRendered.create({
        data: {
            companyId,
            partnerId: data.partnerId,
            serviceTypeId: data.serviceTypeId,
            userId: userId || null,
            quantity: qty,
            unitPrice,
            total,
            date: data.performedAt ? new Date(data.performedAt) : new Date()
        }
    });
}

async function updateServiceRendered({ companyId, serviceRenderedId, data }) {
    const existing = await prisma.partnerServiceRendered.findFirst({
        where: { id: serviceRenderedId, companyId }
    });

    if (!existing) {
        const err = new Error("Service rendu introuvable.");
        err.statusCode = 404;
        throw err;
    }

    const qty = data.quantity ? parseInt(data.quantity, 10) : existing.quantity;
    const total = qty * existing.unitPrice;

    return prisma.partnerServiceRendered.update({
        where: { id: serviceRenderedId },
        data: {
            quantity: qty,
            total,
            date: data.performedAt ? new Date(data.performedAt) : undefined
        }
    });
}


async function listServicesRendered({ companyId, partnerId, employeeId, from, to }) {
    const dateFilter = {};

    if (from) {
        dateFilter.gte = toUtcStartOfDay(from);
    }

    if (to) {
        // borne exclusive : < lendemain 00:00 UTC
        const toStart = toUtcStartOfDay(to);
        dateFilter.lt = addUtcDays(toStart, 1);
    }

    return prisma.partnerServiceRendered.findMany({
        where: {
            companyId,
            ...(partnerId ? { partnerId } : {}),
            ...(employeeId ? { userId: employeeId } : {}),
            ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
        },
        include: {
            partner: { select: { id: true, name: true } },
            serviceType: { select: { id: true, name: true } },
            user: { select: { id: true, name: true } },
        },
        orderBy: { date: "desc" },
    });
}

/* ========================================================================== */
/* 🧮 RÉCAPITULATIF HEBDOMADAIRE                                              */
/* ========================================================================== */

async function getSummaryByPartner({ companyId, partnerId, from, to, includeEmployees }) {
    const dateFilter = {};

    if (from) {
        dateFilter.gte = toUtcStartOfDay(from);
    }

    if (to) {
        // borne exclusive : < lendemain 00:00 UTC
        const toStart = toUtcStartOfDay(to);
        dateFilter.lt = addUtcDays(toStart, 1);
    }

    const where = {
        companyId,
        ...(partnerId ? { partnerId } : {}),
        ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
    };

    const rows = await prisma.partnerServiceRendered.findMany({
        where,
        include: {
            partner: { select: { id: true, name: true } },
            user: { select: { id: true, name: true } },
        },
    });

    // Group by partner
    const summary = {};
    for (const r of rows) {
        if (!summary[r.partnerId]) {
            summary[r.partnerId] = {
                partnerId: r.partnerId,
                partnerName: r.partner.name,
                totalAmount: 0,
                servicesCount: 0,
                employees: {},
            };
        }

        summary[r.partnerId].totalAmount += Number(r.total);
        summary[r.partnerId].servicesCount += Number(r.quantity);

        if (includeEmployees && r.user) {
            if (!summary[r.partnerId].employees[r.userId]) {
                summary[r.partnerId].employees[r.userId] = {
                    userId: r.userId,
                    employeeName: r.user.name,
                    totalAmount: 0,
                    servicesCount: 0,
                };
            }

            summary[r.partnerId].employees[r.userId].totalAmount += Number(r.total);
            summary[r.partnerId].employees[r.userId].servicesCount += Number(r.quantity);
        }
    }

    const result = Object.values(summary).map((p) => {
        if (includeEmployees) {
            p.employees = Object.values(p.employees);
        } else {
            delete p.employees;
        }
        return p;
    });

    return result;
}

/* ========================================================================== */
/* 🧮 CALCULATEUR DE RÉMUNÉRATION POUR PAYMENTSCHEMASLOADER                  */
/* ========================================================================== */

async function calculatePartnerServiceRemuneration(employee, dateRange) {
    const companyId = employee.companyId;
    const employeeId = employee.userId;

    const from = dateRange.from;
    const to   = dateRange.to;

    // Récupération de la config du rang
    const config = employee.rank?.remunerationConfig?.partnerServiceRemunerations || {};

    const rows = await prisma.partnerServiceRendered.findMany({
        where: {
            companyId,
            userId: employeeId,
            date: {
                gte: from,
                lte: to
            }
        },
        include: {
            partner: { select: { name: true } },
            serviceType: { select: { name: true } }
        }
    });

    let total = 0;
    const details = [];

    for (const row of rows) {
        const cfg = config[row.serviceTypeId];
        if (!cfg || cfg.visible === false) continue;

        const fixed = parseFloat(cfg.fixed || 0);
        const percent = parseFloat(cfg.percent || 0);

        const commission = fixed + (row.total * (percent / 100));
        total += commission;

        details.push({
            date: row.date,
            label: `${row.partner?.name || 'Inconnu'} - ${row.serviceType?.name || 'Inconnu'} (x${row.quantity})`,
            value: commission
        });
    }

    return {
        key: "partnerServiceRemunerations",
        value: total,
        templateVariables: {
            calculatedValue: total
        },
        details
    };
}

/**
 * Récupère les statistiques de prestations de service (PDS) pour une liste d'employés.
 * Utilisé pour afficher les colonnes personnalisées dans la liste des employés.
 */
async function getPdsStatsForEmployeeList(employees, dateRange, ctx = {}) {
    const statsMap = new Map();
    if (!Array.isArray(employees) || employees.length === 0) return statsMap;

    const userIds = employees.map(e => e.userId).filter(Boolean);
    if (userIds.length === 0) {
        employees.forEach(e => statsMap.set(e.id, { pdsTotalAmount: 0, pdsTotalCount: 0 }));
        return statsMap;
    }

    const companyId = Number.parseInt(ctx.companyId ?? employees[0].companyId, 10);

    const from = dateRange?.from instanceof Date ? dateRange.from : (dateRange?.from ? new Date(dateRange.from) : null);
    const to = dateRange?.to instanceof Date ? dateRange.to : (dateRange?.to ? new Date(dateRange.to) : null);

    const aggregates = await prisma.partnerServiceRendered.groupBy({
        by: ['userId'],
        _sum: { total: true, quantity: true },
        where: {
            userId: { in: userIds },
            companyId: companyId,
            date: { gte: from, lte: to }
        }
    });

    // Initialisation par défaut à 0 pour tous les employés
    employees.forEach(e => statsMap.set(e.id, { pdsTotalAmount: 0, pdsTotalCount: 0 }));

    for (const agg of aggregates) {
        const employee = employees.find(e => e.userId === agg.userId);
        if (employee) {
            statsMap.set(employee.id, {
                pdsTotalAmount: parseFloat(agg._sum.total) || 0,
                pdsTotalCount: parseInt(agg._sum.quantity) || 0
            });
        }
    }

    return statsMap;
}

/* ========================================================================== */
/* 📦 EXPORTS                                                                 */
/* ========================================================================== */

module.exports = {
    // Partenaires
    createPartner,
    updatePartner,
    deactivatePartner,
    activatePartner,
    listPartners,
    getPartnerById,

    // Services par partenaire
    createPartnerServiceType,
    updatePartnerServiceType,
    deactivatePartnerServiceType,
    activatePartnerServiceType,
    listPartnerServiceTypes,
    listAllActiveServicesForCompany,

    // Services rendus
    createServiceRendered,
    updateServiceRendered,
    listServicesRendered,

    // Résumé
    getSummaryByPartner,

    // Calcul rémunération
    calculatePartnerServiceRemuneration,

    // Stats pour liste employés
    getPdsStatsForEmployeeList
};
