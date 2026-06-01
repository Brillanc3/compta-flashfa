// /backend/src/modules/admin/admin.images.controller.js

const imagesSvc = require('./admin.images.service');

const listImages = async (request, reply) => {
    try {
        const { ownerType, ownerId, search, webpOnly, page, limit } = request.query;
        const result = await imagesSvc.listImages({
            ownerType,
            ownerId,
            search,
            webpOnly,
            page: page ? parseInt(page, 10) : 1,
            limit: limit ? Math.min(parseInt(limit, 10), 100) : 20,
        });
        reply.send(result);
    } catch (error) {
        console.error('[AdminImages] listImages:', error);
        reply.code(500).send({ message: 'Erreur serveur.' });
    }
};

const uploadImage = async (request, reply) => {
    try {
        const fileData = await request.file();
        if (!fileData) return reply.code(400).send({ message: 'Aucun fichier.' });

        const image = await imagesSvc.uploadAdminImage(fileData, request.user.userId);
        reply.code(201).send({ message: 'Image uploadée.', image });
    } catch (error) {
        if (error.statusCode) return reply.code(error.statusCode).send({ message: error.message });
        console.error('[AdminImages] uploadImage:', error);
        reply.code(500).send({ message: "Erreur lors de l'upload." });
    }
};

const getImage = async (request, reply) => {
    try {
        const imageId = parseInt(request.params.imageId, 10);
        const image = await imagesSvc.getImage(imageId);
        if (!image) return reply.code(404).send({ message: 'Image introuvable.' });
        reply.send(image);
    } catch (error) {
        console.error('[AdminImages] getImage:', error);
        reply.code(500).send({ message: 'Erreur serveur.' });
    }
};

const replaceImage = async (request, reply) => {
    try {
        const imageId = parseInt(request.params.imageId, 10);
        const fileData = await request.file();
        if (!fileData) return reply.code(400).send({ message: 'Aucun fichier.' });

        const image = await imagesSvc.replaceImage(imageId, fileData);
        reply.send({ message: 'Image remplacée.', image });
    } catch (error) {
        if (error.statusCode) return reply.code(error.statusCode).send({ message: error.message });
        console.error('[AdminImages] replaceImage:', error);
        reply.code(500).send({ message: 'Erreur lors du remplacement.' });
    }
};

const deleteImage = async (request, reply) => {
    try {
        const imageId = parseInt(request.params.imageId, 10);
        await imagesSvc.deleteImage(imageId);
        reply.send({ message: 'Image supprimée.' });
    } catch (error) {
        if (error.statusCode) return reply.code(error.statusCode).send({ message: error.message });
        console.error('[AdminImages] deleteImage:', error);
        reply.code(500).send({ message: 'Erreur lors de la suppression.' });
    }
};

const convertToWebP = async (request, reply) => {
    try {
        const imageId = parseInt(request.params.imageId, 10);
        const image = await imagesSvc.convertToWebP(imageId);
        reply.send({ message: 'Image convertie en WebP.', image });
    } catch (error) {
        if (error.statusCode) return reply.code(error.statusCode).send({ message: error.message });
        console.error('[AdminImages] convertToWebP:', error);
        reply.code(500).send({ message: 'Erreur lors de la conversion.' });
    }
};

module.exports = { listImages, uploadImage, getImage, replaceImage, deleteImage, convertToWebP };
