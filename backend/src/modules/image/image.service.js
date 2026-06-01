// /backend/src/modules/image/image.service.js
const prisma = require('../../db');
const { pipeline } = require('stream');
const util = require('util');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const pump = util.promisify(pipeline);
const UPLOADS_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'images');

// On s'assure que le dossier d'upload existe au démarrage
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Gère le processus d'upload d'une image, sa sauvegarde sur le disque
 * et la création/mise à jour de l'enregistrement en base de données.
 * @param {object} fileData - L'objet fichier de Fastify.
 * @param {'USER' | 'COMPANY'} ownerType - Le type de propriétaire.
 * @param {number} ownerId - L'ID du propriétaire.
 * @returns {Promise<object>} L'objet Image de Prisma.
 */
async function uploadAndSaveImage(fileData, ownerType, ownerId) {
    const fileExtension = path.extname(fileData.filename);
    const newFilename = `${crypto.randomBytes(16).toString('hex')}${fileExtension}`;
    const filePath = path.join(UPLOADS_DIR, newFilename);

    // 1. Sauvegarde du fichier sur le disque
    await pump(fileData.file, fs.createWriteStream(filePath));

    // 2. Récupérer l'image existante si elle existe
    const existingImage = await prisma.image.findFirst({
        where: { ownerId, ownerType }
    });

    let savedImage;

    if (existingImage) {
        // Supprimer l'ancien fichier
        const oldFilePath = path.join(UPLOADS_DIR, existingImage.filename);
        fs.unlink(oldFilePath, (err) => {
            if (err) console.error("Erreur lors de la suppression de l'ancienne image:", err);
        });

        // Mise à jour de l'entrée
        savedImage = await prisma.image.update({
            where: { id: existingImage.id },
            data: {
                filename: newFilename,
                mimetype: fileData.mimetype
            }
        });
    } else {
        // Création d'une nouvelle image
        savedImage = await prisma.image.create({
            data: {
                filename: newFilename,
                mimetype: fileData.mimetype,
                ownerType,
                ownerId
            }
        });
    }

    // 3. Recharger l'image pour récupérer publicId & updatedAt
    const fullImage = await prisma.image.findUnique({
        where: { id: savedImage.id }
    });

    // 4. Construire l'URL officielle utilisée partout
    const imageUrl = `/api/images/${fullImage.publicId}?v=${fullImage.updatedAt.getTime()}`;

    // 5. Mise à jour User.imageUrl si ownerType === 'USER'
    if (ownerType === 'USER') {
        await prisma.user.update({
            where: { id: ownerId },
            data: { imageUrl }
        });
    }

    // 6. (Optionnel mais pratique) ajouter l'URL dans l'objet retourné
    fullImage.publicUrl = imageUrl;

    return fullImage;
}


module.exports = {
    uploadAndSaveImage,
    UPLOADS_DIR // On exporte le chemin pour le contrôleur qui sert les images
};