// backend/src/modules/attachments/attachments.service.js
'use strict';

const prisma = require('../../db');
const path = require('path');

const BACKEND_ROOT = path.resolve(__dirname, '../../../..');
const UPLOADS_DIR = path.join(__dirname, '..', '..', '..');
/**
 * Résout un chemin stocké en DB vers un chemin disque absolu,
 * en empêchant les path traversals.
 */
function resolveDiskPath(diskPath) {
    if (!diskPath || typeof diskPath !== 'string') return null;

    // Normalise
    const trimmed = diskPath.trim();
    if (!trimmed) return null;


    // Si absolu, on l’accepte seulement si ça reste dans BACKEND_ROOT
    if (path.isAbsolute(trimmed)) {
        const normalizedAbs = path.normalize(trimmed);
        const ok =
            normalizedAbs === BACKEND_ROOT ||
            normalizedAbs.startsWith(BACKEND_ROOT + path.sep);

        return ok ? normalizedAbs : null;
    }

    // Si relatif, on le résout à partir du backend root
    const normalizedRel = path.normalize(trimmed);

    // Bloque explicitement les chemins suspects
    if (normalizedRel.startsWith('..' + path.sep) || normalizedRel === '..') return null;

    const abs = path.resolve(BACKEND_ROOT, normalizedRel);
    const ok = abs === BACKEND_ROOT || abs.startsWith(BACKEND_ROOT + path.sep);

    return ok ? abs : null;
}
async function getAttachmentForServing({ channelId, publicId }) {
    if (!publicId || typeof publicId !== 'string') return null;

    const attachment = await prisma.chatAttachment.findUnique({
        where: {
            channelId_publicId: {
                channelId: BigInt(channelId),
                publicId: String(publicId),
            },
        },
        select: {
            id: true,
            publicId: true,
            mimeType: true,
            byteSize: true,
            width: true,
            height: true,
            diskPath: true,
            createdAt: true,
        },
    });

    if (!attachment) return null;

    const imagePath = path.join(UPLOADS_DIR, attachment.diskPath);

    if (!imagePath) {
        return { ...attachment, absPath: null, invalidPath: true, diskPath: attachment.diskPath };
    }

    return { ...attachment, imagePath, invalidPath: false, absPath: imagePath };
}

module.exports = {
    BACKEND_ROOT,
    resolveDiskPath,
    getAttachmentForServing,
};