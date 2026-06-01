'use strict';

const { Worker, Queue } = require('bullmq');
const IORedis = require('ioredis');
const { prisma } = require('../../../shards/database');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const prefix    = process.env.ENV === 'dev' ? 'dev:bull' : 'bull';

const queueConn   = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
const cleanupQueue = new Queue('tchatv2-cleanup', { connection: queueConn, prefix });

let _worker = null;

async function runCleanup() {
    const counts = { invites: 0, attachments: 0, auditLogs: 0 };

    // Invitations expirées
    const { count: invites } = await prisma.v2Invite.deleteMany({
        where: { expiresAt: { not: null, lt: new Date() } },
    });
    counts.invites = invites;

    // Attachments orphelins créés il y a plus de 1h (jamais liés à un message)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const { count: attachments } = await prisma.v2Attachment.deleteMany({
        where: { messageId: null, createdAt: { lt: oneHourAgo } },
    });
    counts.attachments = attachments;

    // Audit logs de plus de 90 jours
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const { count: auditLogs } = await prisma.v2AuditLog.deleteMany({
        where: { createdAt: { lt: ninetyDaysAgo } },
    });
    counts.auditLogs = auditLogs;

    return counts;
}

function startCleanupWorker() {
    if (_worker) return _worker;

    const workerConn = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

    _worker = new Worker('tchatv2-cleanup', async () => {
        const counts = await runCleanup();
        console.log(`[tchatv2-cleanup] invites: ${counts.invites}, attachments: ${counts.attachments}, auditLogs: ${counts.auditLogs}`);
        return counts;
    }, { connection: workerConn, concurrency: 1, prefix });

    _worker.on('failed', (job, err) => {
        console.error(`[tchatv2-cleanup] job ${job?.id} failed: ${err?.message}`);
    });

    console.log('[tchatv2-cleanup] Worker démarré');
    return _worker;
}

async function scheduleCleanupJob() {
    await cleanupQueue.add('daily-cleanup', {}, {
        repeat:           { every: 24 * 60 * 60 * 1000 },
        removeOnComplete: 5,
        removeOnFail:     5,
    });
}

module.exports = { startCleanupWorker, scheduleCleanupJob, cleanupQueue };
