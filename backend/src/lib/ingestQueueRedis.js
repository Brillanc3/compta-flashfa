// Implémentation BullMQ sans QueueScheduler (conforme à BullMQ >= 2.0 où QueueScheduler est déprécié).
// Utilise Queue, Worker et QueueEvents. Assure-toi que REDIS_URL est défini dans .env.
//
// Le Worker n'est PAS démarré automatiquement : appeler startWorker() dans le shard désigné
// (celui avec ENABLE_INGEST_WORKER=true dans son env).

const IORedis = require('ioredis');
const { Queue, Worker, QueueEvents } = require('bullmq');
const prisma = require('../db');
const { process: processLog } = require('../modules/ingest/ingest.service');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const QUEUE_NAME = 'ingest-queue';

// Connexions Redis séparées (recommandé)
const ioredisOpts = {
  maxRetriesPerRequest: null
};
const prefix = process.env.ENV === 'dev' ? 'dev:bull' : 'bull';
const client = new IORedis(REDIS_URL, ioredisOpts);        // pour Queue
const workerClient = new IORedis(REDIS_URL, ioredisOpts);  // pour Worker
const eventsClient = new IORedis(REDIS_URL, ioredisOpts);  // pour QueueEvents

// Queue + QueueEvents (instanciés dans tous les shards pour permettre l'enqueue)
const queue = new Queue(QUEUE_NAME, { connection: client, prefix });
const queueEvents = new QueueEvents(QUEUE_NAME, { connection: eventsClient, prefix });

let worker = null;

const PERF_WINDOW = 100;
const perfBuffer = [];
let perfSum = 0;

function recordDuration(ms) {
  if (perfBuffer.length === PERF_WINDOW) perfSum -= perfBuffer.shift();
  perfBuffer.push(ms);
  perfSum += ms;
}

function avgMs() {
  return perfBuffer.length === 0 ? 0 : Math.round(perfSum / perfBuffer.length);
}

/**
 * Démarre le Worker BullMQ. À appeler UNE SEULE FOIS, dans le shard désigné
 * (ENABLE_INGEST_WORKER=true). Les autres shards se contentent d'enqueuer via enqueueAndCreateLog.
 */
function startWorker() {
  if (worker) {
    console.warn('[ingest-queue] startWorker() appelé plusieurs fois — ignoré.');
    return worker;
  }

  worker = new Worker(
    QUEUE_NAME,
    async job => {
      const { logId } = job.data;
      if (!logId) throw new Error('Missing logId in job data');

      const log = await prisma.log.findUnique({
        where: { id: logId },
        select: {
          id: true,
          companyId: true,
          category: true,
          logType: true,
          text: true,
          date: true,
          data: true,

          company: {
            select: {
              id: true,
              settings: { select: { settings: true } },
              activeModules: {
                select: {
                  module: { select: { id: true, name: true, description: true } },
                },
              },
            },
          },
        },
      });

      if (!log) throw new Error(`Log ${logId} introuvable`);

      try { await prisma.log.update({ where: { id: logId }, data: { processingError: null } }); } catch (e) {}

      const companyModulesRaw = log.company?.activeModules || [];
      const companyModules = {
        list: companyModulesRaw.map((m) => m.module),
        names: companyModulesRaw.map((m) => m.module.name),
        byName: Object.fromEntries(companyModulesRaw.map((m) => [m.module.name, m.module])),
      };

      const companySettings =
        log.company?.settings?.settings && typeof log.company.settings.settings === 'object'
          ? log.company.settings.settings
          : {};

      const result = await processLog(log, companyModules, companySettings);
      return result;
    },
    {
      connection: workerClient,
      concurrency: 1,
      prefix,
    }
  );

  worker.on('failed', async (job, err) => {
    console.error(`[ingest-queue] job ${job?.id} failed:`, err?.message || err);
    if (job?.data?.logId) {
      try {
        await prisma.log.update({
          where: { id: job.data.logId },
          data: { processingError: String(err?.message || err).slice(0, 2000) },
        });
      } catch (e) {}
    }
  });

  worker.on('completed', (job) => {
    const ms = (job.finishedOn && job.processedOn) ? job.finishedOn - job.processedOn : 0;
    recordDuration(ms);
    console.log(`[ingest-queue] job ${job.id} completed (ms: ${ms} | moy: ${avgMs()})`);
  });

  console.log('[ingest-queue] Worker démarré (concurrency=1).');
  return worker;
}

/**
 * Crée la ligne Log en DB puis ajoute le job dans la queue.
 * Retourne { jobId, logId, waitForFinish() }.
 */
async function enqueueAndCreateLog({ companyId, payload, receivedAt = new Date() }) {
  const created = await prisma.log.create({
    data: {
      companyId,
      data: JSON.stringify(payload.data) ?? JSON.stringify([]),
      logType: payload.logType || 'ingest',
      category: payload.category || 'ingest Message',
      message: payload.message || 'ingest Message',
      text: payload.text || 'ingest Text',
      isProcessed: false,
      date: payload.date?.toString() ?? receivedAt.valueOf().toString(),
    }
  });

  const jobId = `log-${created.id}`;
  const job = await queue.add('ingest-job', { logId: created.id }, {
    jobId,
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 1000
  });

  const waitForFinish = async (timeoutMs = 30_000) => {
    try {
      const result = await job.waitUntilFinished(queueEvents, timeoutMs);
      return result;
    } finally {
      // queueEvents reste ouvert pour la durée de vie du process
    }
  };

  return { jobId: job.id, logId: created.id, waitForFinish };
}

// Fermeture propre : fermer worker, queue, queueEvents et clients Redis
async function close() {
  try { if (worker) await worker.close(); } catch (e) {}
  try { if (queueEvents) await queueEvents.close(); } catch (e) {}
  try { if (queue) await queue.close(); } catch (e) {}
  try { await client.quit(); } catch (e) {}
  try { await workerClient.quit(); } catch (e) {}
  try { await eventsClient.quit(); } catch (e) {}
}

module.exports = {
  startWorker,
  enqueueAndCreateLog,
  close,
  _internal: { queue, get worker() { return worker; }, queueEvents, clients: { client, workerClient, eventsClient } }
};
