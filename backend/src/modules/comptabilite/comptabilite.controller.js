// /backend/src/modules/comptabilite/comptabilite.controller.js
const service = require('./comptabilite.service');

// --- Contrôleurs pour les Factures ---

const getBills = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const userId = request.user.userId;

        const result = await service.getBills(companyId, userId, request.query, request.billViewMode);

        reply.send(result);
    } catch (error) {
        reply.code(500).send({ message: error.message });
    }
};

const getBillDetails = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const billId = parseInt(request.params.billId, 10);
        const bill = await service.getBillDetails(billId, companyId);
        reply.send(bill);
    } catch (error) {
        reply.code(404).send({ message: error.message });
    }
};

// --- Contrôleurs pour les Transactions ---

const getJournal = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const { weekParams, filters, page = 1, pageSize = 15 } = request.body;
        if (!weekParams?.year || !weekParams?.week) {
            return reply.code(400).send({ message: "Les paramètres weekParams (year, week) sont requis." });
        }
        const result = await service.getJournalTransactions(companyId, weekParams, filters || {}, page, pageSize);
        reply.send(result);
    } catch (error) {
        reply.code(500).send({ message: "Erreur serveur lors de la récupération du journal." });
    }
};

/**
 * Contrôleur pour récupérer les catégories de transaction.
 */
const getTransactionCategories = async (request, reply) => {
    try {
        const categories = await service.getTransactionCategories();
        reply.send(categories);
    } catch (error) {
        reply.code(500).send({ message: "Erreur lors de la récupération des catégories de transaction." });
    }
};

const getSummary = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const { weekParams, filters } = request.body;
        if (!weekParams?.year || !weekParams?.week) {
            return reply.code(400).send({ message: "Les paramètres weekParams (year, week) sont requis." });
        }
        const summary = await service.getJournalSummary(companyId, weekParams, filters || {});

        reply.send(summary);
    } catch (error) {
        reply.code(500).send({ message: "Erreur serveur lors de la récupération du résumé." });
    }
};

const updateCategory = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const transactionId = parseInt(request.params.transactionId, 10);
        const { categoryId } = request.body;
        if (!categoryId) return reply.code(400).send({ message: "categoryId est requis." });
        const updatedTransaction = await service.updateTransactionCategory(transactionId, categoryId, companyId);
        reply.send(updatedTransaction);
    } catch (error) {
        reply.code(400).send({ message: error.message });
    }
};

/**
 * Contrôleur pour générer la déclaration fiscale.
 */
const getTaxDeclaration = async (request, reply) => {
    try {
        const companyId = request.headers['x-company-id'];
        const { year, week } = request.query;

        if (!year || !week) {
            return reply.code(400).send({ message: "Les paramètres 'year' et 'week' sont requis." });
        }

        const declaration = await service.generateTaxDeclaration(parseInt(companyId), parseInt(year), parseInt(week));
        reply.send(declaration);
    } catch (error) {
        console.error("Erreur dans le contrôleur getTaxDeclaration:", error);
        reply.code(500).send({ message: error.message || "Erreur lors de la génération de la déclaration." });
    }
};

const createExpenseReport = async (request, reply) => {
    try {
        const report = await service.createExpenseReport(parseInt(request.headers['x-company-id']), request.user.userId, request.body);
        reply.code(201).send(report);
    } catch (error) {
        reply.code(400).send({ message: error.message });
    }
};

const getExpenseReports = async (request, reply) => {
    try {
        const reports = await service.getExpenseReports(parseInt(request.headers['x-company-id']));
        reply.send(reports);
    } catch (error) {
        reply.code(500).send({ message: error.message });
    }
};

const updateExpenseReportStatus = async (request, reply) => {
    try {
        const report = await service.updateExpenseReportStatus(parseInt(request.params.reportId), request.user.userId, request.body.status);
        reply.send(report);
    } catch (error) {
        reply.code(400).send({ message: error.message });
    }
};

const getExpenseReportCategories = async (request, reply) => {
    try {
        const categories = await service.getExpenseReportCategories(parseInt(request.headers['x-company-id']));
        reply.send(categories);
    } catch (error) {
        reply.code(500).send({ message: error.message });
    }
};

const createExpenseReportCategory = async (request, reply) => {
    try {
        const category = await service.createExpenseReportCategory(parseInt(request.headers['x-company-id']), request.body.name);
        reply.code(201).send(category);
    } catch (error) {
        reply.code(400).send({ message: error.message });
    }
};

const updateExpenseReportCategory = async (request, reply) => {
    const companyId = request.companyId;
    const categoryId = Number(request.params.categoryId);
    const { name } = request.body;
    const data = await service.updateExpenseReportCategory(companyId, categoryId, name);
    return reply.send(data);
};

const deleteExpenseReportCategory = async (request, reply) => {
    const companyId = request.companyId;
    const categoryId = Number(request.params.categoryId);
    await service.deleteExpenseReportCategory(companyId, categoryId);
    return reply.send({ success: true });
};

// --- Contrôleurs pour les données des widgets ---

const getWidgetData_UserBillsByStatus = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const companyId = parseInt(request.query.contextId, 10);
        const config = JSON.parse(request.query.config || '{}');
        const data = await service.getWidgetData_UserBillsByStatus(userId, companyId, config);
        reply.send(data);
    } catch (error) {
        request.log.error(error);
        reply.code(500).send({ message: "Erreur serveur" });
    }
};

const getWidgetData_ExpenseReportStats = async (request, reply) => {
    try {
        const companyId = parseInt(request.query.contextId, 10);
        const data = await service.getWidgetData_ExpenseReportStats(companyId);
        reply.send(data);
    } catch (error) {
        request.log.error(error);
        reply.code(500).send({ message: "Erreur serveur" });
    }
};

const getWidgetData_MyRecentExpenseReports = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const companyId = parseInt(request.query.contextId, 10);
        const data = await service.getWidgetData_MyRecentExpenseReports(userId, companyId);
        reply.send(data);
    } catch (error) {
        request.log.error(error);
        reply.code(500).send({ message: "Erreur serveur" });
    }
};

const getWidgetData_UserDutyCounter = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const companyId = parseInt(request.query.contextId, 10);
        const config = JSON.parse(request.query.config || '{}');

        const data = await service.getWidgetData_UserDutyCounter(
            userId,
            companyId,
            config
        );

        reply.send(data);
    } catch (error) {
        request.log.error(error);
        reply.code(500).send({ message: "Erreur serveur" });
    }
};

const getWidgetData_UsersDutyCounter = async (request, reply) => {
    try {
        const userId = request.user.userId;
        const companyId = parseInt(request.query.contextId, 10);
        const config = JSON.parse(request.query.config || '{}');

        const data = await service.getWidgetData_UsersDutyCounter(userId, companyId, config);
        reply.send(data);
    } catch (error) {
        request.log.error(error);
        reply.code(500).send({ message: "Erreur serveur" });
    }
};

const getCompanySettings = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const data = await service.getCompanySettings(companyId);
        reply.send(data);
    } catch (error) {
        reply.code(500).send({ message: error.message });
    }
};

const updateCompany = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const { name } = request.body;
        const updated = await service.updateCompany(companyId, name);
        reply.send(updated);
    } catch (error) {
        reply.code(400).send({ message: error.message });
    }
};

const generateApiKey = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const result = await service.generateApiKey(companyId);
        reply.send(result);
    } catch (error) {
        reply.code(500).send({ message: error.message });
    }
};

const regenerateOnboardingKey = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const result = await service.regenerateOnboardingKey(companyId);
        reply.send(result);
    } catch (error) {
        reply.code(500).send({ message: error.message });
    }
};

const updateCompanySettings = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const { settings } = request.body || {};

        const data = await service.updateCompanySettings(companyId, settings);
        reply.send(data);
    } catch (error) {
        reply.code(error?.status || 500).send({ message: error.message || "Erreur serveur." });
    }
};

const updateExpenseReport = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const reportId = parseInt(request.params.reportId, 10);
        const actorUserId = request.user.userId;

        const report = await service.updateExpenseReport(companyId, reportId, actorUserId, request.body);
        reply.send(report);
    } catch (error) {
        reply.code(400).send({ message: error.message });
    }
};

const deleteExpenseReport = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const reportId = parseInt(request.params.reportId, 10);

        const result = await service.deleteExpenseReport(companyId, reportId);
        reply.send(result);
    } catch (error) {
        reply.code(400).send({ message: error.message });
    }
};

const updateBillShares = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const billId = Number.parseInt(request.params.billId, 10);

        const shares = Array.isArray(request.body?.shares) ? request.body.shares : [];

        const bill = await service.updateBillShares(companyId, billId, shares);
        reply.send({ bill });
    } catch (err) {
        reply.code(err?.statusCode || 400).send({ message: err.message });
    }
};

const getSolde = async (req, rep) => {
    try {
        // Priorité au header (comme ton proxy / CompanyContext)
        const companyId = parseInt(req.headers['x-company-id'], 10);

        const balance = await service.getSolde(companyId);

        return rep.send({
            companyId: Number(companyId),
            balance,
        });
    } catch (err) {
        const statusCode = err.statusCode || 500;
        return rep.code(statusCode).send({
            error: err.message || 'Internal server error',
        });
    }
};
const getWidgetData_TransactionLog = async (request, reply) => {
    try {
        const companyId = parseInt(request.query.contextId, 10);
        const config = JSON.parse(request.query.config || '{}');

        if (isNaN(companyId)) {
            return reply.code(400).send({ message: "Le 'contextId' est manquant ou invalide." });
        }

        const data = await service.getWidgetData_TransactionLog(companyId, config);
        reply.send(data);
    } catch (error) {
        request.log.error(error);
        reply.code(500).send({ message: "Erreur serveur" });
    }
};

const getBillComments = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const billId = parseInt(request.params.billId, 10);
        const page = parseInt(request.query.page, 10) || 1;
        const limit = parseInt(request.query.limit, 10) || 5;

        const result = await service.getBillComments(companyId, billId, page, limit);
        reply.send(result);
    } catch (error) {
        reply.code(500).send({ message: error.message });
    }
};

const addBillComment = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const billId = parseInt(request.params.billId, 10);
        const { content } = request.body;
        const authorId = request.user.userId;

        const comment = await service.addBillComment(companyId, billId, authorId, content);
        reply.code(201).send(comment);
    } catch (error) {
        reply.code(400).send({ message: error.message });
    }
};

const editBillComment = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const commentId = parseInt(request.params.commentId, 10);
        const { content } = request.body;
        const userId = request.user.userId;

        const { buildEffectiveCompanyPermissions, hasPermission } = require('../../middleware/auth');
        const userPermissions = await buildEffectiveCompanyPermissions(userId, companyId);
        const canEditAny = hasPermission(userPermissions, 'COMPTABILITE.BILLS.COMMENTS.EDIT') || hasPermission(userPermissions, 'COMPTABILITE.BILLS.COMMENT.MANAGE');

        const comment = await service.editBillComment(companyId, commentId, userId, content, canEditAny);
        reply.send(comment);
    } catch (error) {
        reply.code(error.statusCode || 400).send({ message: error.message });
    }
};

const deleteBillComment = async (request, reply) => {
    try {
        const companyId = parseInt(request.headers['x-company-id'], 10);
        const commentId = parseInt(request.params.commentId, 10);
        const userId = request.user.userId;

        const { buildEffectiveCompanyPermissions, hasPermission } = require('../../middleware/auth');
        const userPermissions = await buildEffectiveCompanyPermissions(userId, companyId);
        const canDeleteAny = hasPermission(userPermissions, 'COMPTABILITE.BILLS.COMMENT.REMOVE') || hasPermission(userPermissions, 'COMPTABILITE.BILLS.COMMENT.MANAGE');

        await service.deleteBillComment(companyId, commentId, userId, canDeleteAny);
        reply.send({ success: true });
    } catch (error) {
        reply.code(error.statusCode || 400).send({ message: error.message });
    }
};

module.exports = {
    getWidgetData_TransactionLog,
    getSolde,
    getBills,
    getBillDetails,
    updateBillShares,
    getJournal,
    getSummary,
    updateCategory,
    getTransactionCategories,
    getTaxDeclaration,
    createExpenseReport,
    getExpenseReports,
    updateExpenseReportStatus,
    getExpenseReportCategories,
    createExpenseReportCategory,
    updateExpenseReportCategory,
    deleteExpenseReportCategory,
    getWidgetData_UserBillsByStatus,
    getWidgetData_ExpenseReportStats,
    getWidgetData_MyRecentExpenseReports,
    getWidgetData_UserDutyCounter,
    getWidgetData_UsersDutyCounter,
    getCompanySettings,
    updateCompany,
    generateApiKey,
    regenerateOnboardingKey,
    updateCompanySettings,
    updateExpenseReport,
    deleteExpenseReport,
    getBillComments,
    addBillComment,
    editBillComment,
    deleteBillComment,
};