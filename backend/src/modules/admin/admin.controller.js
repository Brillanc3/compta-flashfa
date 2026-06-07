// /backend/src/modules/admin/admin.controller.js

const service = require('./admin.service');
const imageService = require('../image/image.service'); // même service que ton module images
const prisma = require('../../db');

const iso = (d) => (d instanceof Date ? d.toISOString() : d ?? null);
const str = (v) => (v == null ? null : String(v));

/* =========================
 * DTO Mappers
 * =======================*/
const mapConversationDTO = (convo, members) => ({
    id: str(convo.id),
    kind: convo.kind,
    companyId: convo.companyId ?? null,
    ticketCategory: convo.ticketCategory ?? null,
    title: convo.title ?? null,
    description: convo.description ?? null,
    members: members || {
        users: convo.membersCache?.users || [],
        roles: convo.membersCache?.roles || [],
        version: typeof convo.membersCacheVersion === 'number' ? convo.membersCacheVersion : 0,
    },
    messageCount: convo.messageCount ?? 0,
    reportCount: convo.reportCount ?? 0,
    createdAt: iso(convo.createdAt),
    updatedAt: iso(convo.updatedAt),
    lastActivityAt: iso(convo.lastActivityAt),
});

const mapMessageDTO = (m) => ({
    id: str(m.id),
    conversationId: str(m.conversationId),
    authorId: m.authorId,
    content: m.content,
    createdAt: iso(m.createdAt),
    reportCount: m.reportCount ?? 0,
});

/**
 * Vérifie l'accès au module Admin.
 * @route GET /admin
 */
const checkAccess = async (request, reply) => {
    try {
        const result = await service.checkAccess();
        reply.send(result);
    } catch (error) {
        console.error('[AdminController] checkAccess:', error);
        reply.code(500).send({ message: 'Erreur interne du module Admin.' });
    }
};

/**
 * Récupère le tableau de bord Support Facturation.
 * @route GET /admin/billing-support-dashboard?week=&year=
 * @param {number} [query.week] - Numéro de semaine ISO (1-53)
 * @param {number} [query.year] - Année (ex: 2025)
 */
const getBillingSupportDashboard = async (request, reply) => {
    try {
        const week = request.query.week ? parseInt(request.query.week, 10) : undefined;
        const year = request.query.year ? parseInt(request.query.year, 10) : undefined;

        const data = await service.getBillingSupportDashboard({ week, year });
        reply.send(data);
    } catch (error) {
        console.error('[AdminController] getBillingSupportDashboard:', error);
        reply.code(500).send({
            message: error.message || "Erreur lors de la récupération du tableau de bord Support Facturation.",
        });
    }
};

// --- Entreprises & utilisateurs (inchangé) ---

const listCompanies = async (request, reply) => {
    try {
        const result = await service.listCompanies(request.query || {});
        reply.send(result);
    } catch (error) {
        console.error('[AdminController] listCompanies:', error);
        reply.code(500).send({ message: 'Erreur lors de la récupération des entreprises.' });
    }
};

const createCompany = async (request, reply) => {
    try {
        const newCompany = await service.createCompany(request.body);
        reply.code(201).send(newCompany);
    } catch (error) {
        console.error('[AdminController] createCompany:', error);
        if (error.code === 'P2002' && error.meta?.target?.includes('name')) {
            reply.code(409).send({ message: 'Une entreprise avec ce nom existe déjà.' });
        } else {
            reply.code(500).send({ message: error.message || "Erreur lors de la création de l'entreprise." });
        }
    }
};

const updateCompany = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.companyId, 10);
        const allowedUpdates = ['name', 'isParentCompany', 'accountingPrice', 'isApiActive', 'apiDeactivationReason', 'groupId'];
        const dataToUpdate = {};
        for (const key of allowedUpdates) {
            if (request.body[key] !== undefined) dataToUpdate[key] = request.body[key];
        }

        // Si on ré-active l’API, on nettoie la raison de désactivation (sauf si explicitement fournie)
        if (dataToUpdate.isApiActive === true && request.body.apiDeactivationReason === undefined) {
            dataToUpdate.apiDeactivationReason = null;
        }
        if (Object.keys(dataToUpdate).length === 0) {
            return reply.code(400).send({ message: 'Aucune donnée valide à mettre à jour.' });
        }
        const updatedCompany = await service.updateCompany(companyId, dataToUpdate);
        reply.send(updatedCompany);
    } catch (error) {
        console.error('[AdminController] updateCompany:', error);
        reply.code(500).send({ message: error.message || "Erreur lors de la mise à jour de l'entreprise." });
    }
};
const deleteCompany = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        if (!Number.isFinite(companyId) || companyId <= 0) {
            return reply.code(400).send({ message: "ID entreprise invalide." });
        }

        const actorUserId = request.user?.id ?? request.user?.userId ?? null;

        await service.deleteCompany(companyId, { actorUserId });
        return reply.code(204).send();
    } catch (error) {
        console.error('[AdminController] deleteCompany:', error);
        const status = error.statusCode || 500;
        return reply.code(status).send({ message: error.message || "Erreur lors de la suppression de l'entreprise." });
    }
};


const assignBillableContact = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.companyId, 10);
        const { userId, isPrio } = request.body || {};
        if (!userId) return reply.code(400).send({ message: "L'ID de l'utilisateur (userId) est requis." });
        await service.assignBillableContact(companyId, parseInt(userId, 10), isPrio);
        reply.code(204).send();
    } catch (error) {
        console.error('[AdminController] assignBillableContact:', error);
        if (error.code === 'P2002') {
            reply.code(409).send({ message: "Cet utilisateur est déjà un contact facturable pour cette entreprise." });
        } else if (error.message.includes('introuvable')) {
            reply.code(404).send({ message: error.message });
        } else {
            reply.code(500).send({ message: error.message || "Erreur lors de l'assignation du contact." });
        }
    }
};

const removeBillableContact = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.companyId, 10);
        const userId = parseInt(request.params.userId, 10);
        await service.removeBillableContact(companyId, userId);
        reply.code(204).send();
    } catch (error) {
        console.error('[AdminController] removeBillableContact:', error);
        if (error.code === 'P2025') {
            reply.code(404).send({ message: "Ce contact facturable n'existe pas." });
        } else {
            reply.code(500).send({ message: error.message || 'Erreur lors du retrait du contact.' });
        }
    }
};

const listUsers = async (request, reply) => {
    try {
        const searchQuery = request.query.search || '';
        const users = await service.listUsers(searchQuery);
        reply.send(users);
    } catch (error) {
        console.error('[AdminController] listUsers:', error);
        reply.code(500).send({ message: 'Erreur lors de la récupération des utilisateurs.' });
    }
};

const notifyIncompleteCompany = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.companyId, 10);
        const senderId = request.user?.userId ?? null;

        const result = await service.sendBlockingNotificationToCompany(
            companyId,
            {
                title: 'Mise à jour de profil requise',
                body: 'Votre profil doit être complété (téléphone, IBAN, Discord ID, Character ID).',
            },
            senderId
        );

        reply.code(200).send({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error('[AdminController] notifyIncompleteCompany:', error);
        reply.code(error.statusCode || 500).send({
            message: error.message || 'Erreur lors de l’envoi de la notification.',
        });
    }
};

/**
 * GET /admin/companies/:companyId/details
 * Détails complets d'une entreprise + filtres
 * @param {Object} request
 * @param {Object} reply
 * Query params supportés:
 * - startDate?: string ISO
 * - endDate?: string ISO
 * - reason?: string
 * - user?: string   // s'applique aux BILLS via author.name (pas aux transactions)
 * - minAmount?: number
 * - maxAmount?: number
 */
const parsePaging = (query = {}, defaults = {}) => {
    const page = Math.max(1, Number.parseInt(query.page ?? defaults.page ?? '1', 10) || 1);
    const pageSizeRaw = Number.parseInt(query.pageSize ?? query.limit ?? defaults.pageSize ?? '25', 10);
    const maxPageSize = Number.parseInt(defaults.maxPageSize ?? '100', 10) || 100;
    const pageSize = Math.min(maxPageSize, Math.max(1, Number.isFinite(pageSizeRaw) ? pageSizeRaw : 25));
    return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
};

const parseDate = (v) => {
    if (!v) return undefined;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d;
};

const parseAmount = (v) => {
    if (v === undefined || v === null || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
};

/**
 * GET /admin/companies/:companyId/details
 * ✅ Retourne un "summary" (léger) — le détail volumineux est désormais servi via endpoints paginés.
 */
const getCompanyDetails = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        if (!Number.isFinite(companyId)) return reply.code(400).send({ message: 'ID entreprise invalide.' });

        const company = await prisma.company.findUnique({
            where: { id: companyId },
            select: {
                id: true,
                name: true,
                onboardingKey: true,
                apiKey: true,
                isApiActive: true,
                apiDeactivationReason: true,
                balance: true,
                accountingPrice: true,
                isParentCompany: true,
                groupId: true,
                accountingSuspendedAt: true,

                activeModules: {
                    select: {
                        companyId: true,
                        moduleId: true,
                        module: { select: { id: true, name: true, description: true } },
                    },
                },

                ranks: { select: { id: true, name: true } },

                // Derniers logs seulement (évite un payload énorme)
                logs: {
                    take: 100,
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true,
                        createdAt: true,
                        message: true,
                        category: true,
                        logType: true,
                        text: true,
                        date: true,
                        data: true,
                        isProcessed: true,
                        processingError: true,
                    },
                },

                _count: {
                    select: {
                        employees: true,
                        clients: true,
                        bills: true,
                        transactions: true,
                        activeModules: true,
                        logs: true,
                    },
                },
            },
        });

        if (!company) return reply.code(404).send({ message: 'Entreprise introuvable.' });

        reply.send({
            ...company,
            stats: {
                totalEmployees: company._count.employees,
                totalClients: company._count.clients,
                totalBills: company._count.bills,
                totalTransactions: company._count.transactions,
                totalModules: company._count.activeModules,
                totalLogs: company._count.logs,
            },
        });
    } catch (error) {
        console.error('[AdminController] getCompanyDetails (summary):', error);
        reply.code(500).send({ message: error.message || "Erreur lors de la récupération du résumé de l’entreprise." });
    }
};

/**
 * GET /admin/companies/:companyId/transactions
 * Query: page, pageSize, startDate, endDate, reason, minAmount, maxAmount, q
 */
const listCompanyTransactions = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        if (!Number.isFinite(companyId)) return reply.code(400).send({ message: 'ID entreprise invalide.' });

        const { page, pageSize, skip, take } = parsePaging(request.query, { page: 1, pageSize: 10, maxPageSize: 100 });

        const startDate = parseDate(request.query?.startDate);
        const endDate = parseDate(request.query?.endDate);
        const reason = typeof request.query?.reason === 'string' ? request.query.reason.trim() : '';
        const q = typeof request.query?.q === 'string' ? request.query.q.trim() : '';

        const minAmount = parseAmount(request.query?.minAmount);
        const maxAmount = parseAmount(request.query?.maxAmount);

        const where = { companyId };

        if (startDate || endDate) {
            where.date = {};
            if (startDate) where.date.gte = startDate;
            if (endDate) where.date.lte = endDate;
        }

        if (reason) where.description = { contains: reason };

        if (Number.isFinite(minAmount) || Number.isFinite(maxAmount)) {
            where.amount = {};
            if (Number.isFinite(minAmount)) where.amount.gte = minAmount;
            if (Number.isFinite(maxAmount)) where.amount.lte = maxAmount;
        }

        if (q) {
            const or = [
                { description: { contains: q } },
                // Relation OPTIONAL: `is` requis
                { bill: { is: { reason: { contains: q } } } },
            ];

            // Recherche numérique safe
            if (/^-?\d+(?:[\.,]\d+)?$/.test(q)) {
                const qNum = Number(q.replace(',', '.'));
                if (Number.isFinite(qNum)) {
                    or.push({ amount: { equals: qNum } });
                }
            }
            if (/^\d+$/.test(q)) {
                const qInt = Number.parseInt(q, 10);
                or.push({ id: qInt });
            }

            where.OR = or;
        }

        const [items, total] = await prisma.$transaction([
            prisma.transaction.findMany({
                where,
                orderBy: { date: 'desc' },
                skip,
                take,
                include: {
                    category: true,
                    bill: {
                        select: {
                            id: true,
                            externalBillId: true,
                            date: true,
                            amount: true,
                            reason: true,
                        },
                    },
                },
            }),
            prisma.transaction.count({ where }),
        ]);

        const totalPages = Math.max(1, Math.ceil(total / pageSize));

        reply.send({
            items,
            total,
            page,
            pageSize,
            totalPages,
            data: items,
            pagination: { totalCount: total, currentPage: page, pageSize, totalPages },
        });
    } catch (error) {
        console.error('[AdminController] listCompanyTransactions:', error);
        reply.code(500).send({ message: error.message || "Erreur lors de la récupération des transactions." });
    }
};

/**
 * GET /admin/companies/:companyId/bills
 * Query: page, pageSize, startDate, endDate, reason, user, minAmount, maxAmount, q
 */
const listCompanyBills = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        if (!Number.isFinite(companyId)) return reply.code(400).send({ message: 'ID entreprise invalide.' });

        const { page, pageSize, skip, take } = parsePaging(request.query, { page: 1, pageSize: 10, maxPageSize: 100 });

        const startDate = parseDate(request.query?.startDate);
        const endDate = parseDate(request.query?.endDate);
        const reason = typeof request.query?.reason === 'string' ? request.query.reason.trim() : '';
        const user = typeof request.query?.user === 'string' ? request.query.user.trim() : '';
        const q = typeof request.query?.q === 'string' ? request.query.q.trim() : '';

        const minAmount = parseAmount(request.query?.minAmount);
        const maxAmount = parseAmount(request.query?.maxAmount);

        const where = { companyId };

        if (startDate || endDate) {
            where.date = {};
            if (startDate) where.date.gte = startDate;
            if (endDate) where.date.lte = endDate;
        }

        if (reason) where.reason = { contains: reason };

        if (Number.isFinite(minAmount) || Number.isFinite(maxAmount)) {
            where.amount = {};
            if (Number.isFinite(minAmount)) where.amount.gte = minAmount;
            if (Number.isFinite(maxAmount)) where.amount.lte = maxAmount;
        }

        if (user) {
            // Relation REQUIRED: pas de `is`
            where.author = { name: { contains: user } };
        }

        if (q) {
            const or = [
                { reason: { contains: q } },
                { issuerName: { contains: q } },
                { recipientName: { contains: q } },
                // author REQUIRED => pas de `is`
                { author: { name: { contains: q } } },
                // client OPTIONAL => `is`
                { client: { is: { name: { contains: q } } } },
            ];

            // Recherche numérique safe (externalBillId / id / amount)
            if (/^\d+$/.test(q)) {
                const qInt = Number.parseInt(q, 10);
                or.push({ externalBillId: qInt });
                or.push({ id: qInt });
            }
            if (/^-?\d+(?:[\.,]\d+)?$/.test(q)) {
                const qNum = Number(q.replace(',', '.'));
                if (Number.isFinite(qNum)) {
                    or.push({ amount: { equals: qNum } });
                }
            }

            where.OR = or;
        }

        const [items, total] = await prisma.$transaction([
            prisma.bill.findMany({
                where,
                orderBy: { date: 'desc' },
                skip,
                take,
                include: {
                    author: { select: { id: true, name: true } },
                    client: true,
                },
            }),
            prisma.bill.count({ where }),
        ]);

        const totalPages = Math.max(1, Math.ceil(total / pageSize));

        reply.send({
            items,
            total,
            page,
            pageSize,
            totalPages,
            data: items,
            pagination: { totalCount: total, currentPage: page, pageSize, totalPages },
        });
    } catch (error) {
        console.error('[AdminController] listCompanyBills:', error);
        reply.code(500).send({ message: error.message || "Erreur lors de la récupération des factures." });
    }
};

/**
 * GET /admin/companies/:companyId/employees
 * Query: page, pageSize, q
 */
const listCompanyEmployees = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        if (!Number.isFinite(companyId)) return reply.code(400).send({ message: 'ID entreprise invalide.' });

        const { page, pageSize, skip, take } = parsePaging(request.query, { page: 1, pageSize: 12, maxPageSize: 100 });
        const q = typeof request.query?.q === 'string' ? request.query.q.trim() : '';

        const where = { companyId };
        if (q) {
            const or = [
                // Relations REQUIRED: pas de `is` (évite mismatch Prisma selon versions)
                { user: { name: { contains: q } } },
                { user: { username: { contains: q } } },
                { user: { discordId: { contains: q } } },
                { rank: { name: { contains: q } } },
            ];

            // Recherche numérique safe (évite `contains` sur Int/Decimal)
            if (/^\d+$/.test(q)) {
                const qInt = Number.parseInt(q, 10);
                or.push({ userId: qInt });
                or.push({ rankId: qInt });
                or.push({ user: { characterId: qInt } });
            }

            where.OR = or;
        }

        const [items, total] = await prisma.$transaction([
            prisma.companyEmployee.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            username: true,
                            phoneNumber: true,
                            iban: true,
                            discordId: true,
                            characterId: true,
                            imageUrl: true,
                        },
                    },
                    rank: { select: { id: true, name: true } },
                },
            }),
            prisma.companyEmployee.count({ where }),
        ]);

        const totalPages = Math.max(1, Math.ceil(total / pageSize));

        reply.send({
            items,
            total,
            page,
            pageSize,
            totalPages,
            data: items,
            pagination: { totalCount: total, currentPage: page, pageSize, totalPages },
        });
    } catch (error) {
        console.error('[AdminController] listCompanyEmployees:', error);
        reply.code(500).send({ message: error.message || "Erreur lors de la récupération des employés." });
    }
};

/**
 * GET /admin/companies/:companyId/clients
 * Query: page, pageSize, q
 */
const listCompanyClients = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        if (!Number.isFinite(companyId)) return reply.code(400).send({ message: 'ID entreprise invalide.' });

        const { page, pageSize, skip, take } = parsePaging(request.query, { page: 1, pageSize: 12, maxPageSize: 100 });
        const q = typeof request.query?.q === 'string' ? request.query.q.trim() : '';

        const where = { companyId };
        if (q) {
            where.name = { contains: q };
        }

        const [items, total] = await prisma.$transaction([
            prisma.client.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take,
            }),
            prisma.client.count({ where }),
        ]);

        const totalPages = Math.max(1, Math.ceil(total / pageSize));

        reply.send({
            items,
            total,
            page,
            pageSize,
            totalPages,
            data: items,
            pagination: { totalCount: total, currentPage: page, pageSize, totalPages },
        });
    } catch (error) {
        console.error('[AdminController] listCompanyClients:', error);
        reply.code(500).send({ message: error.message || "Erreur lors de la récupération des clients." });
    }
};

/**
 * GET /admin/modules
 * Récupère le catalogue de modules
 * @param {Object} request
 * @param {Object} reply
 */


/**
 * GET /admin/companies/:companyId/logs
 * Query: page, pageSize, category, logType, q, dateFrom, dateTo, includeData
 */
const listCompanyLogs = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        if (!Number.isFinite(companyId)) return reply.code(400).send({ message: 'ID entreprise invalide.' });

        const { page, pageSize } = parsePaging(request.query, { page: 1, pageSize: 20, maxPageSize: 100 });

        const category = typeof request.query?.category === 'string' ? request.query.category.trim() : '';
        const logType = typeof request.query?.logType === 'string' ? request.query.logType.trim() : '';
        const q = typeof request.query?.q === 'string' ? request.query.q.trim() : '';
        const dateFrom = parseDate(request.query?.dateFrom);
        const dateTo = parseDate(request.query?.dateTo);

        const includeData = request.query?.includeData === '1' || request.query?.includeData === 'true';

        const result = await service.listCompanyLogs({
            companyId,
            page,
            pageSize,
            filters: { category, logType, q, dateFrom, dateTo, includeData },
        });

        reply.send(result);
    } catch (error) {
        console.error('[AdminController] listCompanyLogs:', error);
        reply.code(500).send({ message: error.message || "Erreur lors de la récupération des logs." });
    }
};

/**
 * Liste globale des logs avec filtres.
 * GET /admin/logs
 */
const listGlobalLogs = async (request, reply) => {
    try {
        const { page, pageSize } = parsePaging(request.query, { page: 1, pageSize: 20, maxPageSize: 100 });
        const companyId = request.query.companyId;
        const category = request.query.category;
        const q = request.query.q;
        const isProcessed = request.query.isProcessed !== undefined ? (request.query.isProcessed === 'true' || request.query.isProcessed === '1') : undefined;

        const result = await service.listGlobalLogs({
            page,
            pageSize,
            filters: { companyId, category, q, isProcessed }
        });

        reply.send(result);
    } catch (error) {
        console.error('[AdminController] listGlobalLogs:', error);
        reply.code(500).send({ message: 'Erreur lors de la récupération des logs globaux.' });
    }
};


/**
 * Force le retraitement d'un log.
 * POST /admin/logs/:logId/retry
 */
const retryLog = async (request, reply) => {
    try {
        const logId = Number(request.params.logId);
        if (!Number.isFinite(logId)) {
            return reply.code(400).send({ message: 'ID log invalide.' });
        }

        const updatedLog = await service.retryLog(logId);
        reply.send(updatedLog);
    } catch (error) {
        console.error('[AdminController] retryLog:', error);
        reply.code(error.statusCode || 500).send({
            message: error.message || 'Erreur lors de la relance du log.',
        });
    }
};

/**
 * Récupère les stats globales des logs.
 * GET /admin/logs/stats
 */
const getLogsStats = async (request, reply) => {
    try {
        const { companyId, category } = request.query;
        const stats = await service.getLogsStats({ companyId, category });
        reply.send(stats);
    } catch (error) {
        console.error('[AdminController] getLogsStats:', error);
        reply.code(500).send({ message: 'Erreur lors de la récupération des statistiques logs.' });
    }
};

/**
 * Relance tous les logs en échec (avec filtres optionnels).
 * POST /admin/logs/retry-all
 * Body: { companyId, category }
 */
const retryAllFailedLogs = async (request, reply) => {
    try {
        const filters = request.body || {};
        const result = await service.retryAllFailedLogs(filters, request.user.id);
        reply.send(result);
    } catch (error) {
        console.error('[AdminController] retryAllFailedLogs:', error);
        reply.code(500).send({ message: 'Erreur lors de la relance massive des logs.' });
    }
};

/**
 * Liste basique des entreprises (ID + Nom) pour les filtres.
 * GET /admin/companies/basic
 */
const listCompaniesBasic = async (request, reply) => {
    try {
        const companies = await service.listCompaniesBasic();
        reply.send(companies);
    } catch (error) {
        console.error('[AdminController] listCompaniesBasic:', error);
        reply.code(500).send({ message: 'Erreur lors de la récupération de la liste des entreprises.' });
    }
};

/**
 * Rangs (CRUD admin)
 */
const listCompanyRanks = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        const data = await service.getCompanyRanks(companyId);
        reply.send(data);
    } catch (error) {
        console.error('[AdminController] listCompanyRanks:', error);
        reply.code(500).send({ message: error.message || "Erreur lors de la récupération des rangs." });
    }
};

const createCompanyRank = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        const actorUserId = request.user?.id ?? request.user?.userId ?? request.user;
        const data = await service.createCompanyRank({ companyId, payload: request.body, actorUserId });
        reply.send(data);
    } catch (error) {
        console.error('[AdminController] createCompanyRank:', error);
        reply.code(400).send({ message: error.message || "Erreur lors de la création du rang." });
    }
};

const updateCompanyRank = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        const rankId = Number(request.params.rankId);
        const actorUserId = request.user?.id ?? request.user?.userId ?? request.user;
        const data = await service.updateCompanyRank({ companyId, rankId, payload: request.body, actorUserId });
        reply.send(data);
    } catch (error) {
        console.error('[AdminController] updateCompanyRank:', error);
        reply.code(400).send({ message: error.message || "Erreur lors de la mise à jour du rang." });
    }
};

const deleteCompanyRank = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        const rankId = Number(request.params.rankId);
        const actorUserId = request.user?.id ?? request.user?.userId ?? request.user;
        const data = await service.deleteCompanyRank({ companyId, rankId, actorUserId });
        reply.send(data);
    } catch (error) {
        console.error('[AdminController] deleteCompanyRank:', error);
        reply.code(400).send({ message: error.message || "Erreur lors de la suppression du rang." });
    }
};

const updateCompanyRankOrder = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        const actorUserId = request.user?.id ?? request.user?.userId ?? request.user;
        const order = request.body;
        const data = await service.updateCompanyRankOrder({ companyId, order, actorUserId });
        reply.send(data);
    } catch (error) {
        console.error('[AdminController] updateCompanyRankOrder:', error);
        reply.code(400).send({ message: error.message || "Erreur lors de la réorganisation des rangs." });
    }
};

const listPermissionTemplates = async (request, reply) => {
    try {
        reply.send(await service.listPermissionTemplates());
    } catch (error) {
        console.error('[AdminController] listPermissionTemplates:', error);
        reply.code(500).send({ message: error.message || "Erreur lors de la récupération des permissions." });
    }
};

/**
 * Employés (actions admin)
 */
const resetEmployeeAccountAdmin = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        const employeeId = Number(request.params.employeeId);
        const actorUserId = request.user?.id ?? request.user?.userId ?? request.user;
        const data = await service.resetEmployeeAccountAdmin({ companyId, employeeId, actorUserId });
        reply.send(data);
    } catch (error) {
        console.error('[AdminController] resetEmployeeAccountAdmin:', error);
        reply.code(error.status || 400).send({ message: error.message || "Erreur reset compte." });
    }
};

const updateEmployeeUserProfileAdmin = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        const employeeId = Number(request.params.employeeId);
        const data = await service.updateEmployeeUserProfileAdmin({ companyId, employeeId, payload: request.body });
        reply.send(data);
    } catch (error) {
        console.error('[AdminController] updateEmployeeUserProfileAdmin:', error);
        reply.code(400).send({ message: error.message || "Erreur mise à jour employé." });
    }
};

/**
 * Factures / Transactions (actions admin)
 */
const updateBillStatusAdmin = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        const billId = Number(request.params.billId);
        const { status } = request.body || {};
        if (!status) return reply.code(400).send({ message: 'status requis.' });
        const actorUserId = request.user?.id ?? request.user?.userId ?? request.user;
        const data = await service.updateBillStatus({ companyId, billId, status: String(status), actorUserId });
        reply.send(data);
    } catch (error) {
        console.error('[AdminController] updateBillStatusAdmin:', error);
        reply.code(400).send({ message: error.message || "Erreur mise à jour statut facture." });
    }
};

const updateTransactionCategoryAdmin = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        const transactionId = Number(request.params.transactionId);
        const { categoryId } = request.body || {};
        if (!categoryId) return reply.code(400).send({ message: 'categoryId requis.' });
        const data = await service.updateTransactionCategoryAdmin({ companyId, transactionId, categoryId: Number(categoryId) });
        reply.send(data);
    } catch (error) {
        console.error('[AdminController] updateTransactionCategoryAdmin:', error);
        reply.code(400).send({ message: error.message || "Erreur mise à jour catégorie transaction." });
    }
};

/**
 * Clients (actions admin)
 */
const createClientAdmin = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        const data = await service.createClientAdmin({ companyId, payload: request.body });
        reply.code(201).send(data);
    } catch (error) {
        console.error('[AdminController] createClientAdmin:', error);
        reply.code(400).send({ message: error.message || "Erreur création client." });
    }
};

const updateClientAdmin = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        const clientId = Number(request.params.clientId);
        const data = await service.updateClientAdmin({ companyId, clientId, payload: request.body });
        reply.send(data);
    } catch (error) {
        console.error('[AdminController] updateClientAdmin:', error);
        reply.code(400).send({ message: error.message || "Erreur mise à jour client." });
    }
};

const deleteClientAdmin = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        const clientId = Number(request.params.clientId);
        const data = await service.deleteClientAdmin({ companyId, clientId });
        reply.send(data);
    } catch (error) {
        console.error('[AdminController] deleteClientAdmin:', error);
        reply.code(400).send({ message: error.message || "Erreur suppression client." });
    }
};

/**
 * Contacts facturables (liste)
 */
const listBillableContacts = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        reply.send(await service.listBillableContacts(companyId));
    } catch (error) {
        console.error('[AdminController] listBillableContacts:', error);
        reply.code(500).send({ message: error.message || "Erreur lors du chargement des contacts facturables." });
    }
};


/**
 * Contacts facturables (priorité)
 * Body: { isPrio: boolean }
 */
const setBillableContactPrio = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        const userId = Number(request.params.userId);
        const { isPrio } = request.body || {};

        if (!Number.isFinite(companyId) || !Number.isFinite(userId)) {
            return reply.code(400).send({ message: "companyId et userId invalides." });
        }
        if (typeof isPrio !== 'boolean') {
            return reply.code(400).send({ message: "Le champ isPrio (boolean) est requis." });
        }

        const updated = await service.setBillableContactPrio(companyId, userId, isPrio);
        reply.send(updated);
    } catch (error) {
        console.error('[AdminController] setBillableContactPrio:', error);
        reply.code(400).send({ message: error.message || "Erreur lors de la mise à jour du contact prioritaire." });
    }
};

const getAllModules = async (request, reply) => {
    try {
        const data = await service.getAllModules();
        reply.send(data);
    } catch (error) {
        console.error('[AdminController] getAllModules:', error);
        reply.code(500).send({ message: 'Erreur lors de la récupération des modules.' });
    }
};

/**
 * POST /admin/companies/:companyId/modules/assign
 * Attribue un ou plusieurs modules à une entreprise
 * @param {Object} request - { params: {companyId:number}, body: { moduleIds:number[] } }
 * @param {Object} reply
 */
const assignCompanyModules = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        const { moduleIds } = request.body || {};
        if (!companyId || !Array.isArray(moduleIds) || moduleIds.length === 0) {
            return reply.code(400).send({ message: "'moduleIds' doit être un tableau non vide." });
        }
        const updated = await service.assignCompanyModules(companyId, moduleIds.map(Number));
        reply.send(updated);
    } catch (error) {
        console.error('[AdminController] assignCompanyModules:', error);
        reply.code(400).send({ message: error.message || "Erreur lors de l'attribution des modules." });
    }
};

/**
 * POST /admin/companies/:companyId/modules/remove
 * Retire un module d’une entreprise
 * @param {Object} request - { params: {companyId:number}, body: { moduleId:number } }
 * @param {Object} reply
 */
const removeCompanyModule = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        const { moduleId } = request.body || {};
        if (!companyId || !Number.isFinite(+moduleId)) {
            return reply.code(400).send({ message: "'moduleId' requis." });
        }
        const updated = await service.removeCompanyModule(companyId, Number(moduleId));
        reply.send(updated);
    } catch (error) {
        console.error('[AdminController] removeCompanyModule:', error);
        reply.code(400).send({ message: error.message || "Erreur lors du retrait du module." });
    }
};

/**
 * PATCH /admin/companies/:companyId/onboarding-key
 * Régénère ou définit la clé d’onboarding d’une entreprise.
 */
const updateOnboardingKey = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        const { key } = request.body || {};
        const updated = await service.updateOnboardingKey(companyId, key);
        reply.send(updated);
    } catch (error) {
        console.error('[AdminController] updateOnboardingKey:', error);
        reply.code(500).send({ message: error.message || "Erreur lors de la mise à jour de la clé d’onboarding." });
    }
};

/**
 * PATCH /admin/companies/:companyId/api-key
 * Régénère ou définit la clé API d’une entreprise.
 */
const updateApiKey = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        const { key } = request.body || {};
        const updated = await service.updateApiKey(companyId, key);
        reply.send(updated);
    } catch (error) {
        console.error('[AdminController] updateApiKey:', error);
        reply.code(500).send({ message: error.message || "Erreur lors de la mise à jour de la clé API." });
    }
};

/**
 * GET /admin/companies/:companyId/permissions/full
 * Retourne la permission "COMPANY.${companyId}.*" si elle existe (la crée si ?=ensure param).
 * Query: ensure?=true pour la créer si absente (pratique côté UI).
 */
const getCompanyFullPermission = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        const ensure = String(request.query?.ensure || '').toLowerCase() === 'true';
        const data = ensure
            ? await service.ensureCompanyFullPermission(companyId)
            : await service.getCompanyFullPermission(companyId);
        reply.send(data || null);
    } catch (e) {
        reply.code(400).send({ message: e.message || 'Erreur permission Full Entreprise.' });
    }
};

/**
 * POST /admin/companies/:companyId/permissions/full/assign
 * Attribue la permission full entreprise à un utilisateur.
 * Body: { userId: number }
 */
const assignCompanyFullPermission = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        const userId = Number(request.body?.userId);
        if (!userId) return reply.code(400).send({ message: "'userId' requis." });
        const res = await service.grantCompanyFullPermissionToUser(userId, companyId);
        reply.send(res);
    } catch (e) {
        reply.code(400).send({ message: e.message || "Erreur d'attribution de la permission full." });
    }
};

/**
 * POST /admin/companies/:companyId/permissions/full/revoke
 * Retire la permission full entreprise à un utilisateur.
 * Body: { userId: number }
 */
const revokeCompanyFullPermission = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        const userId = Number(request.body?.userId);
        if (!userId) return reply.code(400).send({ message: "'userId' requis." });
        const res = await service.revokeCompanyFullPermissionFromUser(userId, companyId);
        reply.send(res);
    } catch (e) {
        reply.code(400).send({ message: e.message || "Erreur de révocation de la permission full." });
    }
};

const setCompanyKnown = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        const { known } = request.body || {};
        if (!Number.isFinite(companyId)) return reply.code(400).send({ message: 'ID entreprise invalide.' });
        if (typeof known !== 'boolean') return reply.code(400).send({ message: "'known' doit être un booléen." });
        reply.send(await service.setCompanyKnown(companyId, known));
    } catch (e) {
        reply.code(400).send({ message: e.message || "Erreur lors de la mise à jour 'known'." });
    }
};

// --- FULL USERS (COMPANY.{id}.*) ---
const listCompanyFullUsers = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        const q = String(request.query?.q || '');
        const rows = await service.listCompanyFullUsers(companyId, q);
        reply.send(rows);
    } catch (e) {
        console.error('[AdminController] listCompanyFullUsers:', e);
        reply.code(400).send({ message: e.message || 'Erreur recherche FULL users.' });
    }
};

// --- EMPLOYÉ: profil admin ---
const getEmployeeAdminProfile = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        const employeeId = Number(request.params.employeeId);
        const data = await service.getEmployeeAdminProfile(companyId, employeeId);
        reply.send(data);
    } catch (e) {
        console.error('[AdminController] getEmployeeAdminProfile:', e);
        reply.code(400).send({ message: e.message || 'Erreur profil admin employé.' });
    }
};

// --- USER AVATAR (multipart) ---
const uploadUserAvatarByAdmin = async (request, reply) => {
    try {
        if (!request.isMultipart()) {
            return reply.code(400).send({ message: 'Requête invalide: multipart/form-data requis.' });
        }
        const companyId = Number.parseInt(request.params.companyId, 10);
        const userId = Number.parseInt(request.params.userId, 10);
        const fileData = await request.file();

        const { imageUrl } = await service.saveUserAvatar(companyId, userId, fileData);
        reply.code(200).send({ message: 'Image de profil mise à jour.', imageUrl });
    } catch (error) {
        console.error('[AdminController] uploadUserAvatarByAdmin:', error);
        reply.code(400).send({ message: error.message || 'Erreur lors de la mise à jour de l’avatar.' });
    }
};


const uploadUserAvatar = async (request, reply) => {
    try {
        const userId = Number(request.params.userId);
        if (!request.isMultipart()) {
            return reply.code(400).send({ message: 'Requête multipart attendue.' });
        }
        const file = await request.file(); // nécessite fastify-multipart
        if (!file) return reply.code(400).send({ message: 'Fichier manquant.' });

        const chunks = [];
        for await (const c of file.file) chunks.push(c);
        const buffer = Buffer.concat(chunks);
        const saved = await service.saveUserAvatar(userId, buffer, file.filename);

        reply.send(saved);
    } catch (e) {
        console.error('[AdminController] uploadUserAvatar:', e);
        reply.code(400).send({ message: e.message || 'Échec upload avatar.' });
    }
};

// --- EMPLOYÉ: statut ---
const setEmployeeStatus = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        const employeeId = Number(request.params.employeeId);
        const { status } = request.body || {};
        if (!status) return reply.code(400).send({ message: 'status requis.' });
        reply.send(await service.setEmployeeStatus(companyId, employeeId, String(status)));
    } catch (e) {
        console.error('[AdminController] setEmployeeStatus:', e);
        reply.code(400).send({ message: e.message || 'Échec mise à jour statut.' });
    }
};

// --- EMPLOYÉ: assign / remove rang ---
const assignEmployeeRank = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        const employeeId = Number(request.params.employeeId);
        const { rankId } = request.body || {};
        if (!rankId) return reply.code(400).send({ message: 'rankId requis.' });
        reply.send(await service.assignEmployeeRank(companyId, employeeId, Number(rankId)));
    } catch (e) {
        console.error('[AdminController] assignEmployeeRank:', e);
        reply.code(400).send({ message: e.message || 'Échec assign rang.' });
    }
};

const removeEmployeeRank = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        const employeeId = Number(request.params.employeeId);
        const rankId = Number(request.params.rankId);
        reply.send(await service.removeEmployeeRank(companyId, employeeId, rankId));
    } catch (e) {
        console.error('[AdminController] removeEmployeeRank:', e);
        reply.code(400).send({ message: e.message || 'Échec retrait rang.' });
    }
};

// --- EMPLOYÉ: ajout historique rang ---
const addEmployeeRankHistory = async (request, reply) => {
    try {
        const companyId = Number(request.params.companyId);
        const employeeId = Number(request.params.employeeId);
        const { rankId, note } = request.body || {};
        if (!rankId) return reply.code(400).send({ message: 'rankId requis.' });
        reply.send(await service.addEmployeeRankHistory(companyId, employeeId, Number(rankId), note || ''));
    } catch (e) {
        console.error('[AdminController] addEmployeeRankHistory:', e);
        reply.code(400).send({ message: e.message || 'Échec ajout historique.' });
    }
};

/* ===============================================================
   🏢 Conversations
   =============================================================== */
async function listCompanyConversations(request, reply) {
    try {
        const { companyId } = request.params;
        const { page, pageSize, search } = request.query;

        const res = await service.listCompanyConversations(companyId, { page, pageSize, search });

        reply.send({
            items: res.items.map(mapConversationDTO),
            page: res.page,
            pageSize: res.pageSize,
            total: res.total,
            totalPages: res.totalPages,
        });
    } catch (e) {
        console.error('Erreur listCompanyConversations (admin):', e);
        reply.code(e.statusCode || 500).send({
            message: e.message || 'Erreur lors du chargement des conversations.',
        });
    }
}


async function listConversationMessages(request, reply) {
    try {
        const { conversationId } = request.params;
        const { page, pageSize } = request.query;

        const res = await service.listConversationMessages(conversationId, { page, pageSize });

        reply.send({
            items: res.items.map(mapMessageDTO),
            page: res.page,
            pageSize: res.pageSize,
            total: res.total,
            totalPages: res.totalPages,
        });
    } catch (e) {
        console.error('Erreur listConversationMessages (admin):', e);
        reply.code(e.statusCode || 500).send({
            message: e.message || 'Erreur lors du chargement des messages.',
        });
    }
}

/* ===============================================================
   💬 Messages
   =============================================================== */
async function editMessage(request, reply) {
    try {
        const { messageId } = request.params;
        const { content } = request.body;
        const adminUserId = request.user.userId;

        const updated = await service.editMessage(messageId, content, adminUserId);
        reply.send(updated);
    } catch (error) {
        console.error('Erreur editMessage:', error);
        reply.code(500).send({ message: 'Erreur lors de la modification du message.' });
    }
}

async function deleteMessage(request, reply) {
    try {
        const { messageId } = request.params;

        const result = await service.deleteMessage(messageId);
        reply.send(result);
    } catch (error) {
        console.error('Erreur deleteMessage:', error);
        reply.code(500).send({ message: 'Erreur lors de la suppression du message.' });
    }
}

async function sendSystemMessage(request, reply) {
    try {
        const { conversationId } = request.params;
        const { content } = request.body;
        const adminUserId = request.user.userId;

        const msg = await service.sendSystemMessage(conversationId, content, adminUserId);
        reply.send(msg);
    } catch (error) {
        console.error('Erreur sendSystemMessage:', error);
        reply.code(500).send({ message: 'Erreur lors de l’envoi du message système.' });
    }
}

/* ===============================================================
   👥 Membres (utilisateurs / rôles)
   =============================================================== */
async function addMember(request, reply) {
    try {
        const { conversationId } = request.params;
        const { userId, roleId } = request.body;
        const invitedById = request.user.userId;

        const result = await service.addMember(conversationId, { userId, roleId, invitedById });
        reply.send(result);
    } catch (error) {
        console.error('Erreur addMember:', error);
        reply.code(500).send({ message: 'Erreur lors de l’ajout du membre.' });
    }
}

async function removeMember(request, reply) {
    try {
        const { conversationId } = request.params;
        const { userId, roleId } = request.body;

        const result = await service.removeMember(conversationId, { userId, roleId });
        reply.send(result);
    } catch (error) {
        console.error('Erreur removeMember:', error);
        reply.code(500).send({ message: 'Erreur lors du retrait du membre.' });
    }
}

/* ===============================================================
   🔒 FULL ACCESS
   =============================================================== */
async function setCompanyFullAccess(request, reply) {
    try {
        const { companyId, userId } = request.params;
        const { enabled } = request.body;

        const result = await service.setCompanyFullAccess(companyId, userId, enabled);
        reply.send(result);
    } catch (error) {
        console.error('Erreur setCompanyFullAccess:', error);
        reply.code(500).send({ message: 'Erreur lors de la mise à jour du FULL ACCESS pour la société.' });
    }
}

/* ===============================================================
   💵 Factures d’un employé
   =============================================================== */
async function listEmployeeBills(request, reply) {
    try {
        const { employeeId } = request.params;
        const { page, pageSize } = request.query;

        const data = await service.listEmployeeBills(employeeId, { page, pageSize });
        reply.send(data);
    } catch (error) {
        console.error('Erreur listEmployeeBills:', error);
        reply.code(500).send({ message: 'Erreur lors du chargement des factures de l’employé.' });
    }
}

/**
 * PATCH /admin/companies/:companyId/accounting-price
 * Body: { accountingPrice: number }
 */
const updateCompanyAccountingPrice = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.companyId, 10);
        const accountingPrice = Number(request.body?.accountingPrice);

        if (!Number.isInteger(companyId) || companyId <= 0) {
            return reply.code(400).send({ message: "ID entreprise invalide." });
        }
        if (!Number.isFinite(accountingPrice) || accountingPrice < 0) {
            return reply.code(400).send({ message: "accountingPrice doit être un nombre >= 0." });
        }

        const updated = await service.updateCompanyAccountingPrice(companyId, accountingPrice);
        return reply.code(200).send({ success: true, company: updated });
    } catch (error) {
        console.error("[AdminController] updateCompanyAccountingPrice:", error);
        return reply.code(error.statusCode || 500).send({ message: error.message || "Erreur lors de la mise à jour du prix compta." });
    }
};

/**
 * PATCH /admin/bills/:billId/accounting-routing
 * Params: billId = externalBillId
 * Body: { accountingTargetCompanyId: number, accountingNotifyUserId: number }
 */
const setBillAccountingRouting = async (request, reply) => {
    try {
        const billId = parseInt(request.params.billId, 10); // externalBillId
        const accountingTargetCompanyId = Number(request.body?.accountingTargetCompanyId);
        const accountingNotifyUserId = Number(request.body?.accountingNotifyUserId);

        if (!Number.isInteger(billId) || billId <= 0) {
            return reply.code(400).send({ message: "billId invalide (externalBillId attendu)." });
        }
        if (!Number.isFinite(accountingTargetCompanyId) || accountingTargetCompanyId <= 0) {
            return reply.code(400).send({ message: "accountingTargetCompanyId invalide." });
        }
        if (!Number.isFinite(accountingNotifyUserId) || accountingNotifyUserId <= 0) {
            return reply.code(400).send({ message: "accountingNotifyUserId invalide." });
        }

        const updated = await service.setBillAccountingRouting(billId, {
            accountingTargetCompanyId: Math.trunc(accountingTargetCompanyId),
            accountingNotifyUserId: Math.trunc(accountingNotifyUserId),
        });

        return reply.code(200).send({ success: true, bill: updated });
    } catch (error) {
        console.error("[AdminController] setBillAccountingRouting:", error);
        return reply.code(error.statusCode || 500).send({ message: error.message || "Erreur lors du routage de la facture compta." });
    }
};

/**
 * POST /admin/bills/:billId/accounting/issue
 * Params: billId = externalBillId
 */
const issueAccountingBill = async (request, reply) => {
    try {
        const billId = parseInt(request.params.billId, 10); // externalBillId
        const senderId = request.user?.userId ?? null;

        if (!Number.isInteger(billId) || billId <= 0) {
            return reply.code(400).send({ message: "billId invalide (externalBillId attendu)." });
        }

        const result = await service.issueAccountingBill(billId, { senderId });
        return reply.code(200).send({ success: true, ...result });
    } catch (error) {
        console.error("[AdminController] issueAccountingBill:", error);
        return reply.code(error.statusCode || 500).send({ message: error.message || "Erreur lors de l’émission de la facture compta." });
    }
};

/**
 * Custom Services
 */
const listCustomServices = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.companyId, 10);
        const services = await service.listCustomServices(companyId);
        reply.send(services);
    } catch (error) {
        console.error('[AdminController] listCustomServices:', error);
        reply.code(500).send({ message: error.message || 'Erreur lors de la récupération des services.' });
    }
};

const createCustomService = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.companyId, 10);
        const newService = await service.createCustomService(companyId, request.body);
        reply.code(201).send(newService);
    } catch (error) {
        console.error('[AdminController] createCustomService:', error);
        reply.code(500).send({ message: error.message || 'Erreur lors de la création du service.' });
    }
};

const updateCustomService = async (request, reply) => {
    try {
        const serviceId = parseInt(request.params.serviceId, 10);
        const updatedService = await service.updateCustomService(serviceId, request.body);
        reply.send(updatedService);
    } catch (error) {
        console.error('[AdminController] updateCustomService:', error);
        reply.code(500).send({ message: error.message || 'Erreur lors de la mise à jour du service.' });
    }
};

const deleteCustomService = async (request, reply) => {
    try {
        const serviceId = parseInt(request.params.serviceId, 10);
        await service.deleteCustomService(serviceId);
        reply.code(204).send();
    } catch (error) {
        console.error('[AdminController] deleteCustomService:', error);
        reply.code(500).send({ message: error.message || 'Erreur lors de la suppression du service.' });
    }
};

module.exports = {
    checkAccess,
    getBillingSupportDashboard,
    listCompanies,
    createCompany,
    updateCompany,
    deleteCompany,
    assignBillableContact,
    removeBillableContact,
    listUsers,
    notifyIncompleteCompany,
    getCompanyDetails,
    listCompanyTransactions,
    listCompanyBills,
    listCompanyEmployees,
    listCompanyClients,
    getAllModules,
    assignCompanyModules,
    removeCompanyModule,
    updateOnboardingKey,
    updateApiKey,
    getCompanyFullPermission,
    assignCompanyFullPermission,
    revokeCompanyFullPermission,
    setCompanyKnown,
    // Admin page
    listCompanyFullUsers,
    getEmployeeAdminProfile,
    uploadUserAvatar,
    setEmployeeStatus,
    assignEmployeeRank,
    removeEmployeeRank,
    addEmployeeRankHistory,
    uploadUserAvatarByAdmin,
    listCompanyConversations,
    listConversationMessages,
    editMessage,
    deleteMessage,
    sendSystemMessage,
    addMember,
    removeMember,
    setCompanyFullAccess,
    listEmployeeBills,
    updateCompanyAccountingPrice,
    setBillAccountingRouting,
    issueAccountingBill,
    listCompanyLogs,
    listGlobalLogs,
    retryLog,
    getLogsStats,
    retryAllFailedLogs,
    listCompaniesBasic,
    listCompanyRanks,
    createCompanyRank,
    updateCompanyRank,
    deleteCompanyRank,
    updateCompanyRankOrder,
    listPermissionTemplates,
    resetEmployeeAccountAdmin,
    updateEmployeeUserProfileAdmin,
    updateBillStatusAdmin,
    updateTransactionCategoryAdmin,
    createClientAdmin,
    updateClientAdmin,
    deleteClientAdmin,
    setBillableContactPrio,
    listBillableContacts,
    listCustomServices,
    createCustomService,
    updateCustomService,
    deleteCustomService,

    // Announcements
    listAnnouncements,
    getActiveAnnouncement,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,

    // Suspension comptabilité
    setAccountingSuspension,

    // CSV Injection
    injectCsv,
    cancelInjection,
    listInjectedTransactions,
    bulkCancelInjections,
};

/* =============================================================================
 * Announcements
 * ========================================================================== */

async function listAnnouncements(request, reply) {
    try {
        const data = await service.listAnnouncements();
        reply.send(data);
    } catch (err) {
        console.error('[AdminController] listAnnouncements:', err);
        reply.code(500).send({ message: 'Erreur interne.' });
    }
}

async function getActiveAnnouncement(request, reply) {
    try {
        const data = await service.getActiveAnnouncement();
        reply.send(data ?? null);
    } catch (err) {
        console.error('[AdminController] getActiveAnnouncement:', err);
        reply.code(500).send({ message: 'Erreur interne.' });
    }
}

async function createAnnouncement(request, reply) {
    try {
        const data = await service.createAnnouncement(request.user.userId, request.body);
        reply.code(201).send(data);
    } catch (err) {
        console.error('[AdminController] createAnnouncement:', err);
        reply.code(500).send({ message: 'Erreur interne.' });
    }
}

async function updateAnnouncement(request, reply) {
    try {
        const { id } = request.params;
        const data = await service.updateAnnouncement(id, request.body);
        reply.send(data);
    } catch (err) {
        console.error('[AdminController] updateAnnouncement:', err);
        reply.code(500).send({ message: 'Erreur interne.' });
    }
}

async function deleteAnnouncement(request, reply) {
    try {
        const { id } = request.params;
        await service.deleteAnnouncement(id);
        reply.code(204).send();
    } catch (err) {
        console.error('[AdminController] deleteAnnouncement:', err);
        reply.code(500).send({ message: 'Erreur interne.' });
    }
}

async function setAccountingSuspension(request, reply) {
    try {
        const { companyId } = request.params;
        const { suspendedAt } = request.body;
        const result = await service.setAccountingSuspension(companyId, suspendedAt ?? null);
        reply.send(result);
    } catch (err) {
        console.error('[AdminController] setAccountingSuspension:', err);
        reply.code(400).send({ message: err.message || 'Erreur lors de la mise à jour de la suspension.' });
    }
}

/* =============================================================================
 * CSV Injection
 * ========================================================================== */

async function injectCsv(request, reply) {
    try {
        const { companyId } = request.params;
        const { csvData, companyAccount, action, items } = request.body;

        if (action === 'PARSE') {
            const results = await service.processCsvInjection(companyId, csvData, companyAccount);
            return reply.send(results);
        }

        if (action === 'INJECT') {
            const results = [];
            for (const item of items) {
                try {
                    const tx = await service.injectCsvLine(companyId, item, companyAccount);
                    results.push({ ...item, status: 'INJECTÉ', id: tx.id });
                } catch (e) {
                    results.push({ ...item, status: 'ERREUR', error: e.message });
                }
            }
            return reply.send(results);
        }

        reply.code(400).send({ message: 'Action invalide.' });
    } catch (error) {
        console.error('[AdminController] injectCsv:', error);
        reply.code(500).send({ message: error.message || "Erreur lors de l'injection CSV." });
    }
}

async function cancelInjection(request, reply) {
    try {
        const { companyId } = request.params;
        const { transactionId } = request.body;

        await service.cancelInjection(companyId, transactionId);
        reply.send({ success: true });
    } catch (error) {
        console.error('[AdminController] cancelInjection:', error);
        reply.code(500).send({ message: error.message || "Erreur lors de l'annulation de l'injection." });
    }
}

async function listInjectedTransactions(request, reply) {
    try {
        const { companyId } = request.params;
        const transactions = await service.listInjectedTransactions(companyId);
        reply.send(transactions);
    } catch (error) {
        console.error('[AdminController] listInjectedTransactions:', error);
        reply.code(500).send({ message: error.message || "Erreur lors de la récupération des transactions injectées." });
    }
}

async function bulkCancelInjections(request, reply) {
    try {
        const { companyId } = request.params;
        const { transactionIds } = request.body;

        const result = await service.bulkCancelInjections(companyId, transactionIds);
        reply.send({ success: true, count: result.count });
    } catch (error) {
        console.error('[AdminController] bulkCancelInjections:', error);
        reply.code(500).send({ message: error.message || "Erreur lors de la suppression groupée." });
    }
}