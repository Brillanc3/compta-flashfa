// backend/src/services/logProcessor.service.js

const fs = require('fs');
const path = require('path');
const prisma = require('../db');

// --- Chargement dynamique de tous les handlers ---
const handlers = [];
const handlersDir = path.join(__dirname, 'handlers');

fs.readdirSync(handlersDir)
    .filter(file => file.endsWith('.handler.js'))
    .forEach(file => {
        const handler = require(path.join(handlersDir, file));
        handlers.push(handler);
    });


/**
 * Traite un log en trouvant le handler approprié et en exécutant sa logique.
 * @param {object} log - L'entité Log de Prisma à traiter.
 */
async function process(log) {
    let handlerFound = false;

    for (const handler of handlers) {
        if (handler.supports(log.logType)) {
            handlerFound = true;
            try {
                await handler.handle(log);

                await prisma.log.update({
                    where: { id: log.id },
                    data: {
                        isProcessed: true,
                        processingError: null,
                    },
                });

                // console.log(`[LogProcessor] Log ID ${log.id} traité avec succès par ${log.logType} handler.`);

                // --- NOTIFICATION WEBSOCKET POUR L'ACTUALISATION EN TEMPS RÉEL ---
                const company = await prisma.company.findUnique({ where: { id: log.companyId } });
                const latestTransaction = await prisma.transaction.findFirst({
                    where: { companyId: log.companyId },
                    orderBy: { createdAt: 'desc' },
                    include: { category: true },
                });

                // On envoie un message structuré au frontend

                // --- DÉCLENCHEMENT DE L'AUTOMATION (SCRATCH) ---
                try {
                    const engine = require('../modules/automation/lib/automationEngine');
                    engine.trigger(log);
                } catch (e) {
                    console.error('[LogProcessor] Erreur trigger automation :', e);
                }
                // -----------------------------------------------------------

            } catch (error) {
                // console.error(`[LogProcessor] Erreur lors du traitement du Log ID ${log.id}`, error);
                await prisma.log.update({
                    where: { id: log.id },
                    data: {
                        isProcessed: false,
                        processingError: error.message || 'Une erreur inconnue est survenue.',
                    },
                });
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