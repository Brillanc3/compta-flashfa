'use strict';

const { Worker, Queue } = require('bullmq');
const IORedis = require('ioredis');
const { prisma } = require('../../../shards/database');
const emitter = require('../sockets/socket.emitter');
const { THREAD_SELECT } = require('../thread/thread.repository');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const prefix = process.env.ENV === 'dev' ? 'dev:bull' : 'bull';

const queueConn = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
const archiveQueue = new Queue('tchatv2-archive-threads', { connection: queueConn, prefix });

let _worker = null;

async function findThreadsToArchive() {
    // v2_channel.updatedAt tracks lastMessageId changes via Prisma @updatedAt
    return prisma.$queryRaw`
        SELECT tm.channelId, c.guildId
        FROM v2_thread_metadata tm
        JOIN v2_channel c ON c.id = tm.channelId
        WHERE tm.archived = 0
          AND TIMESTAMPADD(MINUTE, tm.autoArchiveDuration, c.updatedAt) < NOW()
        LIMIT 1000
    `;
}

async function archiveBatch(threads) {
    for (const { channelId, guildId } of threads) {
        await prisma.v2ThreadMetadata.update({
            where: { channelId },
            data: { archived: true, archiveTimestamp: new Date() },
        });

        const thread = await prisma.v2Channel.findUnique({
            where: { id: channelId },
            select: THREAD_SELECT,
        });

        if (thread) emitter.threadUpdate(String(guildId), thread);
    }
    return threads.length;
}

function startArchiveWorker() {
    if (_worker) return _worker;

    const workerConn = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

    _worker = new Worker('tchatv2-archive-threads', async (job) => {
        const threads = await findThreadsToArchive();
        if (threads.length === 0) return { archived: 0 };

        const count = await archiveBatch(threads);
        console.log(`[tchatv2-archive-threads] Archivé ${count} threads`);
        return { archived: count };
    }, { connection: workerConn, concurrency: 1, prefix });

    _worker.on('failed', (job, err) => {
        console.error(`[tchatv2-archive-threads] job ${job?.id} failed: ${err?.message}`);
    });

    console.log('[tchatv2-archive-threads] Worker démarré');
    return _worker;
}

async function scheduleArchiveJob() {
    // Job récurrent toutes les 5 min via repeat
    await archiveQueue.add('archive-scan', {}, {
        repeat: { every: 5 * 60 * 1000 },
        removeOnComplete: 10,
        removeOnFail: 5,
    });
}

module.exports = { startArchiveWorker, scheduleArchiveJob, archiveQueue };
