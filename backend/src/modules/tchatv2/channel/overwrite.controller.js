'use strict';

const { upsertOverwrite, deleteOverwrite } = require('./overwrite.service');

async function upsert(req, reply) {
    try {
        await upsertOverwrite(req.params.channelId, req.params.targetId, req.body, req.params.guildId);
        return reply.code(204).send();
    } catch (err) {
        return reply.code(err.status || 500).send({ message: err.message });
    }
}

async function destroy(req, reply) {
    try {
        await deleteOverwrite(req.params.channelId, req.params.targetId, req.params.guildId);
        return reply.code(204).send();
    } catch (err) {
        return reply.code(err.status || 500).send({ message: err.message });
    }
}

module.exports = { upsert, destroy };
