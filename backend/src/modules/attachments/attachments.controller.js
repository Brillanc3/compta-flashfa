// backend/src/modules/attachments/attachments.controller.js
'use strict';

const fs = require('fs');
const attachmentsService = require('./attachments.service');

async function serveAttachment(request, reply) {
    try {
        const { salonId, publicId } = request.params || {};

        if (!salonId || !publicId) {
            return reply.code(400).send({ message: 'Paramètres invalides.' });
        }

        let channelId;
        try {
            channelId = BigInt(salonId);
        } catch {
            return reply.code(400).send({ message: 'salonId invalide.' });
        }

        const attachment = await attachmentsService.getAttachmentForServing({
            channelId,
            publicId,
        });

        if (!attachment) {
            return reply.code(404).send({ message: 'Fichier introuvable.' });
        }

        if (attachment.invalidPath || !attachment.absPath) {
            return reply.code(404).send({ message: 'Fichier introuvable.', absPath: attachment.absPath, invalidPath: attachment.invalidPath  });
        }

        if (!fs.existsSync(attachment.absPath)) {
            return reply.code(404).send({ message: 'Fichier manquant.' });
        }

        // Cache longue durée (publicId immuable)
        reply.header('Cache-Control', 'public, max-age=31536000, immutable');

        // Par défaut ce sera image/webp, mais on respecte le mimeType DB
        reply.type(attachment.mimeType || 'application/octet-stream');

        const stream = fs.createReadStream(attachment.absPath);
        return reply.send(stream);
    } catch (error) {
        request.log?.error?.(error);
        return reply.code(500).send({ message: 'Erreur serveur.' });
    }
}

module.exports = {
    serveAttachment,
};