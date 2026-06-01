// /backend/src/modules/image/image.controller.js
const prisma = require('../../db');
const fs = require('fs');
const path = require('path');
const imageService = require('./image.service');

/**
 * Sert une image en streaming depuis le disque.
 */
const serveImage = async (request, reply) => {
    try {
        const { publicId } = request.params;
        const image = await prisma.image.findUnique({ where: { publicId } });

        if (!image) {
            return reply.code(404).send({ message: "Image non trouvée." });
        }

        const imagePath = path.join(imageService.UPLOADS_DIR, image.filename);

        if (!fs.existsSync(imagePath)) {
            return reply.code(404).send({ message: "Fichier image corrompu ou manquant." });
        }

        const buffer = await fs.promises.readFile(imagePath);
        reply.type(image.mimetype).send(buffer);

    } catch (error) {
        console.error("Erreur lors de l'affichage de l'image:", error);
        reply.code(500).send({ message: "Erreur serveur." });
    }
};

/**
 * Gère l'upload de l'image de profil de l'utilisateur connecté.
 */
const uploadProfilePicture = async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.code(400).send({ message: "Aucun fichier." });
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(data.mimetype)) {
        return reply.code(400).send({ message: "Format non supporté." });
    }

    try {
        const image = await imageService.uploadAndSaveImage(data, 'USER', request.user.userId);
        const imageUrl = `/api/images/${image.publicId}?v=${image.updatedAt.getTime()}`;
        reply.code(200).send({ message: "Image de profil mise à jour.", imageUrl: imageUrl });
    } catch (error) {
        console.error(error);
        reply.code(500).send({ message: "Erreur lors de la sauvegarde de l'image." });
    }
};

/**
 * Gère l'upload d'une image pour une entreprise.
 */
const uploadCompanyImage = async (request, reply) => {
    const companyId = parseInt(request.params.companyId, 10);
    const data = await request.file();

    if (!data) return reply.code(400).send({ message: "Aucun fichier fourni." });
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(data.mimetype)) {
        return reply.code(400).send({ message: "Format de fichier non supporté." });
    }

    try {
        const image = await imageService.uploadAndSaveImage(data, 'COMPANY', companyId);
        const imageUrl = `/api/images/${image.publicId}?v=${image.updatedAt.getTime()}`;
        reply.code(200).send({ message: `Image pour l'entreprise ${companyId} mise à jour.`, imageUrl: imageUrl });
    } catch (error) {
        console.error(error);
        reply.code(500).send({ message: "Erreur lors de la sauvegarde de l'image." });
    }
};

module.exports = {
    serveImage,
    uploadProfilePicture,
    uploadCompanyImage,
};