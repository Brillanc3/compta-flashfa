// backend/src/controllers/analyticsController.js

const prisma = require('../db');
const { TransactionType } = require('@prisma/client');

const getWeekDateRange = (date) => {
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    const day = start.getUTCDay();
    const diff = start.getUTCDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(start.setUTCDate(diff));
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    sunday.setUTCHours(23, 59, 59, 999);
    return { start: monday, end: sunday };
};

const getCompanyAnalytics = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.id, 10);
        const { period = 'week', date = new Date().toISOString() } = request.query;

        let dateRange;
        if (period === 'week') {
            dateRange = getWeekDateRange(new Date(date));
        } else {
            return reply.code(400).send({ message: "La période demandée n'est pas encore supportée." });
        }

        // --- CORRECTION : On fait deux requêtes groupBy séparées ---

        // Requête pour les revenus
        const revenueByDay = await prisma.transaction.groupBy({
            by: ['date'],
            where: {
                companyId: companyId,
                date: { gte: dateRange.start, lte: dateRange.end },
                category: {
                    type: TransactionType.REVENUE,
                }
            },
            _sum: { amount: true },
        });
        // Requête pour les dépenses
        const expenseByDay = await prisma.transaction.groupBy({
            by: ['date'],
            where: {
                companyId: companyId,
                date: { gte: dateRange.start, lte: dateRange.end },
                category: {
                    type: TransactionType.EXPENSE,
                }
            },
            _sum: { amount: true },
        });

        // --- Formatage des données (légèrement adapté) ---
        const labels = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
        const revenueData = new Array(7).fill(0);
        const expenseData = new Array(7).fill(0);

        revenueByDay.forEach(item => {
            // getUTCDay() car nos dates sont en UTC
            const dayOfWeek = (new Date(item.date).getUTCDay() + 6) % 7;
            revenueData[dayOfWeek] += item._sum.amount || 0;
        });

        expenseByDay.forEach(item => {
            const dayOfWeek = (new Date(item.date).getUTCDay() + 6) % 7;
            expenseData[dayOfWeek] += item._sum.amount || 0;
        });

        const totalRevenue = revenueData.reduce((sum, val) => sum + val, 0);
        const totalExpenses = expenseData.reduce((sum, val) => sum + val, 0);

        const response = {
            kpis: {
                totalRevenue,
                totalExpenses,
                netProfit: totalRevenue - totalExpenses,
            },
            timeSeries: {
                labels,
                revenue: revenueData,
                expenses: expenseData,
            },
        };

        reply.send(response);
    } catch (error) {
        console.error("Erreur dans getCompanyAnalytics :", error);
        reply.code(500).send({ message: 'Erreur lors de la récupération des données analytiques.', error: error.message });
    }
};

/**
 * Récupère les données analytiques pour l'utilisateur actuellement connecté
 * au sein d'une entreprise spécifique.
 */
const getUserAnalytics = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.id, 10);
        const userId = request.user.userId;
        const { period = 'week', date = new Date().toISOString() } = request.query;

        let dateRange;
        if (period === 'week') {
            dateRange = getWeekDateRange(new Date(date));
        } else {
            return reply.code(400).send({ message: "La période demandée n'est pas encore supportée." });
        }

        // 1. Calculer le chiffre d'affaires généré par l'utilisateur
        // C'est la somme des montants de toutes les factures dont il est l'auteur.
        const generatedRevenueResult = await prisma.bill.aggregate({
            _sum: { amount: true },
            where: {
                companyId: companyId,
                authorId: userId,
                date: { gte: dateRange.start, lte: dateRange.end },
                NOT: { status: 'cancelled' } // On exclut les factures annulées
            }
        });
        const generatedRevenue = generatedRevenueResult._sum.amount || 0;

        // 2. Le salaire est mis à 0 pour l'instant, comme demandé.
        const salary = 0;

        // On peut ajouter d'autres statistiques utiles, comme le nombre de factures
        const billsCreatedCount = await prisma.bill.count({
            where: {
                companyId: companyId,
                authorId: userId,
                date: { gte: dateRange.start, lte: dateRange.end },
                NOT: { status: 'cancelled' }
            }
        });

        const response = {
            kpis: {
                generatedRevenue,
                salary,
                billsCreatedCount
            }
        };

        reply.send(response);
    } catch (error) {
        console.error("Erreur dans getUserAnalytics :", error);
        reply.code(500).send({ message: 'Erreur lors de la récupération des données analytiques personnelles.', error: error.message });
    }
};

module.exports = {
    getCompanyAnalytics,
    getUserAnalytics
};