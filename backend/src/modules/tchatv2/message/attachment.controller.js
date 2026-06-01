'use strict';

const svc = require('./attachment.service');

const UPLOAD_LIMIT = 25 * 1024 * 1024;

async function uploadFiles(req, reply) {
    const userId    = req.user?.id;
    const companyId = req.companyId ?? Number(req.headers['x-company-id']);

    const files = [];
    // Override global multipart limit (5 MB) to 25 MB for attachments
    const parts = req.files({ limits: { fileSize: UPLOAD_LIMIT } });

    for await (const part of parts) {
        const chunks = [];
        for await (const chunk of part.file) chunks.push(chunk);
        files.push({
            buffer:   Buffer.concat(chunks),
            mimetype: part.mimetype,
            filename: part.filename,
        });
    }

    if (!files.length) return reply.code(400).send({ error: 'No files provided' });

    const result = await svc.uploadAttachments(files, { userId, companyId });
    return reply.code(200).send(result);
}

module.exports = { uploadFiles };
