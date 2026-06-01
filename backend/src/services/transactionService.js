// backend/src/services/transactionService.js
const prisma = require('../db');
const { startOfWeek, endOfWeek, parseISO, setISOWeek, startOfISOWeek, endOfISOWeek } = require('date-fns');

// Helper pour construire la clause WHERE dynamiquement
const buildWhereClause = (companyId, weekParams, filters) => {
    let dateFilter = {};

    // Priorité aux filtres de date explicites
    if (filters.startDate && filters.endDate) {
        dateFilter = {
            gte: parseISO(filters.startDate),
            lte: parseISO(filters.endDate),
        };
    } else { // Sinon, on utilise le sélecteur de semaine
        const dateInYear = new Date(weekParams.year, 0, 1);
        const dateInWeek = setISOWeek(dateInYear, weekParams.week);
        dateFilter = {
            gte: startOfISOWeek(dateInWeek),
            lte: endOfISOWeek(dateInWeek),
        };
    }

    return {
        companyId: companyId,
        date: dateFilter,
        description: filters.description && filters.description.length > 0
            ? { contains: filters.description }
            : undefined,
        amount: {
            gte: filters.minAmount && filters.minAmount.length > 0 ? parseFloat(filters.minAmount) : undefined,
            lte: filters.maxAmount && filters.maxAmount.length > 0 ? parseFloat(filters.maxAmount) : undefined,
        },
        category: {
            type: filters.type || undefined,
            name: filters.category && filters.category.length > 0
                ? { in: filters.category }
                : undefined,
        }
    };
};

/**
 * Récupère les transactions paginées et filtrées.
 */
async function getJournalTransactions(companyId, weekParams, filters, page, pageSize) {
    const where = buildWhereClause(companyId, weekParams, filters);
    const skip = (page - 1) * pageSize;

    const [transactions, totalCount] = await prisma.$transaction([
        prisma.transaction.findMany({
            where,
            include: { category: true },
            orderBy: { date: 'desc' },
            skip: skip,
            take: pageSize,
        }),
        prisma.transaction.count({ where }),
    ]);

    return { transactions, totalCount };
}

/**
 * Récupère TOUTES les transactions filtrées pour les graphiques (non paginé).
 */
async function getJournalSummary(companyId, weekParams, filters) {
    const where = buildWhereClause(companyId, weekParams, filters);

    // --- CORRECTION APPLIQUÉE ICI ---
    // On remplace la clause `select` restrictive par `include` pour avoir toutes les données,
    // y compris `categoryId` et l'objet `category` complet avec son `id`.
    return prisma.transaction.findMany({
        where,
        include: {
            category: true,
        },
        orderBy: {
            date: 'asc',
        },
    });
}

/**
 * Met à jour la catégorie d'une transaction de manière sécurisée.
 */
async function updateTransactionCategory(transactionId, categoryId, companyId) {
    // 1. Récupérer en parallèle la transaction originale et la nouvelle catégorie
    const [transaction, newCategory] = await Promise.all([
        prisma.transaction.findUnique({
            where: { id: transactionId },
            include: { category: true } // On inclut l'ancienne catégorie pour connaître son type
        }),
        prisma.transactionCategory.findUnique({
            where: { id: categoryId }
        })
    ]);

    // 2. Vérifier que les données existent et que la transaction appartient à la bonne entreprise
    if (!transaction || !newCategory) {
        throw new Error("Transaction ou catégorie introuvable.");
    }

    if (transaction.companyId !== companyId) {
        throw new Error("Accès non autorisé à cette transaction.");
    }

    // 3. Validation principale : si la transaction a déjà une catégorie,
    // on s'assure que la nouvelle catégorie est du même type (REVENUE ou EXPENSE).
    if (transaction.category && transaction.category.type !== newCategory.type) {
        // Cette erreur sera renvoyée à l'utilisateur s'il tente de tricher avec l'API
        throw new Error(`Assignation incohérente : une transaction de type '${transaction.category.type}' ne peut pas avoir une catégorie de type '${newCategory.type}'.`);
    }

    // 4. Si toutes les vérifications passent, on met à jour la transaction
    return prisma.transaction.update({
        where: {
            id: transactionId,
        },
        data: { categoryId: categoryId },
        include: { category: true },
    });
}

module.exports = {
    getJournalTransactions,
    getJournalSummary,
    updateTransactionCategory,
};