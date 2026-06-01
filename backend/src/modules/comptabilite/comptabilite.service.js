// /backend/src/modules/comptabilite/comptabilite.service.js
const prisma = require('../../db');
const { Decimal } = require('@prisma/client/runtime/library');
const { startOfISOWeek, endOfISOWeek, parseISO, setISOWeek, startOfWeek, endOfWeek, setYear, getYear, getISOWeek, differenceInMinutes } = require('date-fns');
const crypto = require('crypto');
const fs = require("fs");
const path = require("path");
const {getSalaryBreakdown} = require("../employees/employees.service");

const CATEGORY_LABELS = {
    CHIFFRE_AFFAIRES: "Chiffre d'affaires",
    AUTRES_ENTREES: "Autres entrées",
    DONS_RECUS: "Dons reçus",
    DECORATION: "Décoration",
    SUBVENTIONS_RECUES: "Subventions reçues",
    SALAIRES: "Salaires (Transactions Manuelles)",
    MATIERES_PREMIERES: "Matières premières",
    AVOCATS: "Frais d'Avocats",
    FRAIS_COMPTABLE: "Frais Comptables",
    LOCATIONS: "Locations",
    FRAIS_VEHICULES: "Frais véhicules",
    NOURRITURE: "Nourriture",
    DONS_EFFECTUES: "Dons effectués",
    LOCATIONS_NON_DEDUC: "Locations non déductibles",
    CHARGES_VEHICULES_NON_DEDUC: "Charges véhicules non déductibles",
    AUTRES_NON_DEDUC: "Autres non déductibles",
    PAIEMENT_IRS: "Paiement IRS"
};

function _calculateProgressiveTax(profit) {
    if (profit <= 10000) {
        return 0; // 0% du bénéfice total
    } else if (profit <= 50000) {
        return profit * 0.10; // 10% du bénéfice total
    } else if (profit <= 100000) {
        return profit * 0.19; // 19% du bénéfice total
    } else if (profit <= 250000) {
        return profit * 0.28; // 28% du bénéfice total
    } else if (profit <= 500000) {
        return profit * 0.36; // 36% du bénéfice total
    } else { // Si le profit est supérieur à 500 000
        return profit * 0.46; // 46% du bénéfice total
    }
}

function _calculateDonationTax(totalDonations) {
    if (totalDonations <= 0) return { taxAmount: 0, taxRate: 0 };
    const taxRate = totalDonations > 50000 ? 0.30 : 0.10;
    return { taxAmount: totalDonations * taxRate, taxRate: taxRate * 100 };
}

const buildTransactionWhereClause = (companyId, weekParams, filters) => {
    let dateFilter = {};
    if (filters.startDate && filters.endDate) {
        dateFilter = { gte: parseISO(filters.startDate), lte: parseISO(filters.endDate) };
    } else {
        const dateInWeek = setISOWeek(new Date(weekParams.year, 0, 1), weekParams.week);
        dateFilter = { gte: startOfISOWeek(dateInWeek), lte: endOfISOWeek(dateInWeek) };
    }
    return {
        companyId: companyId,
        date: dateFilter,
        description: filters.description ? { contains: filters.description } : undefined,
        amount: {
            gte: filters.minAmount ? parseFloat(filters.minAmount) : undefined,
            lte: filters.maxAmount ? parseFloat(filters.maxAmount) : undefined,
        },
        category: {
            type: filters.type || undefined,
            name: filters.category?.length ? { in: filters.category } : undefined,
        }
    };
};
async function getJournalTransactions(companyId, weekParams, filters, page, pageSize) {
    const where = buildTransactionWhereClause(companyId, weekParams, filters);
    const [transactions, totalCount] = await prisma.$transaction([
        prisma.transaction.findMany({
            where,
            include: { category: true },
            orderBy: { date: 'desc' },
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.transaction.count({ where }),
    ]);
    return { transactions, totalCount };
}
async function getJournalSummary(companyId, weekParams, filters) {
    const where = buildTransactionWhereClause(companyId, weekParams, filters);
    return prisma.transaction.findMany({
        where,
        include: { category: true },
        orderBy: { date: 'desc' },
    });
}
async function updateTransactionCategory(transactionId, categoryId, companyId) {
    const [transaction, newCategory] = await Promise.all([
        prisma.transaction.findUnique({ where: { id: transactionId }, include: { category: true } }),
        prisma.transactionCategory.findUnique({ where: { id: categoryId } })
    ]);
    if (!transaction || !newCategory) throw new Error("Transaction ou catégorie introuvable.");
    if (transaction.companyId !== companyId) throw new Error("Accès non autorisé à cette transaction.");
    if (transaction.category && transaction.category.type !== newCategory.type) {
        throw new Error(`Assignation incohérente: une transaction de type '${transaction.category.type}' ne peut pas avoir une catégorie de type '${newCategory.type}'.`);
    }
    return prisma.transaction.update({
        where: { id: transactionId },
        data: { categoryId: categoryId },
        include: { category: true },
    });
}
async function getTransactionCategories() {
    return prisma.transactionCategory.findMany();
}
// --- Fin des services de transaction ---

/**
 * Récupère les factures d’une entreprise avec filtres, tri et pagination.
 * Compatible avec la page BillJournalPage.jsx
 */
async function getBills(companyId, userId, query, billViewMode) {
    const {
        page = 1,
        limit = 15,
        sortBy = "date",
        sortOrder = "desc",
        search = "",
        status,
        minAmount,
        maxAmount,
        startDate,
        endDate,
        billId,
        // ⚠️ ne te fie pas uniquement à employeeIds ici
    } = query;

    function parseIdListFromQuery(q, key) {
        const raw = q?.[key] ?? q?.[`${key}[]`];
        if (raw == null) return [];
        const arr = Array.isArray(raw) ? raw : [raw];
        return arr
            .flatMap((v) => String(v).split(","))
            .map((s) => Math.abs(parseInt(String(s).trim(), 10)))
            .filter((n) => Number.isFinite(n) && n > 0);
    }

    const companyIdNum = Number(companyId);
    const userIdNum = Number(userId);

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 15;

    const allowedSortFields = new Set(["date", "amount", "status", "externalBillId", "createdAt", "id"]);
    const safeSortBy = allowedSortFields.has(sortBy) ? sortBy : "date";
    const safeSortOrder = sortOrder === "asc" ? "asc" : "desc";

    const where = {
        companyId: companyIdNum,
        AND: [],
    };

    // 🔒 Visibilité SELF/ALL
    let viewerCompanyEmployeeId = null;

    if (billViewMode !== "ALL") {
        const ce = await prisma.companyEmployee.findFirst({
            where: { companyId: companyIdNum, userId: userIdNum },
            select: { id: true },
        });
        viewerCompanyEmployeeId = ce?.id ?? null;

        const selfOr = [{ authorId: userIdNum, shares: { none: {} } }];

        if (viewerCompanyEmployeeId) {
            selfOr.push({ shares: { some: { companyEmployeeId: viewerCompanyEmployeeId } } });
        } else {
            selfOr[0] = { authorId: userIdNum };
        }

        where.AND.push({ OR: selfOr });
    }

    // --- FILTRES ---
    if (status) where.AND.push({ status });

    if (minAmount || maxAmount) {
        where.AND.push({
            amount: {
                gte: minAmount ? parseFloat(minAmount) : undefined,
                lte: maxAmount ? parseFloat(maxAmount) : undefined,
            },
        });
    }

    if (startDate || endDate) {
        where.AND.push({
            date: {
                gte: startDate ? new Date(startDate) : undefined,
                lte: endDate ? new Date(endDate) : undefined,
            },
        });
    }

    // Recherche par ID facture (id interne OU externalBillId)
    if (billId !== undefined && billId !== null && String(billId).trim() !== "") {
        const n = Number(String(billId).replace(/[^\d]/g, ""));
        if (Number.isFinite(n) && n > 0) {
            where.AND.push({ OR: [{ id: n }, { externalBillId: n }] });
        }
    }

    const parsedEmployeeIds = parseIdListFromQuery(query, "employeeIds");

    if (parsedEmployeeIds.length > 0) {
        where.AND.push({
            OR: [
                { authorCompanyEmployeeId: { in: parsedEmployeeIds } },
                { shares: { some: { companyEmployeeId: { in: parsedEmployeeIds } } } },
            ],
        });
    }

    // Recherche globale
    if (search && search.trim() !== "") {
        const terms = search.split(" ").map((s) => s.trim()).filter(Boolean);
        where.AND.push({
            AND: terms.map((tag) => ({
                OR: [
                    { reason: { contains: tag } },
                    { issuerName: { contains: tag } },
                    { recipientName: { contains: tag } },
                ],
            })),
        });
    }

    if (where.AND.length === 0) delete where.AND;

    const include = {
        author: { select: { name: true } },
        canceledBy: { select: { name: true } },
        _count: { select: { shares: true, comments: true } },
        shares:
            billViewMode === "ALL"
                ? { select: { companyEmployeeId: true, percentage: true } }
                : viewerCompanyEmployeeId
                    ? { where: { companyEmployeeId: viewerCompanyEmployeeId }, select: { percentage: true } }
                    : false,
    };

    const [totalBills, bills] = await prisma.$transaction([
        prisma.bill.count({ where }),
        prisma.bill.findMany({
            where,
            skip: (pageNum - 1) * limitNum,
            take: limitNum,
            orderBy: { [safeSortBy]: safeSortOrder },
            include,
        }),
    ]);

    const data = (bills || []).map((b) => {
        const isShared = (b._count?.shares ?? 0) > 0;

        let viewerSharePercentage = null;
        if (billViewMode !== "ALL" && isShared) {
            const pct = b.shares?.[0]?.percentage;
            const num = pct !== undefined && pct !== null ? Number(pct) : NaN;
            viewerSharePercentage = Number.isFinite(num) ? num : null;
        }

        const { _count, ...rest } = b;
        return { ...rest, isShared, viewerSharePercentage, _count: { comments: _count?.comments ?? 0 } };
    });

    return {
        data,
        billViewMode,
        pagination: {
            totalCount: totalBills,
            totalPages: Math.ceil(totalBills / limitNum),
            currentPage: pageNum,
            limit: limitNum,
        },
    };
}



async function getBillDetails(billId, companyId) {
    const bill = await prisma.bill.findFirst({
        where: { id: billId, companyId: companyId },
        include: {
            author: { select: { name: true } },
            client: { select: { name: true } },
            canceledBy: { select: { name: true } },
            hostedSite: {
                select: {
                    id: true,
                    slug: true,
                    name: true,
                    isPublished: true,
                },
            },

            shares: {
                orderBy: { id: "asc" },
                select: {
                    id: true,
                    companyEmployeeId: true,
                    percentage: true,
                    companyEmployee: {
                        select: {
                            id: true,
                            user: { select: { name: true } },
                            rankId: true,
                            status: true,
                        },
                    },
                },
            },
        },
    });

    if (!bill) throw new Error("Facture non trouvée ou accès non autorisé.");
    return bill;
}


async function calculateFixedSalary(employee, dateRange) {
    const salaryFixed = employee.rank?.remunerationConfig?.salaryFixed;

    if (!salaryFixed || salaryFixed <= 0) {
        return {
            key: 'salaryFixed',
            value: 0,
            templateVariables: {
                salaryFixed: 0
            }
        };
    }

    return {
        key: 'salaryFixed',
        value: Number(salaryFixed),
        templateVariables: {
            salaryFixed: Number(salaryFixed)
        }
    };
}

async function calculateCommissionSalary(employee, dateRange) {
    const commissionRate = employee.rank?.remunerationConfig?.commissionRate;
    if (commissionRate === null || commissionRate === undefined || commissionRate === 0) {
        return {
            key: 'commissionRate',
            value: 0,
            templateVariables: { totalBilled: 0 }
        };
    }

    const baseWhere = {
        companyId: employee.companyId,
        date: { gte: new Date(dateRange.from), lte: new Date(dateRange.to) },
        status: { in: ['PAID_CASH', 'PAID_CARD'] }
    };

    if (employee.__hasMecano) {
        baseWhere.NOT = {
            reason: {
                contains: 'Custom véhicule',
            }
        };
    }

    /**
     * Règles:
     * - Si pas de shares => l'auteur touche 100%
     * - Si shares => on prend UNIQUEMENT le % du share de l'employé
     */
    const bills = await prisma.bill.findMany({
        where: {
            ...baseWhere,
            OR: [
                // Factures partagées où cet employé a un share
                { shares: { some: { companyEmployeeId: employee.id } } },

                // Factures non partagées (aucun share) => seulement l'auteur
                { authorId: employee.userId, shares: { none: {} } },
            ],
        },
        select: {
            id: true,
            externalBillId: true,
            amount: true,
            reason: true,
            date: true,
            authorId: true,
            shares: {
                where: { companyEmployeeId: employee.id },
                select: { percentage: true },
            },
        },
    });

    let totalBilled = 0;
    const details = [];

    for (const bill of bills) {
        const amount = parseFloat(bill.amount) || 0;
        let billContribution = 0;

        // Cas "pas de shares" (on les a filtrées via shares:none)
        if (bill.authorId === employee.userId && (!bill.shares || bill.shares.length === 0)) {
            billContribution = amount; // 100%
        } else {
            // Cas "shares" => on prend le % de CE companyEmployee
            const rawPct = bill.shares?.[0]?.percentage;
            const pct = Number.isFinite(Number(rawPct)) ? parseFloat(rawPct) : 0;
            if (pct > 0) {
                billContribution = amount * (pct / 100);
            }
        }

        if (billContribution > 0) {
            totalBilled += billContribution;
            details.push({
                date: bill.date,
                label: `Facture #${bill.externalBillId || bill.id} - ${bill.reason || 'Sans raison'}`,
                value: billContribution * (commissionRate / 100)
            });
        }
    }

    const commissionValue = totalBilled * (commissionRate / 100);

    return {
        key: 'commissionRate',
        value: commissionValue,
        templateVariables: { totalBilled },
        details
    };
}


async function getSalariesForEmployeeList(employees, dateRange, ctx = {}) {
    const salaryMap = new Map();
    if (!Array.isArray(employees) || employees.length === 0) return salaryMap;

    const companyId = Number.parseInt(ctx.companyId ?? employees?.[0]?.companyId, 10);
    if (!Number.isInteger(companyId) || companyId <= 0) {
        throw new Error('companyId manquant ou invalide pour le calcul des salaires.');
    }

    // Dépendance circulaire gérée ici (comme /mySalary)
    const { getSalaryBreakdown } = require('../employees/employees.service');

    const salaryResults = await Promise.all(
        employees.map((employee) => getSalaryBreakdown(companyId, employee.id, dateRange))
    );

    salaryResults.forEach((salaryData, index) => {
        const employeeId = employees[index].id;
        salaryMap.set(employeeId, salaryData);
    });

    return salaryMap;
}

async function getCaForEmployeeList(employees, dateRange, ctx = {}) {
    const caMap = new Map();
    if (!Array.isArray(employees) || employees.length === 0) return caMap;

    const companyId = Number.parseInt(ctx.companyId ?? employees?.[0]?.companyId, 10);
    if (!Number.isInteger(companyId) || companyId <= 0) {
        throw new Error('companyId manquant ou invalide pour le calcul du CA.');
    }

    const from = dateRange?.from instanceof Date ? dateRange.from : (dateRange?.from ? new Date(dateRange.from) : null);
    const to = dateRange?.to instanceof Date ? dateRange.to : (dateRange?.to ? new Date(dateRange.to) : null);

    const hasValidRange =
        from instanceof Date && !Number.isNaN(from.getTime()) &&
        to instanceof Date && !Number.isNaN(to.getTime());

    if (!hasValidRange) {
        throw new Error('Plage de dates invalide (from/to) pour le calcul du CA.');
    }

    // Init à 0 pour tous
    for (const e of employees) caMap.set(e.id, 0);

    const employeeIds = employees.map((e) => e.id).filter((n) => Number.isInteger(n) && n > 0);
    if (employeeIds.length === 0) return caMap;

    const userIds = employees.map((e) => e.userId).filter((n) => Number.isInteger(n) && n > 0);

    const userIdToEmployeeId = new Map();
    for (const e of employees) {
        if (Number.isInteger(e.userId) && e.userId > 0) userIdToEmployeeId.set(e.userId, e.id);
    }

    const where = {
        companyId,
        date: { gte: from, lte: to },
        status: { in: ['PAID_CASH', 'PAID_CARD'] },
        OR: [
            // Factures partagées où au moins 1 employé de la liste a un share
            { shares: { some: { companyEmployeeId: { in: employeeIds } } } },

            // Factures non partagées -> auteur (via authorCompanyEmployeeId ou authorId)
            { shares: { none: {} }, authorCompanyEmployeeId: { in: employeeIds } },
            ...(userIds.length > 0 ? [{ shares: { none: {} }, authorId: { in: userIds } }] : []),
        ],
    };

    // Même règle que la commission: exclusion "Custom véhicule" si le module mecano est actif
    if (employees.some((e) => e.__hasMecano)) {
        where.NOT = { reason: { contains: 'Custom véhicule' } };
    }

    const bills = await prisma.bill.findMany({
        where,
        select: {
            amount: true,
            authorId: true,
            authorCompanyEmployeeId: true,
            shares: {
                where: { companyEmployeeId: { in: employeeIds } },
                select: { companyEmployeeId: true, percentage: true },
            },
        },
    });

    const totals = new Map(employeeIds.map((id) => [id, new Decimal(0)]));

    for (const bill of bills) {
        const amount = new Decimal(bill.amount ?? 0);
        const shares = Array.isArray(bill.shares) ? bill.shares : [];

        // Cas shares => prorata par % (uniquement les shares de la liste)
        if (shares.length > 0) {
            for (const s of shares) {
                const empId = s.companyEmployeeId;
                if (!totals.has(empId)) continue;

                const pct = new Decimal(s.percentage ?? 0);
                if (pct.lte(0)) continue;

                totals.set(empId, totals.get(empId).plus(amount.mul(pct).div(100)));
            }
            continue;
        }

        // Cas pas de shares => 100% pour l'auteur
        let targetEmpId = null;

        if (Number.isInteger(bill.authorCompanyEmployeeId) && totals.has(bill.authorCompanyEmployeeId)) {
            targetEmpId = bill.authorCompanyEmployeeId;
        } else {
            const mapped = userIdToEmployeeId.get(bill.authorId);
            if (mapped && totals.has(mapped)) targetEmpId = mapped;
        }

        if (targetEmpId) {
            totals.set(targetEmpId, totals.get(targetEmpId).plus(amount));
        }
    }

    for (const [empId, dec] of totals.entries()) {
        const num = Number(dec.toFixed(2));
        caMap.set(empId, Number.isFinite(num) ? num : 0);
    }

    return caMap;
}

async function getBillCountsForEmployeeList(employees, dateRange, ctx = {}) {
    const employeeBillCountMap = new Map();
    if (!Array.isArray(employees) || employees.length === 0) return employeeBillCountMap;

    const companyId = Number.parseInt(ctx.companyId ?? employees?.[0]?.companyId, 10);
    if (!Number.isInteger(companyId) || companyId <= 0) {
        throw new Error('companyId manquant ou invalide pour le comptage des factures.');
    }

    const userIds = employees.map((e) => e.userId).filter(Boolean);
    if (userIds.length === 0) {
        employees.forEach((e) => employeeBillCountMap.set(e.id, 0));
        return employeeBillCountMap;
    }

    const from = dateRange?.from instanceof Date ? dateRange.from : (dateRange?.from ? new Date(dateRange.from) : null);
    const to   = dateRange?.to   instanceof Date ? dateRange.to   : (dateRange?.to   ? new Date(dateRange.to)   : null);

    const hasRangeArgs = Boolean(dateRange?.from || dateRange?.to);
    const hasValidRange = (from instanceof Date && !Number.isNaN(from.getTime())) && (to instanceof Date && !Number.isNaN(to.getTime()));

    if (hasRangeArgs && !hasValidRange) {
        throw new Error('Plage de dates invalide (from/to) pour le comptage des factures.');
    }

    const where = {
        companyId,
        authorId: { in: userIds },
    };

    if (hasValidRange) {
        where.date = { gte: from, lte: to };
    }

    const billCounts = await prisma.bill.groupBy({
        by: ['authorId'],
        _count: { id: true },
        where,
    });

    const userCountMap = new Map(billCounts.map((item) => [item.authorId, item._count.id]));

    employees.forEach((employee) => {
        employeeBillCountMap.set(employee.id, userCountMap.get(employee.userId) || 0);
    });

    return employeeBillCountMap;
}

/**
 * Génère le rapport de déclaration fiscale pour une semaine donnée, en calculant dynamiquement
 * la masse salariale comme une dépense déductible.
 */
async function generateTaxDeclaration(companyId, year, week) {

    const { getTotalPayrollForPeriod } = require('../employees/employees.service');

    // Ancre ISO fiable : le 4 janvier est toujours dans l'année ISO "year"
    const isoYearAnchor = new Date(year, 0, 4);

    // Date quelconque dans la semaine ISO demandée
    const dateInWeek = setISOWeek(isoYearAnchor, week);

    // Lundi 00:00:00.000 -> Dimanche 23:59:59.999 (en local)
    const startDate = startOfISOWeek(dateInWeek);
    const endDate = endOfISOWeek(dateInWeek);

    const dateRange = { from: startDate, to: endDate };

    const [transactions, allCategories] = await prisma.$transaction([
        prisma.transaction.findMany({
            where: { companyId, date: { gte: startDate, lte: endDate } },
            include: { category: true }
        }),
        prisma.transactionCategory.findMany()
    ]);

    const firstTx = await prisma.transaction.findFirst({
        where: { companyId, date: { gte: startDate, lte: endDate } },
        orderBy: { date: 'asc' },
        include: { category: true }
    });

    const lastTx = await prisma.transaction.findFirst({
        where: { companyId, date: { gte: startDate, lte: endDate } },
        orderBy: { date: 'desc' },
        include: { category: true }
    });

    const totalsByCategory = new Map();
    for (const tx of transactions) {
        if (tx.category.name === 'SALAIRES') continue;
        const amount = parseFloat(tx.amount);
        const categoryName = tx.category.name;
        const currentTotal = totalsByCategory.get(categoryName) || 0;
        totalsByCategory.set(categoryName, currentTotal + amount);
    }
    // --- LOGIQUE CORRIGÉE ---

    // 1. Construire le détail complet (fullBreakdown) avec les noms traduits
    const fullBreakdown = { revenues: [], deductibleExpenses: [], nonDeductibleExpenses: [] };
    allCategories.forEach(category => {
        if (category.name === 'SALAIRES') return;
        const total = totalsByCategory.get(category.name) || 0;
        const detailItem = { name: CATEGORY_LABELS[category.name] || category.name, total };
        if (category.type === 'REVENUE') fullBreakdown.revenues.push(detailItem);
        else if (category.isDeductible) fullBreakdown.deductibleExpenses.push(detailItem);
        else fullBreakdown.nonDeductibleExpenses.push(detailItem);
    });

    // 2. Calculer la masse salariale et l'ajouter AU DÉTAIL COMPLET
    const totalPayroll = await getTotalPayrollForPeriod(companyId, dateRange);
    fullBreakdown.deductibleExpenses.unshift({ name: 'Masse Salariale', total: totalPayroll });

    // 3. Construire la synthèse (expenseDetails) À PARTIR du détail complet
    const expenseDetails = [];
    let totalDeductibleExpenses = 0;

    // On utilise les noms traduits standardisés partout
    const accountingLabel = CATEGORY_LABELS['FRAIS_COMPTABLE'];
    const lawyerLabel = CATEGORY_LABELS['AVOCATS'];

    const deductibleMap = new Map(fullBreakdown.deductibleExpenses.map(item => [item.name, item.total]));

    const accountingFees = deductibleMap.get(accountingLabel) || 0;
    const deductibleAccounting = Math.min(accountingFees, 8000);

    const lawyerFees = deductibleMap.get(lawyerLabel) || 0;
    const remainingSharedCap = Math.max(0, 30000 - deductibleAccounting);
    const deductibleLawyers = Math.min(lawyerFees, remainingSharedCap);

    // On parcourt le détail complet pour construire la synthèse sans doublons
    fullBreakdown.deductibleExpenses.forEach(item => {
        let deductibleAmount = item.total;
        let cap = null;

        if (item.name === accountingLabel) {
            deductibleAmount = deductibleAccounting;
            cap = 8000;
        } else if (item.name === lawyerLabel) {
            deductibleAmount = deductibleLawyers;
            cap = `Partagé (max 30k)`;
        }

        expenseDetails.push({ category: item.name, total: item.total, deductible: deductibleAmount, cap });
        totalDeductibleExpenses += deductibleAmount;
    });

    // 4. Calculs finaux
    const totalRevenue = fullBreakdown.revenues.reduce((sum, item) => sum + item.total, 0);
    const totalDonations = (fullBreakdown.revenues.find(r => r.name === CATEGORY_LABELS['DONS_RECUS'])?.total || 0);
    const profit = totalRevenue - totalDeductibleExpenses;

    const profitTax = _calculateProgressiveTax(profit);
    const donationDetails = _calculateDonationTax(totalDonations);
    const totalTax = profitTax + donationDetails.taxAmount;

    // 5. Renvoyer la réponse
    return {
        period: { year, week, from: startDate.toISOString(), to: endDate.toISOString() },
        summary: { totalRevenue, totalDeductibleExpenses, profit },
        expenseDetails,
        donationDetails: { totalDonations, ...donationDetails },
        taxCalculation: { profitTax, donationTax: donationDetails.taxAmount, totalTax },
        fullBreakdown
    };
}

async function getExpenseReportStatsForEmployeeList(employees, dateRange) {
    const statsMap = new Map();
    const userIds = employees.map(e => e.userId);

    if (userIds.length === 0) return statsMap;
    const companyId = employees[0].companyId;
    // 1. On fait une seule requête groupée pour récupérer toutes les données nécessaires
    const aggregates = await prisma.expenseReport.groupBy({
        by: ['authorId', 'status'],
        _sum: { amount: true },
        where: {
            authorId: { in: userIds },
            companyId: companyId,
            date: { gte: new Date(dateRange.from), lte: new Date(dateRange.to) }
        }
    });

    // 2. On prépare une structure pour chaque employé
    employees.forEach(employee => {
        statsMap.set(employee.id, {
            expenseReportTotal: 0,
            expenseReportPending: 0,
            expenseReportReimbursed: 0,
            expenseReportRejected: 0
        });
    });

    // 3. On remplit les données à partir des résultats de la requête
    for (const agg of aggregates) {
        const employee = employees.find(e => e.userId === agg.authorId);
        if (employee) {
            const stats = statsMap.get(employee.id);
            const amount = parseFloat(agg._sum.amount) || 0;

            stats.expenseReportTotal += amount;
            if (agg.status === 'PENDING') stats.expenseReportPending += amount;
            if (agg.status === 'REIMBURSED') stats.expenseReportReimbursed += amount;
            if (agg.status === 'REJECTED') stats.expenseReportRejected += amount;
        }
    }

    return statsMap;
}

async function createExpenseReport(companyId, authorId, data) {
    const { categoryId, amount, comment, date } = data;
    if (!categoryId || !amount || !comment || !date) {
        throw new Error("Tous les champs sont requis.");
    }
    const report = await prisma.expenseReport.create({
        data: {
            amount: parseFloat(amount),
            comment,
            date: new Date(date),
            companyId,
            authorId,
            categoryId: parseInt(categoryId),
        }
    });

    // --- LOG POUR AUTOMATION (SCRATCH) ---
    try {
        await prisma.log.create({
            data: {
                companyId,
                category: 'comptabilite',
                logType: 'EXPENSE_REPORT_CREATE',
                data: JSON.stringify(report),
                date: new Date().toISOString(),
                isProcessed: false // Sera traité par LogProcessor qui déclenchera Scratch
            }
        });
    } catch (e) {
        console.error("[ComptabiliteService] Erreur création log expense report :", e);
    }

    return report;
}

async function getExpenseReports(companyId) {
    return prisma.expenseReport.findMany({
        where: { companyId },
        include: {
            author: { select: { name: true } },
            category: true,
            reviewer: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' }
    });
}

async function updateExpenseReportStatus(reportId, reviewerId, status) {
    if (!['REIMBURSED', 'REJECTED', 'PENDING'].includes(status)) {
        throw new Error("Statut invalide.");
    }

    if (status !== 'PENDING' && !reviewerId) {
        throw new Error("Reviewer requis pour REIMBURSED/REJECTED.");
    }

    const updated = await prisma.expenseReport.update({
        where: { id: reportId },
        data: {
            status,
            reviewerId: status === 'PENDING' ? null : reviewerId
        },
        include: { company: true }
    });

    // --- LOG POUR AUTOMATION (SCRATCH) ---
    try {
        await prisma.log.create({
            data: {
                companyId: updated.companyId,
                category: 'comptabilite',
                logType: 'EXPENSE_REPORT_STATUS_CHANGE',
                data: JSON.stringify(updated),
                date: new Date().toISOString(),
                isProcessed: false
            }
        });
    } catch (e) {
        console.error("[ComptabiliteService] Erreur création log expense report status change :", e);
    }

    return updated;
}

async function getExpenseReportCategories(companyId) {
    return prisma.expenseReportCategory.findMany({
        where: { companyId },
        orderBy: { name: 'asc' }
    });
}

async function createExpenseReportCategory(companyId, name) {
    if (!name) throw new Error("Le nom de la catégorie est requis.");
    return prisma.expenseReportCategory.create({
        data: { name, companyId }
    });
}

async function updateExpenseReportCategory(companyId, categoryId, name) {
    const existing = await prisma.expenseReportCategory.findFirst({
        where: { id: categoryId, companyId },
    });
    if (!existing) throw new Error('Catégorie introuvable.');
    const trimmed = String(name || '').trim();
    if (!trimmed) throw new Error('Nom requis.');
    return prisma.expenseReportCategory.update({
        where: { id: categoryId },
        data: { name: trimmed },
    });
}

async function deleteExpenseReportCategory(companyId, categoryId) {
    const existing = await prisma.expenseReportCategory.findFirst({
        where: { id: categoryId, companyId },
        include: { _count: { select: { reports: true } } },
    });
    if (!existing) throw new Error('Catégorie introuvable.');
    if (existing._count.reports > 0) throw new Error('Impossible de supprimer une catégorie utilisée par des rapports.');
    return prisma.expenseReportCategory.delete({ where: { id: categoryId } });
}

/** WIDGETS FUNCTIONS **/
/** Données pour le widget Mes Factures par Statut */
async function getWidgetData_UserBillsByStatus(userId, companyId, config) {
    const whereClause = { companyId, authorId: userId };
    if (config.timeframe === 'week') {
        const firstDayOfWeek = startOfWeek(new Date(), { weekStartsOn: 1 });
        whereClause.date = { gte: firstDayOfWeek };
    }
    const billCounts = await prisma.bill.groupBy({ by: ['status'], _count: { id: true }, where: whereClause });
    const stats = { TOTAL: 0, UNPAID: 0, PAID_CASH: 0, PAID_CARD: 0, CANCELED: 0 };
    billCounts.forEach(item => {
        stats[item.status] = item._count.id;
        stats.TOTAL += item._count.id;
    });
    return stats;
}

/** Données pour le widget Stats des Notes de Frais */
async function getWidgetData_ExpenseReportStats(companyId) {
    const counts = await prisma.expenseReport.groupBy({ by: ['status'], _count: { id: true }, where: { companyId } });
    const stats = { pending: 0, reimbursed: 0, rejected: 0 };
    counts.forEach(item => {
        const statusKey = item.status.toLowerCase();
        if (stats.hasOwnProperty(statusKey)) stats[statusKey] = item._count.id;
    });
    return stats;
}

/** Données pour le widget Mes notes de frais récentes */
async function getWidgetData_MyRecentExpenseReports(userId, companyId) {
    return prisma.expenseReport.findMany({ where: { authorId: userId, companyId }, orderBy: { date: 'desc' }, take: 5 });
}

/**
 * Gère la commande /mySalary dans le chat.
 * Calcule le salaire de l'utilisateur pour la semaine en cours et renvoie une réponse éphémère.
 * @param {object} context
 * @param {number} context.userId - ID de l'utilisateur exécutant la commande.
 * @param {object} context.conversation - L'objet conversation complet (pour trouver companyId).
 * @returns {Promise<{ type: 'ephemeral', data: object } | { type: 'error', data: string }>}
 */
async function getSalaryChatResponse({ userId, conversation }) {
    // Trouver l'ID de l'entreprise via l'emploi de l'utilisateur ou la conversation
    let companyId;
    if (conversation.companyId) { // Si la conversation est liée à une entreprise (ex: événement d'entreprise)
        companyId = conversation.companyId;
    } else {
        // Sinon, trouver la première entreprise active de l'utilisateur
        const employment = await prisma.companyEmployee.findFirst({
            where: { userId: userId, status: 'ACTIVE' },
            select: { companyId: true }
        });
        if (!employment) {
            return { type: 'error', data: "Vous n'êtes actuellement employé dans aucune entreprise active." };
        }
        companyId = employment.companyId;
    }

    try {
        // Récupérer le détail du salaire pour la semaine en cours
        const { getSalaryBreakdown } = require('../employees/employees.service'); // Dépendance circulaire gérée ici
        const now = new Date();
        const year = getYear(now);
        const week = getISOWeek(now);
        const dateInWeek = setISOWeek(setYear(now, year), week);
        const dateRange = { from: startOfWeek(dateInWeek, { weekStartsOn: 1 }), to: endOfWeek(dateInWeek, { weekStartsOn: 1 }) };

        const employee = await prisma.companyEmployee.findUnique({
            where: { companyId_userId: { userId, companyId } }
        });
        if (!employee) {
            return { type: 'error', data: "Impossible de trouver vos informations d'employé pour cette entreprise." };
        }

        const salaryData = await getSalaryBreakdown(companyId, employee.id, dateRange);

        // Formater la réponse pour le chat (Markdown simple)
        let responseText = `**Votre Salaire (Semaine ${week}, ${year})**\n\n`;
        salaryData.breakdown.forEach(item => {
            responseText += `* ${item.label}: ${item.value.toFixed(2)} $\n`;
        });
        responseText += `\n**Total Brut Calculé:** ${salaryData.calculatedSalary.toFixed(2)} $\n`;
        if (salaryData.salaryCap > 0) {
            responseText += `*Plafond du Rang:* ${salaryData.salaryCap.toFixed(2)} $\n`;
        }
        responseText += `**Salaire Final:** __${salaryData.finalSalary.toFixed(2)} $__ ${salaryData.isCapped ? '(Plafonné)' : ''}`;

        return {
            type: 'ephemeral', // Ne sera pas stocké en BDD
            data: { content: responseText } // Contenu à afficher au client
        };

    } catch (error) {
        console.error("Erreur commande /mySalary:", error);
        return { type: 'error', data: "Impossible de calculer votre salaire." };
    }
}

/**
 * Calcule le salaire basé sur le temps de service en utilisant les CalendarEvents.
 * @param {object} employee - L'objet employé complet (incluant rank et user).
 * @param {object} dateRange - L'objet { from: Date, to: Date }.
 * @returns {Promise<object>} - Objet { key, value, templateVariables }.
 */
async function calculateServiceTimeSalary(employee, dateRange) {
    const serviceSalaryPerMinute = employee.rank?.remunerationConfig?.serviceSalaryPerMinute;
    if (!serviceSalaryPerMinute || serviceSalaryPerMinute <= 0) {
        return { key: 'serviceSalaryPerMinute', value: 0, templateVariables: { totalMinutes: 0, serviceSalaryPerMinute: 0 } };
    }

    // Récupérer les événements de service TERMINÉS pendant la période
    const serviceEvents = await prisma.calendarEvent.findMany({
        where: {
            userId: employee.userId,
            companyId: employee.companyId,
            createdBySystem: true, // Filtrer sur les événements créés par le système (duty handler)
            title: { startsWith: 'Prise de Service' }, // S'assurer que c'est un événement de service
            endTime: {
                not: null,           // S'assurer que le service est terminé
                gte: new Date(dateRange.from), // La fin doit être DANS la période
                lte: new Date(dateRange.to),   // La fin doit être DANS la période
            },
            // Optionnel: Ajouter une condition sur startTime si nécessaire, mais endTime est généralement suffisant
            // startTime: {
            //     lt: new Date(dateRange.to) // Le début doit être avant la fin de la période
            // }
        },
        select: {
            startTime: true,
            endTime: true,
        }
    });

    let totalMinutes = 0;
    const details = [];

    // Calculer la durée pour chaque événement trouvé
    for (const event of serviceEvents) {
        // endTime est garanti non null par la clause where
        if (event.startTime && event.endTime) {
            const duration = differenceInMinutes(event.endTime, event.startTime);
            if (duration > 0) {
                totalMinutes += duration;
                details.push({
                    date: event.startTime,
                    label: "Session de service",
                    value: duration * serviceSalaryPerMinute
                });
            }
        }
    }

    const calculatedSalary = totalMinutes * serviceSalaryPerMinute;

    return {
        key: 'serviceSalaryPerMinute',
        value: calculatedSalary,
        templateVariables: {
            totalMinutes: totalMinutes,
            serviceSalaryPerMinute: serviceSalaryPerMinute
        },
        details
    };
}

/**
 * Calcule le temps de service total pour chaque employé dans la liste, utilisant CalendarEvent.
 * @param {Array} employees - Liste des employés.
 * @param {object} dateRange - Période { from, to }.
 * @returns {Promise<Map<number, number>>} - Map(employeeId -> totalMinutes).
 */
async function getServiceTimesForEmployeeList(employees, dateRange) {
    const timeMap = new Map();
    // Initialiser la map pour tous les employés
    employees.forEach(emp => timeMap.set(emp.id, 0));

    const userIds = employees.map(e => e.userId);
    const companyId = employees.length > 0 ? employees[0].companyId : null; // Assumer qu'ils sont tous de la même compagnie

    if (userIds.length === 0 || !companyId) return timeMap;

    // Récupérer tous les événements de service terminés pour ces utilisateurs dans la période
    const serviceEvents = await prisma.calendarEvent.findMany({
        where: {
            userId: { in: userIds },
            companyId: companyId,
            createdBySystem: true,
            title: { startsWith: 'Prise de Service' },
            endTime: {
                not: null,
                gte: new Date(dateRange.from),
                lte: new Date(dateRange.to),
            },
        },
        select: {
            userId: true,
            startTime: true,
            endTime: true,
        }
    });

    // Calculer et agréger le temps par userId
    const userMinutesMap = new Map();
    userIds.forEach(id => userMinutesMap.set(id, 0));

    for (const event of serviceEvents) {
        if (event.startTime && event.endTime) {
            const duration = differenceInMinutes(event.endTime, event.startTime);
            if (duration > 0) {
                userMinutesMap.set(event.userId, (userMinutesMap.get(event.userId) || 0) + duration);
            }
        }
    }

    // Mapper les minutes totales vers l'employeeId
    employees.forEach(emp => {
        const totalMinutes = userMinutesMap.get(emp.userId) || 0;
        const formatted = serviceTimeFormat(totalMinutes * 60);
        timeMap.set(emp.id, {
            serviceTime: formatted,
            totalMinutes,
            formatted,
        });
    });

    return timeMap;
}


function safeModuleName(name) {
    return String(name || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "");
}

function deepMerge(base, patch) {
    if (!patch || typeof patch !== "object") return base;
    const out = Array.isArray(base) ? [...base] : { ...(base || {}) };

    for (const [k, v] of Object.entries(patch)) {
        const baseVal = base ? base[k] : undefined;

        if (
            v &&
            typeof v === "object" &&
            !Array.isArray(v) &&
            baseVal &&
            typeof baseVal === "object" &&
            !Array.isArray(baseVal)
        ) {
            out[k] = deepMerge(baseVal, v);
        } else {
            out[k] = v;
        }
    }
    return out;
}

function tryLoadModuleSettings(moduleNameRaw) {
    const moduleName = safeModuleName(moduleNameRaw);
    if (!moduleName) return null;

    try {
        // /src/modules/<module>/<module>.settings.js
        const settingsPath = path.join(__dirname, "..", moduleName, `${moduleName}.settings.js`);
        const def = require(settingsPath);

        // Contrat minimal
        if (!def || !def.key || !def.fields || !def.defaults || typeof def.sanitize !== "function") {
            return null;
        }

        return def;
    } catch {
        return null;
    }
}

/**
 * Récupère les paramètres d'une entreprise (nom, clés, etc.)
 */
async function getCompanySettings(companyId) {
    // 1) Structure existante (inchangée)
    const settings = await prisma.company.findUnique({
        where: { id: companyId },
        select: {
            id: true,
            name: true,
            apiKey: true,
            onboardingKey: true,
        },
    });

    if (!settings) throw new Error("Entreprise non trouvée.");

    // 2) Charger CompanySettings.settings (JSON) - upsert pour garantir existence
    const cs = await prisma.companySettings.upsert({
        where: { companyId },
        create: { companyId, settings: {} },
        update: {},
        select: { settings: true },
    });

    const storedSettings = cs?.settings && typeof cs.settings === "object" ? cs.settings : {};

    // 3) Modules actifs
    const { getActiveModulesForCompany } = require('../../lib/moduleUtils');
    const active = await getActiveModulesForCompany(companyId);

    // 4) Charger defs settings des modules actifs
    const defs = (active || [])
        .map((a) => {
            const def = tryLoadModuleSettings(a.module.name);
            if (!def) return null;

            return {
                moduleName: a.module.name,
                moduleLabel: a.module.description || a.module.name,
                def,
            };
        })
        .filter(Boolean);

    // 5) Construire settingsForms (format "rank-form-settings like")
    const settingsFieldsByModuleKey = {};
    const settingsDefaultsByModuleKey = {};

    for (const { moduleLabel, def } of defs) {
        settingsFieldsByModuleKey[def.key] = {
            type: "object",
            required: false,
            label: moduleLabel,
            schema: def.fields,
        };

        settingsDefaultsByModuleKey[def.key] = def.defaults;
    }

    const settingsForms = {
        fields: {
            settings: {
                type: "object",
                required: false,
                label: "Paramètres",
                schema: settingsFieldsByModuleKey,
            },
        },
        defaults: {
            settings: settingsDefaultsByModuleKey,
        },
    };

    // 6) Sanitize valeurs existantes par module (optionnel mais recommandé)
    const sanitizedByModule = {};
    for (const { def } of defs) {
        sanitizedByModule[def.key] = def.sanitize(storedSettings?.[def.key]);
    }

    // 7) Resolved (defaults + valeurs)
    const resolvedSettings = deepMerge(settingsForms.defaults.settings, sanitizedByModule);

    // 8) Retour : structure existante + ajouts
    return {
        ...settings,
        settingsForms,
        settingsValues: { settings: sanitizedByModule },
        settingsResolved: { settings: resolvedSettings },
    };
}


/**
 * Met à jour le nom d'une entreprise
 */
async function updateCompany(companyId, name) {
    if (!name || typeof name !== 'string' || name.trim() === '') {
        throw new Error("Le nom de l'entreprise est requis.");
    }

    const updated = await prisma.company.update({
        where: { id: companyId },
        data: { name: name.trim() },
        select: { id: true, name: true },
    });

    return updated;
}

/**
 * Régénère la clé API
 */
async function generateApiKey(companyId) {
    const newApiKey = crypto.randomBytes(32).toString('hex');
    await prisma.company.update({
        where: { id: companyId },
        data: { apiKey: newApiKey },
    });
    return { apiKey: newApiKey };
}

/**
 * Régénère la clé d’onboarding
 */
async function regenerateOnboardingKey(companyId) {
    const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true },
    });

    if (!company) throw new Error("Entreprise introuvable.");

    const slug = company.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const randomPart = crypto.randomBytes(16).toString('hex');
    const newKey = `${slug}-${randomPart}`;

    await prisma.company.update({
        where: { id: companyId },
        data: { onboardingKey: newKey },
    });

    return { onboardingKey: newKey };
}

/** Données pour le widget Temps de service utilisateur */
async function getWidgetData_UserDutyCounter(userId, companyId, config) {
    const showGlobal = config?.showGlobal === true;
    const globalTimeframe = config?.globalTimeframe || 'week'; // 'week' (par défaut)

    // 1) Service actif (session en cours)
    const activeService = await prisma.calendarEvent.findFirst({
        where: {
            companyId,
            userId,
            createdBySystem: true,
            endTime: null,
        },
        orderBy: {
            startTime: 'desc',
        },
        select: {
            id: true,
            startTime: true,
        }
    });

    const nowMs = Date.now();

    // Helper: calc range global (actuellement uniquement "week" car tu as demandé "temps global" sans autre précision)
    // -> semaine ISO locale, lundi 00:00:00 -> dimanche 23:59:59
    let rangeFrom = null;
    let rangeTo = null;

    if (showGlobal) {
        const now = new Date();
        if (globalTimeframe === 'week') {
            rangeFrom = startOfWeek(now, { weekStartsOn: 1 });
            rangeTo = endOfWeek(now, { weekStartsOn: 1 });
        } else {
            // fallback = week
            rangeFrom = startOfWeek(now, { weekStartsOn: 1 });
            rangeTo = endOfWeek(now, { weekStartsOn: 1 });
        }
    }

    // 2) Si pas de service actif
    if (!activeService) {
        if (!showGlobal) {
            return { inService: false };
        }

        // Total global (sans session active)
        const events = await prisma.calendarEvent.findMany({
            where: {
                companyId,
                userId,
                createdBySystem: true,
                title: { startsWith: 'Prise de Service' },
                endTime: {
                    not: null,
                    gte: new Date(rangeFrom),
                    lte: new Date(rangeTo),
                },
            },
            select: { startTime: true, endTime: true },
        });

        let totalSeconds = 0;
        for (const ev of events) {
            if (!ev.startTime || !ev.endTime) continue;
            const s = new Date(ev.startTime).getTime();
            const e = new Date(ev.endTime).getTime();
            const diff = Math.floor((e - s) / 1000);
            if (diff > 0) totalSeconds += diff;
        }

        return {
            inService: false,
            global: {
                timeframe: globalTimeframe,
                from: rangeFrom.toISOString(),
                to: rangeTo.toISOString(),
                totalSeconds,
                totalSecondsIncludingActive: totalSeconds,
                formatted: serviceTimeFormat(totalSeconds),
                formattedIncludingActive: serviceTimeFormat(totalSeconds),
            }
        };
    }

    // 3) Service actif => compteur session
    const startTimeMs = new Date(activeService.startTime).getTime();
    const elapsedSeconds = Math.max(0, Math.floor((nowMs - startTimeMs) / 1000));

    if (!showGlobal) {
        return {
            inService: true,
            startTime: activeService.startTime,
            elapsedSeconds,
            formattedElapsed: serviceTimeFormat(elapsedSeconds),
        };
    }

    // 4) Global + session active (on additionne le global terminé + elapsed de la session en cours)
    const endedEvents = await prisma.calendarEvent.findMany({
        where: {
            companyId,
            userId,
            createdBySystem: true,
            title: { startsWith: 'Prise de Service' },
            endTime: {
                not: null,
                gte: new Date(rangeFrom),
                lte: new Date(rangeTo),
            },
        },
        select: { startTime: true, endTime: true },
    });

    let totalSeconds = 0;
    for (const ev of endedEvents) {
        if (!ev.startTime || !ev.endTime) continue;
        const s = new Date(ev.startTime).getTime();
        const e = new Date(ev.endTime).getTime();
        const diff = Math.floor((e - s) / 1000);
        if (diff > 0) totalSeconds += diff;
    }

    return {
        inService: true,
        startTime: activeService.startTime,
        elapsedSeconds,
        formattedElapsed: serviceTimeFormat(elapsedSeconds),
        global: {
            timeframe: globalTimeframe,
            from: rangeFrom.toISOString(),
            to: rangeTo.toISOString(),
            totalSeconds,
            totalSecondsIncludingActive: totalSeconds + elapsedSeconds,
            formatted: serviceTimeFormat(totalSeconds),
            formattedIncludingActive: serviceTimeFormat(totalSeconds + elapsedSeconds),
        }
    };
}

async function getWidgetData_UsersDutyCounter(userId, companyId, config) {
    const limit = Number.isFinite(config?.limit) ? Math.max(1, config.limit) : 50;

    const activeServices = await prisma.calendarEvent.findMany({
        where: {
            companyId,
            createdBySystem: true,
            endTime: null,
        },
        orderBy: { startTime: 'desc' },
        distinct: ['userId'],
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    employments: { where: { companyId }, select: { id: true }, take: 1 },
                },
            },
        },
        take: limit,
    });

    const now = Date.now();

    const users = activeServices.map((ev) => {
        const startMs = new Date(ev.startTime).getTime();
        const elapsedSeconds = Math.max(0, Math.floor((now - startMs) / 1000));

        return {
            userId: ev.user.id,
            companyEmployeeId: ev.user.employments?.[0]?.id ?? null,
            calendarEventId: ev.id,
            name: ev.user.name,
            startTime: ev.startTime,
            elapsedSeconds,
            formattedElapsed: serviceTimeFormat(elapsedSeconds),
        };
    });

    return {
        inService: users.length > 0,
        count: users.length,
        users,
    };
}

function safeModuleName(name) {
    return String(name || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "");
}

function deepMerge(base, patch) {
    if (!patch || typeof patch !== "object") return base;
    const out = Array.isArray(base) ? [...base] : { ...(base || {}) };

    for (const [k, v] of Object.entries(patch)) {
        const baseVal = base ? base[k] : undefined;

        if (
            v &&
            typeof v === "object" &&
            !Array.isArray(v) &&
            baseVal &&
            typeof baseVal === "object" &&
            !Array.isArray(baseVal)
        ) {
            out[k] = deepMerge(baseVal, v);
        } else {
            out[k] = v;
        }
    }
    return out;
}

function tryLoadModuleSettings(moduleNameRaw) {
    const moduleName = safeModuleName(moduleNameRaw);
    if (!moduleName) return null;

    const candidateBases = [
        path.resolve(__dirname, ".."),
        path.resolve(__dirname, "../.."),
        path.resolve(process.cwd(), "src/modules"),
        path.resolve(process.cwd(), "dist/modules"),
    ];

    for (const base of candidateBases) {
        const settingsPath = path.join(base, moduleName, `${moduleName}.settings.js`);
        if (!fs.existsSync(settingsPath)) continue;

        delete require.cache[require.resolve(settingsPath)];
        const def = require(settingsPath);

        if (!def || !def.key || !def.fields || !def.defaults || typeof def.sanitize !== "function") {
            return null;
        }
        return def;
    }
    return null;
}

/**
 * Sauvegarde CompanySettings.settings (JSON) avec sanitation par module actif.
 * - body.settings doit être un objet { [moduleKey]: moduleSettingsObject }
 * - on sanitize uniquement les keys connues via defs
 * - on conserve les autres keys existantes (si un ancien module a laissé des données)
 */
async function updateCompanySettings(companyId, incomingSettings) {
    if (!Number.isFinite(companyId)) throw { status: 400, message: "companyId invalide." };
    if (!incomingSettings || typeof incomingSettings !== "object") {
        throw { status: 400, message: "Body invalide: settings attendu (object)." };
    }

    // Modules actifs
    const { getActiveModulesForCompany } = require('../../lib/moduleUtils');
    const active = await getActiveModulesForCompany(companyId);

    const defs = (active || [])
        .map((a) => {
            const def = tryLoadModuleSettings(a.module.name);
            if (!def) return null;
            return { moduleName: a.module.name, moduleLabel: a.module.description || a.module.name, def };
        })
        .filter(Boolean);

    // Chargement settings existants
    const current = await prisma.companySettings.upsert({
        where: { companyId },
        create: { companyId, settings: {} },
        update: {},
        select: { settings: true },
    });

    const currentSettings = current?.settings && typeof current.settings === "object" ? current.settings : {};

    // On prend une base = current, puis on remplace/sanitize chaque module connu
    const nextSettings = { ...currentSettings };

    for (const { def } of defs) {
        const rawIncoming = incomingSettings?.[def.key];
        nextSettings[def.key] = def.sanitize(rawIncoming);
    }

    await prisma.companySettings.update({
        where: { companyId },
        data: { settings: nextSettings },
    });

    // Retourner la même structure que getCompanySettings (inchangée) + settingsForms/values/resolved
    // => on réutilise votre getCompanySettings(companyId) existant enrichi
    return getCompanySettings(companyId);
}

async function updateExpenseReport(companyId, reportId, actorUserId, data) {
    if (!companyId || !reportId) throw new Error("Identifiants invalides.");

    const existing = await prisma.expenseReport.findUnique({
        where: { id: reportId },
        include: { category: true }
    });

    if (!existing || existing.companyId !== companyId) {
        throw new Error("Note de frais introuvable dans cette entreprise.");
    }

    // Choix volontaire (cohérent avec ton front) : modification uniquement si PENDING
    if (existing.status !== 'PENDING') {
        throw new Error("Impossible de modifier une note de frais non PENDING.");
    }

    const patch = {};
    const { categoryId, amount, comment, date } = data || {};

    if (categoryId !== undefined) {
        const cId = parseInt(categoryId, 10);
        if (!Number.isFinite(cId) || cId <= 0) throw new Error("Catégorie invalide.");

        const cat = await prisma.expenseReportCategory.findUnique({ where: { id: cId } });
        if (!cat || cat.companyId !== companyId) {
            throw new Error("Catégorie introuvable dans cette entreprise.");
        }
        patch.categoryId = cId;
    }

    if (amount !== undefined) {
        const a = parseFloat(amount);
        if (!Number.isFinite(a) || a <= 0) throw new Error("Montant invalide.");
        patch.amount = a;
    }

    if (comment !== undefined) {
        const c = String(comment).trim();
        if (!c) throw new Error("Le commentaire est requis.");
        patch.comment = c;
    }

    if (date !== undefined) {
        const d = new Date(date);
        if (Number.isNaN(d.getTime())) throw new Error("Date invalide.");
        patch.date = d;
    }

    if (Object.keys(patch).length === 0) {
        throw new Error("Aucune donnée à mettre à jour.");
    }

    return prisma.expenseReport.update({
        where: { id: reportId },
        data: patch,
        include: {
            author: { select: { name: true } },
            category: true,
            reviewer: { select: { name: true } }
        }
    });
}

async function deleteExpenseReport(companyId, reportId) {
    if (!companyId || !reportId) throw new Error("Identifiants invalides.");

    const existing = await prisma.expenseReport.findUnique({
        where: { id: reportId },
        select: { id: true, companyId: true, status: true }
    });

    if (!existing || existing.companyId !== companyId) {
        throw new Error("Note de frais introuvable dans cette entreprise.");
    }

    // Choix volontaire : suppression uniquement si PENDING (audit/traçabilité)
    if (existing.status !== 'PENDING') {
        throw new Error("Impossible de supprimer une note de frais non PENDING.");
    }

    await prisma.expenseReport.delete({ where: { id: reportId } });
    return { success: true };
}


function serviceTimeFormat(totalSeconds) {
    const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function round2(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.round((x + Number.EPSILON) * 100) / 100;
}

function validateSharesInput(shares) {
    if (!Array.isArray(shares)) {
        throw new Error('shares doit être un tableau.');
    }

    if (shares.length === 0) return;

    // companyEmployeeId unique
    const ids = shares.map((s) => Number.parseInt(String(s.companyEmployeeId), 10));
    if (ids.some((id) => !Number.isFinite(id))) {
        throw new Error('companyEmployeeId invalide dans shares.');
    }
    const unique = new Set(ids);
    if (unique.size !== ids.length) {
        throw new Error('Un CompanyEmployee ne peut apparaître qu’une seule fois dans le partage.');
    }

    // % valid : 0..100 inclus
    const percents = shares.map((s) => Number(s.percentage));
    if (percents.some((p) => !Number.isFinite(p))) {
        throw new Error('percentage invalide dans shares.');
    }
    if (percents.some((p) => p < 0 || p > 100)) {
        throw new Error('Chaque percentage doit être >= 0 et <= 100.');
    }

    // ✅ total <= 100
    const total = round2(percents.reduce((a, b) => a + b, 0));
    if (total > 100) {
        throw new Error(`La somme des pourcentages ne peut pas dépasser 100. Total actuel: ${total}`);
    }
}

async function updateBillShares(companyId, billId, shares) {
    const id = Number.parseInt(String(billId), 10);
    if (!Number.isFinite(id)) throw new Error('billId invalide.');

    const normalizedShares = Array.isArray(shares) ? shares : [];
    validateSharesInput(normalizedShares);

    return prisma.$transaction(async (tx) => {
        const bill = await tx.bill.findFirst({
            where: { id, companyId },
            select: { id: true, companyId: true },
        });

        if (!bill) {
            const e = new Error("Facture introuvable.");
            e.statusCode = 404;
            throw e;
        }

        // Vérif CompanyEmployee appartenance company (si non vide)
        if (normalizedShares.length > 0) {
            const employeeIds = normalizedShares.map((s) => Number.parseInt(String(s.companyEmployeeId), 10));

            const employees = await tx.companyEmployee.findMany({
                where: {
                    id: { in: employeeIds },
                    companyId,
                },
                select: { id: true },
            });

            if (employees.length !== employeeIds.length) {
                throw new Error("Un ou plusieurs employés ne appartiennent pas à cette entreprise.");
            }
        }

        // Remplacement total
        await tx.billShare.deleteMany({ where: { billId: bill.id } });

        if (normalizedShares.length > 0) {
            await tx.billShare.createMany({
                data: normalizedShares.map((s) => ({
                    billId: bill.id,
                    companyEmployeeId: Number.parseInt(String(s.companyEmployeeId), 10),
                    percentage: round2(s.percentage),
                })),
            });
        }

        // Retour facture complète (pour refresh front)
        return tx.bill.findUnique({
            where: { id: bill.id },
            include: {
                shares: true,
                author: true,
                client: true,
                canceledBy: true,
                authorCompanyEmployee: true,
            },
        });
    });
}


async function getSolde(companyId) {
    const companyIdNum = Number(companyId);
    if (!Number.isFinite(companyIdNum)) {
        const err = new Error('Invalid companyId');
        err.statusCode = 400;
        throw err;
    }

    const company = await prisma.company.findUnique({
        where: { id: companyIdNum },
        select: { balance: true },
    });

    if (!company) {
        const err = new Error('Company not found');
        err.statusCode = 404;
        throw err;
    }

    return company.balance ?? 0;
}

/**
 * Récupère les données de transaction pour un widget.
 */
async function getWidgetData_TransactionLog(companyId, config) {
    const start = Date.now();
    const { transactionCount = 10, groupBy, startDate, endDate, variantType = 'TABLE_VIEW' } = config;

    const where = {
        companyId: companyId,
        ...(startDate && endDate && { date: { gte: new Date(startDate), lte: new Date(endDate) } }),
    };

    try {
        // La logique pour la vue TABLEAU
        if (variantType === 'TABLE_VIEW') {
            const result = await prisma.transaction.findMany({
                where,
                orderBy: { date: 'desc' },
                take: parseInt(transactionCount, 10),
                include: { category: true },
            });
            console.log(`[Widgets] getWidgetData_TransactionLog (TABLE) took ${Date.now() - start}ms`);
            return result;
        }

        // BLOC POUR LA VUE GRAPHIQUE
        // Note: On limite les champs récupérés pour la performance si c'est pour un graphique
        const transactions = await prisma.transaction.findMany({
            where,
            select: {
                amount: true,
                category: {
                    select: {
                        name: true,
                        type: true,
                    }
                }
            }
        });

        // 1. Agréger les données
        const aggregatedData = transactions.reduce((acc, tx) => {
            const key = groupBy === 'TYPE' ? tx.category.type : tx.category.name;
            if (!acc[key]) acc[key] = 0;
            acc[key] += tx.amount.toNumber();
            return acc;
        }, {});

        // 2. Formater pour le frontend
        const labels = Object.keys(aggregatedData);
        const data = Object.values(aggregatedData);

        console.log(`[Widgets] getWidgetData_TransactionLog (CHART) took ${Date.now() - start}ms`);
        return { labels, data };
    } catch (error) {
        console.error(`[Widgets] Error in getWidgetData_TransactionLog: ${error.message}`);
        throw error;
    }
}

async function addBillComment(companyId, billId, authorId, content) {
    if (!content || !content.trim()) throw new Error("Le contenu du commentaire ne peut pas être vide.");

    const bill = await prisma.bill.findFirst({ where: { id: billId, companyId } });
    if (!bill) throw new Error("Facture introuvable.");

    return prisma.billComment.create({
        data: {
            content: content.trim(),
            billId,
            authorId,
            companyId
        },
        include: {
            author: { select: { name: true, id: true } }
        }
    });
}

async function getBillComments(companyId, billId, page = 1, limit = 5) {
    const skip = (page - 1) * limit;
    
    const [total, comments] = await prisma.$transaction([
        prisma.billComment.count({ where: { billId, companyId } }),
        prisma.billComment.findMany({
            where: { billId, companyId },
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                author: { select: { name: true, id: true } }
            }
        })
    ]);

    return {
        data: comments,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    };
}

async function editBillComment(companyId, commentId, userId, newContent, canEditAny) {
    if (!newContent || !newContent.trim()) throw new Error("Le contenu du commentaire ne peut pas être vide.");

    const comment = await prisma.billComment.findFirst({ where: { id: commentId, companyId } });
    if (!comment) throw new Error("Commentaire introuvable.");

    if (comment.authorId !== userId && !canEditAny) {
        throw { statusCode: 403, message: "Vous n'avez pas l'autorisation de modifier ce commentaire." };
    }

    return prisma.billComment.update({
        where: { id: commentId },
        data: { content: newContent.trim() },
        include: {
            author: { select: { name: true, id: true } }
        }
    });
}

async function deleteBillComment(companyId, commentId, userId, canDeleteAny) {
    const comment = await prisma.billComment.findFirst({ where: { id: commentId, companyId } });
    if (!comment) throw new Error("Commentaire introuvable.");

    if (comment.authorId !== userId && !canDeleteAny) {
        throw { statusCode: 403, message: "Vous n'avez pas l'autorisation de supprimer ce commentaire." };
    }

    await prisma.billComment.delete({ where: { id: commentId } });
    return { success: true };
}

module.exports = {
    serviceTimeFormat,
    getWidgetData_TransactionLog,
    getSolde,
    calculateServiceTimeSalary,
    getServiceTimesForEmployeeList,
    createExpenseReport,
    getExpenseReports,
    updateExpenseReportStatus,
    getExpenseReportCategories,
    createExpenseReportCategory,
    updateExpenseReportCategory,
    deleteExpenseReportCategory,
    getJournalTransactions,
    getJournalSummary,
    updateTransactionCategory,
    getBills,
    getBillDetails,
    updateBillShares,
    getTransactionCategories,
    getSalariesForEmployeeList,
    getBillCountsForEmployeeList,
    getCaForEmployeeList,
    calculateCommissionSalary,
    generateTaxDeclaration,
    getExpenseReportStatsForEmployeeList,
    getWidgetData_UserBillsByStatus,
    getWidgetData_ExpenseReportStats,
    getWidgetData_MyRecentExpenseReports,
    getWidgetData_UserDutyCounter,
    getWidgetData_UsersDutyCounter,
    getSalaryChatResponse,
    getCompanySettings,
    updateCompany,
    generateApiKey,
    regenerateOnboardingKey,
    calculateFixedSalary,
    updateCompanySettings,
    updateExpenseReport,
    deleteExpenseReport,
    addBillComment,
    getBillComments,
    editBillComment,
    deleteBillComment,
};