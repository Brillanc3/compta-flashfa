// backend/src/controllers/billController.js

const prisma = require('../db');
const { BillType } = require('@prisma/client');
const { hasWildcardPermission } = require('../middleware/auth');


/**
 * Récupère une liste paginée et filtrée de factures pour une entreprise.
 */
const getBills = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.id, 10);
        const userId = request.user.userId;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { roles: { include: { permissions: true } }, permissions: true }
        });
        const userPermissions = new Set();
        user.roles.forEach(r => r.permissions.forEach(p => userPermissions.add(p.action)));
        user.permissions.forEach(p => userPermissions.add(p.action));
        const canViewAll = hasWildcardPermission(userPermissions, `COMPANY.${companyId}.BILLS.VIEW`);
        const canViewSelf = hasWildcardPermission(userPermissions, `COMPANY.${companyId}.BILLS.SELF_VIEW`);
        if (!canViewAll && !canViewSelf) {
            return reply.code(403).send({ message: "Accès interdit." });
        }

        // --- 1. Récupération et nettoyage des paramètres de la requête ---
        const {
            search,
            status,
            minAmount,
            maxAmount,
            startDate,
            endDate,
            page = 1,
            limit = 20,
            sortBy = 'date',
            sortOrder = 'desc',
            config: configString
        } = request.query;

        let config = {};
        if (configString) config = JSON.parse(configString);

        // On détermine le mode de vue : 'ALL' ou 'SELF'
        const viewMode = config.viewMode || 'ALL';

        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 20);
        const skip = (pageNum - 1) * limitNum;

        // --- 2. Construction dynamique de la clause 'where' pour Prisma ---
        const where = {
            companyId: companyId,
        };
        if (viewMode === 'SELF') {
            where.authorId = userId;
        }


        if (status && Object.values(BillType).includes(status)) {
            where.status = status;
        }

        if (minAmount || maxAmount) {
            where.amount = {};
            if (minAmount) where.amount.gte = parseFloat(minAmount);
            if (maxAmount) where.amount.lte = parseFloat(maxAmount);
        }

        if (startDate || endDate) {
            where.date = {};
            if (startDate) where.date.gte = new Date(startDate);
            if (endDate) where.date.lte = new Date(endDate);
        }

        if (search) {
            where.OR = [
                { reason: { contains: search } },
                { issuerName: { contains: search } },
                { recipientName: { contains: search } },
            ];
        }

        // --- 3. Construction de la clause 'orderBy' ---
        const orderBy = {
            [sortBy]: sortOrder,
        };

        // --- 4. Exécution des requêtes ---
        // On exécute deux requêtes en parallèle : une pour le total, une pour les données paginées
        const [totalBills, bills] = await prisma.$transaction([
            prisma.bill.count({ where }),
            prisma.bill.findMany({
                where,
                skip,
                take: limitNum,
                orderBy,
                include: {
                    author: { select: { name: true } } // On inclut le nom de l'auteur
                }
            })
        ]);

        // --- 5. Envoi de la réponse ---
        reply.send({
            data: bills,
            pagination: {
                totalCount: totalBills,
                totalPages: Math.ceil(totalBills / limitNum),
                currentPage: pageNum,
                limit: limitNum,
            }
        });

    } catch (error) {
        console.error("Erreur dans getBills:", error);
        reply.code(500).send({ message: 'Erreur lors de la récupération des factures.', error: error.message });
    }
};

const getBillDetails = async (request, reply) => {
    try {
        const billId = parseInt(request.params.id, 10);
        if (isNaN(billId)) {
            return reply.code(400).send({ message: "ID de facture invalide." });
        }

        const bill = await prisma.bill.findUnique({
            where: { id: billId },
            include: {
                author: { select: { name: true } },
                client: { select: { name: true } },
            },
        });

        if (!bill) {
            return reply.code(404).send({ message: "Facture non trouvée." });
        }

        reply.send(bill);
    } catch (error) {
        request.log.error("Erreur lors de la récupération des détails de la facture:", error);
        reply.code(500).send({ message: "Erreur serveur." });
    }
};

module.exports = {
    getBills,
    getBillDetails
};