// backend/src/controllers/ingestionController.js

const prisma = require('../db');
const { process: processLog } = require('../services/logProcessor.service');

const handleIngestion = async (request, reply) => {
    try {
        const companyId = parseInt(request.params.companyId, 10);
        const apiKey = request.params.apiKey;

        if (isNaN(companyId) || !apiKey) {
            return reply.code(400).send({ success: false, error: "Format d'URL invalide." });
        }

        const company = await prisma.company.findFirst({
            where: {
                id: companyId,
                apiKey: apiKey,
            },
        });

        if (!company || !company.isApiActive) {
            return reply.code(403).send({ success: false, error: "ID d'entreprise ou clé d'API invalide, ou API désactivée." });
        }

        const requestData = request.body;

        if (!requestData || typeof requestData !== 'object' || !requestData.logType) {
            return reply.code(400).send({ success: false, error: "Données JSON invalides ou logType manquant." });
        }

        const newLog = await prisma.log.create({
            data: {
                companyId: company.id,
                message: requestData.message ?? null,
                category: requestData.category ?? 'unknown',
                logType: requestData.logType,
                text: requestData.text ?? null,
                date: requestData.date?.toString(),
                data: JSON.stringify(requestData.data ?? {}),
                isProcessed: false,
            },
        });

        await processLog(newLog);

        const finalLog = await prisma.log.findUnique({ where: { id: newLog.id } });

        if (finalLog.isProcessed) {
            reply.code(200).send({ success: true, message: 'Log traité avec succès.' });
        } else {
            reply.code(500).send({
                success: false,
                error: `Le log a été enregistré (ID: ${finalLog.id}), mais une erreur est survenue lors de son traitement.`,
                details: finalLog.processingError,
            });
        }

    } catch (error) {
        console.error('[IngestionController] Erreur critique:', error);
        reply.code(500).send({ success: false, error: 'Erreur interne du serveur.' });
    }
};

module.exports = {
    handleIngestion,
};