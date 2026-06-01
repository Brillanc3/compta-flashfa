// backend/src/services/adminAnalyticsService.js
const prisma = require('../db');
const { startOfDay, endOfDay } = require('date-fns');
const { format } = require('date-fns');

/**
 * Calcule les indicateurs de performance clés (KPIs) pour une entreprise.
 * @param {number} companyId
 */
async function getKpiMetrics(companyId) {
    const [userCount, billCount, logCount] = await prisma.$transaction([
        prisma.companyEmployee.count({ where: { companyId } }),
        prisma.bill.count({ where: { companyId } }),
        prisma.log.count({ where: { companyId } })
    ]);
    return { userCount, billCount, logCount };
}

/**
 * Calcule les données de revenus pour le graphique principal.
 * Agrège les transactions par minute pour la journée en cours.
 * @param {number} companyId
 */
async function getRevenueData(companyId) {
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const transactions = await prisma.transaction.findMany({
        where: {
            companyId: companyId,
            category: { type: 'REVENUE' },
            date: { gte: todayStart, lte: todayEnd },
        },
        select: {
            amount: true,
            date: true,
            category: { select: { name: true } }
        },
        orderBy: { date: 'asc' }
    });

    // Agrégation par minute et par catégorie
    const aggregatedByMinute = transactions.reduce((acc, tx) => {
        // --- BUG CORRIGÉ ---
        if (!tx.date || isNaN(new Date(tx.date).getTime())) {
            console.warn(`[AdminAnalytics] Transaction ignorée (ID: ${tx.id}) à cause d'une date invalide.`);
            return acc; // On ignore cette transaction et on passe à la suivante
        }

        const minute = format(new Date(tx.date), 'yyyy-MM-dd HH:mm');
        // --- FIN DE LA CORRECTION ---

        const category = tx.category.name;

        if (!acc[minute]) {
            acc[minute] = {};
        }
        if (!acc[minute][category]) {
            acc[minute][category] = 0;
        }
        acc[minute][category] += parseFloat(tx.amount);

        return acc;
    }, {});

    return Object.values(aggregatedByMinute);
}

module.exports = {
    getKpiMetrics,
    getRevenueData,
};