// backend/src/controllers/imageController.js

const prisma = require('../db');
const { pipeline } = require('stream');
const util = require('util');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const pump = util.promisify(pipeline);
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads', 'images');

// On s'assure que le dossier existe
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Sert une image de manière sécurisée.
 * Trouve l'image par son ID public et la renvoie en streaming.
 */
const serveImage = async (request, reply) => {
    try {
        const { publicId } = request.params;
        const image = await prisma.image.findUnique({ where: { publicId } });

        if (!image) {
            return reply.code(404).send({ message: "Image non trouvée." });
        }

        const imagePath = path.join(UPLOADS_DIR, image.filename);

        if (!fs.existsSync(imagePath)) {
            return reply.code(404).send({ message: "Fichier image corrompu ou manquant." });
        }

        // --- BLOC MODIFIÉ ---
        // Au lieu de créer un stream, on lit le fichier entier dans un buffer.
        // C'est beaucoup plus fiable pour les petits fichiers.
        const buffer = await fs.promises.readFile(imagePath);

        // On envoie le type de contenu et le buffer complet.
        reply.type(image.mimetype).send(buffer);
        // --- FIN DU BLOC MODIFIÉ ---

    } catch (error) {
        console.error("Erreur lors de l'affichage de l'image:", error);
        reply.code(500).send({ message: "Erreur serveur." });
    }
};

/**
 * Logique d'upload qui sauvegarde une image et renvoie ses métadonnées.
 * @param {object} fileData - L'objet fichier de Fastify.
 * @param {string} ownerType - 'USER' ou 'COMPANY'.
 * @param {number} ownerId - L'ID du propriétaire.
 * @returns {Promise<object>} L'objet Image de Prisma.
 */
const handleImageUpload = async (fileData, ownerType, ownerId) => {
    const fileExtension = path.extname(fileData.filename);
    const newFilename = `${crypto.randomBytes(16).toString('hex')}${fileExtension}`;
    const filePath = path.join(UPLOADS_DIR, newFilename);

    await pump(fileData.file, fs.createWriteStream(filePath));

    const existingImage = await prisma.image.findFirst({
        where: { ownerId, ownerType }
    });

    let savedImage;
    if (existingImage) {
        const oldFilePath = path.join(UPLOADS_DIR, existingImage.filename);
        fs.unlink(oldFilePath, (err) => {
            if (err) console.error("Erreur suppression ancienne image:", err);
        });

        savedImage = await prisma.image.update({
            where: { id: existingImage.id },
            data: { filename: newFilename, mimetype: fileData.mimetype }
        });
    } else {
        savedImage = await prisma.image.create({
            data: {
                filename: newFilename,
                mimetype: fileData.mimetype,
                ownerType: ownerType,
                ownerId: ownerId
            }
        });
    }
    return savedImage;
};


/**
 * Contrôleur pour l'upload d'une image de profil utilisateur.
 */
const uploadProfilePicture = async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.code(400).send({ message: "Aucun fichier." });
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(data.mimetype)) {
        return reply.code(400).send({ message: "Format non supporté." });
    }

    try {
        const image = await handleImageUpload(data, 'USER', request.user.userId);

        // On construit l'URL permanente avec le cache-buster
        const imageUrl = `/api/images/${image.publicId}?v=${image.updatedAt.getTime()}`;

        reply.code(200).send({
            message: "Image de profil mise à jour.",
            imageUrl: imageUrl
        });
    } catch (error) {
        console.error(error);
        reply.code(500).send({ message: "Erreur lors de la sauvegarde de l'image." });
    }
};


/**
 * Contrôleur pour l'upload d'une image pour une entreprise.
 * Note : La vérification de permission est laissée au middleware de la route.
 */
const uploadCompanyImage = async (request, reply) => {
    const companyId = parseInt(request.params.id, 10);
    const data = await request.file();

    if (!data) return reply.code(400).send({ message: "Aucun fichier fourni." });
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(data.mimetype)) {
        return reply.code(400).send({ message: "Format de fichier non supporté." });
    }

    try {
        const imageUrl = await handleImageUpload(data, 'COMPANY', companyId);
        // On renvoie l'URL publique au frontend
        reply.code(200).send({
            message: `Image pour l'entreprise ${companyId} mise à jour.`,
            imageUrl: imageUrl
        });
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