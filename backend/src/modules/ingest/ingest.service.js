// /backend/src/modules/ingest/ingest.service.js

const fs = require('fs');
const path = require('path');
const prisma = require('../../db');

// --- Chargement dynamique de tous les handlers ---
const handlers = [];
// Le chemin est ajusté pour remonter de /modules/ingest/ à /services/handlers/
const handlersDir = path.join(__dirname, '../../services/handlers');

fs.readdirSync(handlersDir)
    .filter(file => file.endsWith('.handler.js'))
    .forEach(file => {
        const handler = require(path.join(handlersDir, file));
        handlers.push(handler);
    });


/**
 * Traite un log en trouvant le handler approprié et en exécutant sa logique.
 * @param {object} log - L'entité Log de Prisma à traiter.
 * @param companyModules
 * @param companySettings
 */
async function process(log, companyModules = {}, companySettings = {}) {
    let handlerFound = false;

    try {
        log.parsedData = log.data ? JSON.parse(log.data) : null;
    } catch (err) {
        await prisma.log.update({
            where: { id: log.id },
            data: { isProcessed: false, processingError: 'Invalid JSON payload in log.data' },
        });
        return;
    }

    log.context = { companyModules, companySettings };

    for (const handler of handlers) {
        if (handler.supports(log.logType)) {
            handlerFound = true;
            try {
                if (handler.handle.length >= 2) {
                    await handler.handle(log, log.context);
                } else {
                    await handler.handle(log);
                }

                await prisma.log.update({
                    where: { id: log.id },
                    data: { isProcessed: true, processingError: null },
                });
            } catch (error) {
                await prisma.log.update({
                    where: { id: log.id },
                    data: {
                        isProcessed: false,
                        processingError: error.message || "Une erreur inconnue est survenue.",
                    },
                });
                throw error;
            }
            break;
        }
    }

    if (!handlerFound) {
        const errorMessage = `Aucun handler trouvé pour le logType '${log.logType}'.`;
        // console.error(`[LogProcessor] Erreur pour le Log ID ${log.id}: ${errorMessage}`);
        await prisma.log.update({
            where: { id: log.id },
            data: {
                isProcessed: false,
                processingError: errorMessage,
            },
        });
    }
}

module.exports = {
    process,
};