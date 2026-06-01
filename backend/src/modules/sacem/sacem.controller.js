// /backend/src/modules/sacem/sacem.controller.js
'use strict';

const service = require('./sacem.service');

async function previewImportHandler(req, reply) {
    const companyId = parseInt(req.headers['x-company-id'], 10);
    const { text } = req.body;
    if (!text) return reply.code(400).send({ message: "Le texte est requis." });

    try {
        const preview = await service.previewSacemImport({ companyId, text });
        reply.send(preview);
    } catch (error) {
        reply.code(500).send({ message: error.message });
    }
}

async function importSacemHandler(req, reply) {
    const companyId = parseInt(req.headers['x-company-id'], 10);
    const { entries } = req.body;
    if (!Array.isArray(entries)) return reply.code(400).send({ message: "Les entrées sont requises sous forme de tableau." });

    try {
        const results = await service.importSacemData({ companyId, entries });
        reply.send(results);
    } catch (error) {
        reply.code(500).send({ message: error.message });
    }
}

async function listPostsHandler(req, reply) {
    const companyId = parseInt(req.headers['x-company-id'], 10);
    const { page, limit, category, search } = req.query;

    try {
        const result = await service.listPosts({
            companyId,
            page: parseInt(page || 1, 10),
            limit: parseInt(limit || 50, 10),
            category,
            search
        });
        reply.send(result);
    } catch (error) {
        reply.code(500).send({ message: error.message });
    }
}

async function getPostDetailsHandler(req, reply) {
    const companyId = parseInt(req.headers['x-company-id'], 10);
    const { postId } = req.params;

    try {
        const post = await service.getPostDetails(companyId, postId);
        reply.send(post);
    } catch (error) {
        reply.code(404).send({ message: error.message });
    }
}

async function updatePostHandler(req, reply) {
    const companyId = parseInt(req.headers['x-company-id'], 10);
    const { postId } = req.params;
    const data = req.body;

    try {
        const updated = await service.updatePost(companyId, postId, data);
        reply.send(updated);
    } catch (error) {
        reply.code(500).send({ message: error.message });
    }
}

async function getStatsHandler(req, reply) {
    const companyId = parseInt(req.headers['x-company-id'], 10);
    const { from, to } = req.query;

    try {
        const stats = await service.getSacemStats(companyId, {
            from: from ? new Date(from) : null,
            to: to ? new Date(to) : null
        });
        reply.send(stats);
    } catch (error) {
        reply.code(500).send({ message: error.message });
    }
}

async function getCategoriesHandler(req, reply) {
    const companyId = parseInt(req.headers['x-company-id'], 10);

    try {
        const categories = await service.getCategories(companyId);
        reply.send(categories);
    } catch (error) {
        reply.code(500).send({ message: error.message });
    }
}

module.exports = {
    importSacemHandler,
    previewImportHandler,
    listPostsHandler,
    getPostDetailsHandler,
    updatePostHandler,
    getStatsHandler,
    getCategoriesHandler
};
