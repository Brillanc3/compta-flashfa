// Point d'entrée dédié au Worker BullMQ ingest.
// À lancer via PM2 en instances: 1 — garantit un seul consommateur de la queue.

require('dotenv').config();

const { startWorker, close } = require('./ingestQueueRedis');

startWorker();
console.log('[ingest-worker] Processus démarré.');

async function shutdown(signal) {
  console.log(`[ingest-worker] ${signal} reçu — fermeture propre...`);
  await close();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
