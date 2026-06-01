'use strict';

const svc = require('./guild.emoji.service');

async function list(req, reply) {
    try {
        const emojis = await svc.listEmojis(req.params.guildId);
        return reply.send({ emojis });
    } catch (err) {
        return reply.code(err.status || 500).send({ message: err.message });
    }
}

async function create(req, reply) {
    let buffer, mimetype, name;
    const parts = req.parts({ limits: { fileSize: 256 * 1024, files: 1 } });
    for await (const part of parts) {
        if (part.fieldname === 'file') {
            const chunks = [];
            for await (const chunk of part.file) chunks.push(chunk);
            buffer   = Buffer.concat(chunks);
            mimetype = part.mimetype;
        } else if (part.fieldname === 'name') {
            name = part.value;
        }
    }
    if (!buffer) return reply.code(400).send({ message: 'No file provided' });
    if (!name || typeof name !== 'string' || !name.trim()) {
        return reply.code(400).send({ message: 'name must be a non-empty string' });
    }

    try {
        const emoji = await svc.createEmoji(req.params.guildId, { buffer, mimetype, name });
        return reply.code(201).send(emoji);
    } catch (err) {
        return reply.code(err.status || 500).send({ message: err.message });
    }
}

async function destroy(req, reply) {
    try {
        await svc.deleteEmoji(req.params.guildId, req.params.emojiId);
        return reply.code(204).send();
    } catch (err) {
        return reply.code(err.status || 500).send({ message: err.message });
    }
}

module.exports = { list, create, destroy };
