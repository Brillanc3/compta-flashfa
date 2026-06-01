// /backend/src/modules/ingest/ingest.controller.js

const crypto = require('crypto');
const prisma = require('../../db');
const { process: processLog } = require('./ingest.service');
const ingestQueue = require('../../lib/ingestQueueRedis');
const { redis } = require('../../shards/redisClient');

// TTL en secondes de la fenêtre de déduplication.
// Doit être >= au délai initial du replay worker dans master.js (actuellement 60s).
const INGEST_DEDUP_TTL_SECONDS = 60;

function computeDedupeKey(companyId, payload) {
    // Hash stable sur les données métier identifiant l'événement
    const content = JSON.stringify({
        c: companyId,
        t: payload.logType,
        d: payload.date,
        p: payload.data,
    });
    const hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 40);
    return `dedup:ingest:${hash}`;
}

const handleIngestion = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.companyId, 10);
        const apiKey = request.params.apiKey;

        if (isNaN(companyId) || !apiKey) {
            return reply.code(200).send({ success: false, error: "Format d'URL invalide." });
        }

        const company = await prisma.company.findFirst({
            where: {
                id: companyId,
                apiKey: apiKey,
            },
        });

        if (!company || !company.isApiActive) {
            return reply.code(200).send({ success: false, error: "ID d'entreprise ou clé d'API invalide, ou API désactivée." });
        }

        if (company.accountingSuspendedAt && company.accountingSuspendedAt <= new Date()) {
            return reply.code(200).send({ success: false, error: "Comptabilité suspendue : l'API est desactivee." });
        }

        const requestData = request.body;

        if (!requestData || typeof requestData !== 'object' || !requestData.logType) {
            return reply.code(200).send({ success: false, error: "Données JSON invalides ou logType manquant." });
        }

        // --- Déduplication idempotente ---
        // Protège contre les retries client qui arriveraient en doublon via le replay worker.
        const dedupeKey = computeDedupeKey(companyId, requestData);
        const isNew = await redis.set(dedupeKey, '1', 'NX', 'EX', INGEST_DEDUP_TTL_SECONDS);
        if (!isNew) {
            // Doublon détecté : on répond 200 sans recréer de log
            return reply.code(200).send({ success: true, duplicate: true, message: 'Already received' });
        }

        const jobMeta = await ingestQueue.enqueueAndCreateLog({
            companyId,
            payload: requestData,
            receivedAt: new Date()
        });

        const waitParam = String(request.query?.wait || '').toLowerCase();
        const waitHeader = String(request.headers['x-wait-for-processing'] || '').toLowerCase();
        const shouldWait = waitParam === '1' || waitParam === 'true' || waitHeader === '1' || waitHeader === 'true';

        if (shouldWait) {
            const result = await jobMeta.waitForFinish(30_000); // timeout configurable
            return reply.code(200).send({ success: true, result });
        }

        return reply.code(200).send({
            success: true,
            message: 'Accepted for processing',
            jobId: jobMeta.jobId,
            logId: jobMeta.logId,
        });

    } catch (error) {
        request.log.error({ err: error }, 'Ingest handling error'); // ne pas loguer apiKey
        return reply.code(500).send({ error: 'Internal server error' });
    }
};
module.exports = {
    handleIngestion,
};