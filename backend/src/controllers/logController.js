// backend/src/controllers/logController.js

const prisma = require('../db');
const { process: processLog } = require('../services/logProcessor.service');

/**
 * Récupère une liste paginée de logs.
 * Permet de filtrer par statut (ex: 'error', 'success', 'pending').
 */
const getAllLogs = async (request, reply) => {
    try {
        const { status, page = 1, limit = 20, companyId, logType } = request.query;
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);

        // On construit dynamiquement la clause "where" pour Prisma
        const where = {};
        if (status === 'error') {
            where.isProcessed = false;
            where.processingError = { not: null };
        } else if (status === 'success') {
            where.isProcessed = true;
        } else if (status === 'pending') {
            where.isProcessed = false;
            where.processingError = null;
        }

        if (companyId) {
            where.companyId = parseInt(companyId, 10);
        }

        if (logType) {
            where.logType = { contains: logType }; // 'contains' pour une recherche partielle
        }

        const logs = await prisma.log.findMany({
            where,
            take: limitNum,
            skip: (pageNum - 1) * limitNum,
            orderBy: { createdAt: 'desc' },
            include: { company: { select: { name: true } } },
        });

        const total = await prisma.log.count({ where });

        reply.send({
            logs,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
        });

    } catch (error) {
        reply.code(500).send({ message: 'Erreur lors de la récupération des logs', error: error.message });
    }
};

/**
 * Relance le traitement d'un log spécifique qui a échoué.
 */
const reprocessLog = async (request, reply) => {
    try {
        const logId = parseInt(request.params.id, 10);

        const log = await prisma.log.findUnique({ where: { id: logId } });

        if (!log) {
            return reply.code(404).send({ message: 'Log non trouvé.' });
        }

        // On relance le traitement via le processeur
        await processLog(log);

        // On récupère le log mis à jour pour le renvoyer au frontend
        const updatedLog = await prisma.log.findUnique({
            where: { id: logId },
            include: { company: { select: { name: true } } },
        });

        reply.send(updatedLog);

    } catch (error) {
        reply.code(500).send({ message: 'Erreur lors du retraitement du log.', error: error.message });
    }
};


module.exports = {
    getAllLogs,
    reprocessLog,
};